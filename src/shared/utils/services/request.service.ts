import { Injectable, Logger } from '@nestjs/common';
import got, { OptionsInit, Response, RequestError } from 'got';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { ClsService } from '../../context/cls.service';
import { CustomError, RateLimitError } from '../../exceptions/http.exceptions';

const DEFAULT_HTTP_CONNECT_TIMEOUT = 30_000;

export interface RequestClientOptions extends OptionsInit {
	dynamicHTTPAgent?: {
		maxSockets?: number;
		maxFreeSockets?: number;
		timeout?: number;
		freeSocketTimeout?: number;
	};
	bodyOverRide?: boolean;
	jsonOverRide?: boolean;
	debugMode?: boolean;
	responseOverride?: string[];
	data?: unknown;
}

export interface GraphqlClientOptions extends Omit<RequestClientOptions, 'data' | 'bodyOverRide' | 'jsonOverRide'> {
	query: string;
	variables?: Record<string, unknown>;
	operationName?: string;
}

interface GraphqlResponseBody<T> {
	data?: T;
	errors?: Array<{
		message: string;
	}>;
}

@Injectable()
export class RequestClient {
	private readonly logger = new Logger(RequestClient.name);
	private readonly defaultTimeout: number;

	constructor(private readonly cls: ClsService) {
		this.defaultTimeout = DEFAULT_HTTP_CONNECT_TIMEOUT;
	}

	private createAgent(options: RequestClientOptions): { http: HttpAgent; https: HttpsAgent } {
		if (options.dynamicHTTPAgent !== undefined) {
			const { maxSockets = 100, maxFreeSockets = 10 } = options.dynamicHTTPAgent;

			return {
				http: new HttpAgent({ maxSockets, maxFreeSockets, keepAlive: true }),
				https: new HttpsAgent({ maxSockets, maxFreeSockets, keepAlive: true }),
			};
		}

		return {
			http: new HttpAgent({ keepAlive: true }),
			https: new HttpsAgent({ keepAlive: true }),
		};
	}

	async hitRequest<T = unknown>(options: RequestClientOptions): Promise<T> {
		const requestId = this.cls.get<string>('request_id') ?? 'unknown';
		const url = options.url ?? options.prefixUrl;
		if (!url) {
			throw new CustomError(400, 'BAD_REQUEST', 'URL is required');
		}

		const {
			dynamicHTTPAgent: _dynamicHTTPAgent,
			bodyOverRide,
			jsonOverRide,
			debugMode,
			responseOverride,
			data,
			url: _url,
			prefixUrl: _prefixUrl,
			...restOptions
		} = options;

		const agent = this.createAgent(options);
		const timeoutOption = (restOptions as OptionsInit).timeout;
		let timeoutValue: OptionsInit['timeout'] = { request: this.defaultTimeout };
		if (timeoutOption) {
			if (typeof timeoutOption === 'number') {
				timeoutValue = { request: timeoutOption };
			} else if (typeof timeoutOption === 'object') {
				timeoutValue = { request: timeoutOption.request ?? this.defaultTimeout, ...timeoutOption };
			}
		}

		const gotConfig: OptionsInit = {
			...restOptions,
			timeout: timeoutValue,
			agent: {
				http: agent.http,
				https: agent.https,
			},
			responseType: 'json',
		};

		if (data !== undefined) {
			if (bodyOverRide) {
				gotConfig.body = typeof data === 'string' ? data : JSON.stringify(data);
				gotConfig.responseType = 'text';
				gotConfig.headers = {
					...gotConfig.headers,
					'Content-Type': 'text/plain',
				};
			} else if (jsonOverRide !== undefined) {
				gotConfig.json = data;
				gotConfig.headers = {
					...gotConfig.headers,
					'Content-Type': 'application/json',
				};
			} else if (typeof data === 'object' && data !== null) {
				gotConfig.json = data;
			} else {
				gotConfig.body = typeof data === 'string' ? data : JSON.stringify(data);
			}
		}

		const requestPayload = gotConfig.json ?? gotConfig.body ?? data;
		this.logger.log(`${requestId} External Request url: ${url} Request payload ${JSON.stringify(requestPayload)}`);

		try {
			const startTime = Date.now();
			const response = (await got(url as string | URL, gotConfig)) as Response<T>;
			const duration = Date.now() - startTime;

			if (duration > this.defaultTimeout) {
				this.logger.log(
					`${requestId} External Request url ${url} Response Status Code : ${response.statusCode} GREATER than connection time out. Duration: ${duration}ms`,
				);
			}

			if (debugMode) {
				this.logger.log(`${requestId} External Request debugMode ${url} requestType ${JSON.stringify(gotConfig)}`);
				this.logger.log(`${requestId} External Request debugMode ${url} headers ${JSON.stringify(gotConfig.headers)}`);
				this.logger.log(`${requestId} External Request debugMode ${url} body ${JSON.stringify(gotConfig.json ?? gotConfig.body)}`);
			}

			if (responseOverride && responseOverride.length > 0) {
				const responseData = response.body as Record<string, unknown>;
				const overriddenResponse = responseOverride.reduce<Record<string, unknown>>((acc, key) => {
					const value = responseData?.[key];
					if (value !== undefined) {
						acc[key] = value;
					}
					return acc;
				}, {});
				return overriddenResponse as T;
			}

			return response.body as T;
		} catch (error) {
			const gotError = error as RequestError;
			const response = gotError.response;
			const message = response?.body
				? typeof response.body === 'string'
					? response.body
					: JSON.stringify(response.body)
				: gotError.message;

			if (gotError.code === 'ETIMEDOUT' || gotError.code === 'ECONNRESET' || gotError.name === 'TimeoutError') {
				this.logger.log(`${requestId} External Request Failed for url ${url} method ${gotConfig.method ?? 'GET'} message ${message}`);
				throw new CustomError(408, 'TIMEDOUT', message);
			}

			if (response) {
				this.logger.log(
					`${requestId} External Request Failed for url ${url} method ${gotConfig.method ?? 'GET'} status Code ${response.statusCode} message ${message}`,
				);

				if (response.statusCode === 429) {
					const resetHeader = (response.headers as Record<string, string | string[] | undefined>)['ratelimit-reset'];
					const raw = typeof resetHeader === 'string' ? parseInt(resetHeader, 10) : NaN;
					const retryAfterMs = Number.isFinite(raw)
						? raw < 1e9
							? raw * 1000
							: Math.max(0, raw * 1000 - Date.now())
						: 60_000;
					throw new RateLimitError(message, retryAfterMs);
				}

				const responseBody = response.body as { code?: string; message?: string } | undefined;
				const errorCode = responseBody?.code ?? gotError.code ?? 'GENERIC';
				const errorMessage = responseBody?.message ?? message ?? gotError.message ?? 'GENERIC';
				throw new CustomError(response.statusCode, typeof errorCode === 'string' ? errorCode : 'GENERIC', errorMessage);
			}

			this.logger.error(`${requestId} External Request Failed for url ${url} method ${gotConfig.method ?? 'GET'} status Code N/A message `, gotError);
			throw gotError;
		}
	}

	async graphql<T = unknown>(options: GraphqlClientOptions): Promise<T> {
		const { query, variables, operationName, method, headers, ...requestOptions } = options;
		const url = options.url ?? options.prefixUrl;
		if (!url) {
			throw new CustomError(400, 'BAD_REQUEST', 'URL is required');
		}

		const payload: Record<string, unknown> = { query };
		if (variables !== undefined) {
			payload.variables = variables;
		}
		if (operationName !== undefined) {
			payload.operationName = operationName;
		}

		const response = await this.hitRequest<GraphqlResponseBody<T>>({
			...requestOptions,
			url,
			method: method ?? 'POST',
			data: payload,
			jsonOverRide: true,
			headers: {
				'Content-Type': 'application/json',
				...headers,
			},
		});

		if (response.errors?.length) {
			const message = response.errors.map((error) => error.message).join('; ');
			throw new CustomError(502, 'GRAPHQL_ERROR', message);
		}

		if (response.data === undefined) {
			throw new CustomError(502, 'GRAPHQL_ERROR', 'GraphQL response missing data');
		}

		return response.data;
	}
}
