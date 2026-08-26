import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { GraphqlClientOptions, RequestClient } from 'src/shared/utils/services/request.service';
import { env as envConfig } from '../../../config/env.config';
import {
	CreateFreePbxExtensionDto,
	CreateFreePbxExtensionRangeDto,
	UpdateFreePbxExtensionDto,
} from '../dto/freepbx.dto';
import { RedisService } from 'src/infra/redis/services/redis.service';
import { RedlockService } from 'src/infra/redis/services/redlock.service';

export interface FreePbxTokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
}

interface FreePbxMutationResponse {
	status: boolean | string;
	message: string;
	clientMutationId?: string | null;
	transaction_id?: string | null;
}

interface ExtensionMutationInputOptions {
	extension: string;
	name?: string;
	email?: string;
	secret?: string;
}

@Injectable()
export class FreePbxService {
	private readonly redisCacheNamespace = 'freePbx';

	constructor(
		private readonly requestClient: RequestClient,
		private readonly redisService: RedisService,
		private readonly logger: Logger,
		private readonly redlockService: RedlockService,
	) {}

	private async authenticate(): Promise<FreePbxTokenResponse> {
		const body = new URLSearchParams({
			grant_type: 'client_credentials',
			client_id: envConfig.FREEPBX_CLIENT_ID,
			client_secret: envConfig.FREEPBX_CLIENT_SECRET,
		}).toString();

		return this.requestClient.hitRequest<FreePbxTokenResponse>({
			method: 'POST',
			url: envConfig.FREEPBX_TOKEN_URL,
			data: body,
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
		});
	}

	public async getAccessToken(): Promise<string> {
		const cachedToken = await this.redisService.getKey(this.redisCacheNamespace, 'access_token');
		if (cachedToken) {
			this.logger.log('[FreePbxService] Cache hit for access token');
			return cachedToken;
		}

		this.logger.log('[FreePbxService] Cache miss for access token');
		const tokenResponse = await this.authenticate();
		await this.redisService.setKey(
			this.redisCacheNamespace,
			'access_token',
			tokenResponse.access_token,
			tokenResponse.expires_in,
		);
		return tokenResponse.access_token;
	}

	private async graphqlRequest<T>(options: Omit<GraphqlClientOptions, 'url' | 'headers'> & { url?: string }): Promise<T> {
		const accessToken = await this.getAccessToken();
		return this.requestClient.graphql<T>({
			...options,
			url: options.url ?? envConfig.FREEPBX_GRAPHQL_URL,
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		});
	}

	private assertMutationSuccess(response: FreePbxMutationResponse, operation: string): void {
		const succeeded = response.status === true || response.status === 'true';
		if (!succeeded) {
			const message = response.message || `FreePBX ${operation} failed`;
			this.logger.error(`[FreePbxService] ${operation} failed: ${message}`);
			throw new InternalServerErrorException(message);
		}
	}

	private buildExtensionMutationInput(options: ExtensionMutationInputOptions): Record<string, unknown> {
		const { extension, name, email, secret } = options;
		const extensionName = name ?? extension;

		return {
			extensionId: extension,
			tech: 'pjsip',
			name: extensionName,
			email: email ?? `${extension}@example.com`,
			umEnable: false,
			vmEnable: false,
			maxContacts: '1',
			...(secret !== undefined && { extPassword: secret }),
		};
	}

	private async doReloadConfig(): Promise<FreePbxMutationResponse> {
		const response = await this.graphqlRequest<{ doreload: FreePbxMutationResponse }>({
			query: `
				mutation DoReload($input: doreloadInput!) {
					doreload(input: $input) {
						status
						message
						transaction_id
					}
				}
			`,
			variables: {
				input: {},
			},
		});

		return response.doreload;
	}

	public async applyConfig(): Promise<FreePbxMutationResponse> {
		const lock = await this.redlockService.acquireLock(this.redisCacheNamespace, 'applyConfig', 60);
		if (!lock) {
			throw new InternalServerErrorException('Failed to acquire lock for apply config');
		}

		try {
			this.logger.log('[FreePbxService] Reloading FreePBX configuration');
			const reloadResponse = await this.doReloadConfig();
			this.assertMutationSuccess(reloadResponse, 'doreload');
			return reloadResponse;
		} catch (error) {
			this.logger.error(`Error applying config: ${error}`);
			if (error instanceof InternalServerErrorException) {
				throw error;
			}
			throw new InternalServerErrorException('Failed to apply config');
		} finally {
			await this.redlockService.releaseLock(this.redisCacheNamespace, 'applyConfig', lock);
		}
	}

	private async mutateAndApply<T extends Record<string, FreePbxMutationResponse>>(
		responsePromise: Promise<T>,
		operation: keyof T,
	): Promise<T> {
		const response = await responsePromise;
		this.assertMutationSuccess(response[operation], String(operation));
		await this.applyConfig();
		return response;
	}

	async getExtensions(): Promise<unknown> {
		return this.graphqlRequest<{
			fetchAllExtensions: {
				status: boolean;
				message: string;
				totalCount: number;
				extension: Array<{
					id: string;
					extensionId: string;
					user: {
						name: string;
						outboundCid?: string;
					};
				}>;
			};
		}>({
			query: `
				query FetchAllExtensions {
					fetchAllExtensions {
						status
						message
						totalCount
						extension {
							id
							extensionId
							user {
								name
								outboundCid
							}
						}
					}
				}
			`,
		});
	}

	async getExtension(extensionId: string): Promise<unknown> {
		return this.graphqlRequest<{
			fetchExtension: {
				status: boolean;
				message: string;
				id: string;
				extensionId: string;
				user: {
					name: string;
					outboundCid?: string;
					voicemail?: string;
				};
			};
		}>({
			query: `
				query FetchExtension($extensionId: ID!) {
					fetchExtension(extensionId: $extensionId) {
						status
						message
						id
						extensionId
						user {
							name
							outboundCid
							voicemail
						}
					}
				}
			`,
			variables: {
				extensionId,
			},
		});
	}

	async createExtension(payload: CreateFreePbxExtensionDto): Promise<unknown> {
		const { extension, name, secret, email } = payload;

		const addResponse = await this.graphqlRequest<{ addExtension: FreePbxMutationResponse }>({
			query: `
				mutation AddExtension($input: addExtensionInput!) {
					addExtension(input: $input) {
						status
						message
						clientMutationId
					}
				}
			`,
			variables: {
				input: this.buildExtensionMutationInput({ extension, name, email }),
			},
		});
		this.assertMutationSuccess(addResponse.addExtension, 'addExtension');

		if (secret !== undefined) {
			const updateResponse = await this.graphqlRequest<{ updateExtension: FreePbxMutationResponse }>({
				query: `
					mutation UpdateExtension($input: updateExtensionInput!) {
						updateExtension(input: $input) {
							status
							message
							clientMutationId
						}
					}
				`,
				variables: {
					input: this.buildExtensionMutationInput({ extension, name, email, secret }),
				},
			});
			this.assertMutationSuccess(updateResponse.updateExtension, 'updateExtension');
		}

		await this.applyConfig();
		return addResponse;
	}

	async createExtensionRange(payload: CreateFreePbxExtensionRangeDto): Promise<unknown> {
		const { startExtension, endExtension, namePrefix } = payload;
		const numberOfExtensions = Number(endExtension) - Number(startExtension) + 1;

		return this.mutateAndApply(
			this.graphqlRequest<{ createRangeofExtension: FreePbxMutationResponse }>({
				query: `
					mutation CreateRangeOfExtension($input: createRangeofExtensionInput!) {
						createRangeofExtension(input: $input) {
							status
							message
							clientMutationId
						}
					}
				`,
				variables: {
					input: {
						startExtension,
						numberOfExtensions: String(numberOfExtensions),
						tech: 'pjsip',
						name: namePrefix ?? 'Extension',
						email: `${startExtension}@example.com`,
						umEnable: false,
						vmEnable: false,
					},
				},
			}),
			'createRangeofExtension',
		);
	}

	async updateExtension(extension: string, payload: UpdateFreePbxExtensionDto): Promise<unknown> {
		const { name, secret, email } = payload;

		return this.mutateAndApply(
			this.graphqlRequest<{ updateExtension: FreePbxMutationResponse }>({
				query: `
					mutation UpdateExtension($input: updateExtensionInput!) {
						updateExtension(input: $input) {
							status
							message
							clientMutationId
						}
					}
				`,
				variables: {
					input: this.buildExtensionMutationInput({ extension, name, email, secret }),
				},
			}),
			'updateExtension',
		);
	}

	async deleteExtension(extension: string): Promise<unknown> {
		return this.mutateAndApply(
			this.graphqlRequest<{ deleteExtension: FreePbxMutationResponse }>({
				query: `
					mutation DeleteExtension($input: deleteExtensionInput!) {
						deleteExtension(input: $input) {
							status
							message
						}
					}
				`,
				variables: {
					input: {
						extensionId: extension,
					},
				},
			}),
			'deleteExtension',
		);
	}
}
