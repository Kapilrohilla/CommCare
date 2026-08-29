import { Injectable, Logger } from "@nestjs/common";
import { RequestClient } from "../../../shared/utils/services/request.service";
import { env as envConfig } from '../../../config/env.config';
import { ARI_APP_NAME } from "src/constants/app.constant";
import { AriChannel } from "../types/ari-channel.types";

export interface OriginateCallOptions {
	appArgs?: string[];
	callerId?: string;
	timeout?: number;
}

@Injectable()
export class AsteriskService {
	private ariBaseUrl: string | null = null;
	private readonly username: string;
	private readonly password: string;

	constructor(
		private readonly requestClient: RequestClient,
		private readonly logger: Logger,
	) {
		this.ariBaseUrl = envConfig.ARI_HOST;
		this.username = envConfig.ARI_USER;
		this.password = envConfig.ARI_PASSWORD;
	}

	async onModuleInit() {}

	private getToken(username: string, password: string): string {
		return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
	}

	private getAuthHeaders(): Record<string, string> {
		return {
			'Content-Type': 'application/json',
			'Authorization': this.getToken(this.username, this.password),
		};
	}

	async healthCheckAsterisk(): Promise<unknown> {
		const healthCheckUrl = `${this.ariBaseUrl}/ari/asterisk/ping`;
		this.logger.log("ARI Base URL: ", this.ariBaseUrl);

		const token = this.getToken(this.username, this.password);
		this.logger.log(`Health Check Asterisk: ${healthCheckUrl}`);

		return await this.requestClient.hitRequest({
			method: 'GET',
			url: healthCheckUrl,
			headers: {
				'Content-Type': 'application/json',
				'Authorization': token,
			},
		});
	}

	async originateCall(endpoint: string, options: OriginateCallOptions = {}): Promise<AriChannel> {
		const url = new URL(`${this.ariBaseUrl}/ari/channels`);
		url.searchParams.set('endpoint', endpoint);
		url.searchParams.set('app', ARI_APP_NAME);
		url.searchParams.set('callerId', options.callerId ?? 'Unknown');
		url.searchParams.set('timeout', String(options.timeout ?? 30));

		for (const arg of options.appArgs ?? []) {
			url.searchParams.append('appArgs', arg);
		}

		return await this.requestClient.hitRequest({
			method: 'POST',
			url: url.toString(),
			headers: this.getAuthHeaders(),
		});
	}

	async answerChannel(channelId: string): Promise<void> {
		await this.requestClient.hitRequest({
			method: 'POST',
			url: `${this.ariBaseUrl}/ari/channels/${encodeURIComponent(channelId)}/answer`,
			headers: this.getAuthHeaders(),
		});
	}

	async hangupChannel(channelId: string): Promise<void> {
		await this.requestClient.hitRequest({
			method: 'DELETE',
			url: `${this.ariBaseUrl}/ari/channels/${encodeURIComponent(channelId)}`,
			headers: this.getAuthHeaders(),
		});
	}

	async createBridge(): Promise<{ id: string }> {
		return await this.requestClient.hitRequest({
			method: 'POST',
			url: `${this.ariBaseUrl}/ari/bridges`,
			headers: this.getAuthHeaders(),
			data: { type: 'mixing' },
		});
	}

	async addChannelToBridge(bridgeId: string, channelId: string): Promise<void> {
		const url = new URL(`${this.ariBaseUrl}/ari/bridges/${encodeURIComponent(bridgeId)}/addChannel`);
		url.searchParams.set('channel', channelId);

		await this.requestClient.hitRequest({
			method: 'POST',
			url: url.toString(),
			headers: this.getAuthHeaders(),
		});
	}
}
