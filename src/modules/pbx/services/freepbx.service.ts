import { HttpException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { GraphqlClientOptions, RequestClient } from 'src/shared/utils/services/request.service';
import { CustomError } from 'src/shared/exceptions/http.exceptions';
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
	private readonly accessTokenCacheKey = 'access_token';
	private readonly configDirtyCacheKey = 'configDirty';
	private readonly applyConfigDebounceMs = 2_000;

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
			scope: envConfig.FREEPBX_OAUTH_SCOPE,
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
		const cachedToken = await this.redisService.getKey<string>(
			this.redisCacheNamespace,
			this.accessTokenCacheKey,
		);
		if (cachedToken) {
			this.logger.log('[FreePbxService] Cache hit for access token');
			return cachedToken;
		}

		this.logger.log('[FreePbxService] Cache miss for access token');
		const tokenResponse = await this.authenticate();
		const ttlSeconds = Math.max(tokenResponse.expires_in - 60, 60);
		await this.redisService.setKey(
			this.redisCacheNamespace,
			this.accessTokenCacheKey,
			tokenResponse.access_token,
			ttlSeconds,
		);
		return tokenResponse.access_token;
	}

	private async invalidateAccessToken(): Promise<void> {
		await this.redisService.deleteKey(this.redisCacheNamespace, this.accessTokenCacheKey);
	}

	private isAuthError(error: unknown): boolean {
		if (error instanceof CustomError) {
			return error.getStatus() === 401;
		}

		if (error instanceof HttpException) {
			return error.getStatus() === 401;
		}

		const message = error instanceof Error ? error.message : String(error);
		return message.includes('denied the request') || message.includes('OAuthServerException');
	}

	private async graphqlRequest<T>(
		options: Omit<GraphqlClientOptions, 'url' | 'headers'> & { url?: string },
		retried = false,
	): Promise<T> {
		try {
			const accessToken = await this.getAccessToken();
			return await this.requestClient.graphql<T>({
				...options,
				url: options.url ?? envConfig.FREEPBX_GRAPHQL_URL,
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			});
		} catch (error) {
			if (!retried && this.isAuthError(error)) {
				this.logger.warn('[FreePbxService] Access token rejected, refreshing and retrying GraphQL request');
				await this.invalidateAccessToken();
				return this.graphqlRequest(options, true);
			}
			throw error;
		}
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
		const lock = await this.redlockService.acquireLockWithRetry(
			this.redisCacheNamespace,
			'applyConfig',
			120,
			{ maxWaitMs: 90_000, retryIntervalMs: 1_000 },
		);
		if (!lock) {
			throw new InternalServerErrorException('Failed to acquire lock for apply config');
		}

		try {
			this.logger.log('[FreePbxService] Reloading FreePBX configuration');
			const reloadResponse = await this.doReloadConfig();
			this.assertMutationSuccess(reloadResponse, 'doreload');
			await this.redisService.deleteKey(this.redisCacheNamespace, this.configDirtyCacheKey);
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

	public async requestApplyConfig(): Promise<void> {
		await this.redisService.setKey(this.redisCacheNamespace, this.configDirtyCacheKey, '1', 300);

		const schedulerLock = await this.redlockService.acquireLockWithRetry(
			this.redisCacheNamespace,
			'applyConfigScheduler',
			30,
			{ maxWaitMs: 5_000, retryIntervalMs: 250 },
		);
		if (!schedulerLock) {
			this.logger.log('[FreePbxService] Config reload already scheduled by another worker');
			return;
		}

		try {
			await new Promise((resolve) => setTimeout(resolve, this.applyConfigDebounceMs));

			const configDirty = await this.redisService.getKey<string>(
				this.redisCacheNamespace,
				this.configDirtyCacheKey,
			);
			if (!configDirty) {
				return;
			}

			await this.applyConfig();
		} catch (error) {
			this.logger.error(`Error scheduling FreePBX config reload: ${error}`);
		} finally {
			await this.redlockService.releaseLock(
				this.redisCacheNamespace,
				'applyConfigScheduler',
				schedulerLock,
			);
		}
	}

	private async mutateAndApply<T extends Record<string, FreePbxMutationResponse>>(
		responsePromise: Promise<T>,
		operation: keyof T,
	): Promise<T> {
		const response = await responsePromise;
		this.assertMutationSuccess(response[operation], String(operation));
		await this.requestApplyConfig();
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

		await this.requestApplyConfig();
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
