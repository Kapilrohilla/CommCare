import { Injectable, Logger } from "@nestjs/common";
import { RequestClient } from "../../../shared/utils/services/request.service";
import { env as envConfig } from '../../../config/env.config';
import { ARI_APP_NAME } from "src/constants/app.constant";
import { AriChannel } from "../types/ari-channel.types";

export interface OriginateCallOptions {
	appArgs?: string[];
	callerId?: string;
	callerIdName?: string | null;
	callerIdNumber?: string | null;
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

	/** ARI expects caller ID as `"Name" <number>`. Name-only values cause allocation failures. */
	formatCallerId(
		name: string | null | undefined,
		number: string | null | undefined,
	): string {
		const resolvedNumber = (number ?? '').trim() || 'unknown';
		const resolvedName = (name ?? '').trim();

		if (resolvedName) {
			return `"${resolvedName}" <${resolvedNumber}>`;
		}

		return `<${resolvedNumber}>`;
	}

	/** Ensure extension endpoints use the PJSIP/ prefix required by ARI. */
	normalizePjsipEndpoint(endpoint: string): string {
		const trimmed = endpoint.trim();
		if (!trimmed) {
			return trimmed;
		}

		if (trimmed.includes('/')) {
			return trimmed;
		}

		return `PJSIP/${trimmed}`;
	}

	buildOutboundEndpoint(destinationNumber: string): string {
		return envConfig.ARI_OUTBOUND_ENDPOINT_TEMPLATE.replace(
			'{number}',
			destinationNumber,
		);
	}

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
		const normalizedEndpoint = this.normalizePjsipEndpoint(endpoint);
		const callerId =
			options.callerId ??
			this.formatCallerId(options.callerIdName, options.callerIdNumber);

		const url = new URL(`${this.ariBaseUrl}/ari/channels`);
		url.searchParams.set('endpoint', normalizedEndpoint);
		url.searchParams.set('app', ARI_APP_NAME);
		url.searchParams.set('callerId', callerId);
		url.searchParams.set('timeout', String(options.timeout ?? 30));

		for (const arg of options.appArgs ?? []) {
			url.searchParams.append('appArgs', arg);
		}

		this.logger.log(
			`ARI originate: endpoint=${normalizedEndpoint} callerId=${callerId}`,
		);

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
