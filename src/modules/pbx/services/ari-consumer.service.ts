import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ARI_APP_NAME } from 'src/constants/app.constant';
import { env } from 'src/config/env.config';
import { Events } from 'src/constants/event.constant';
import { EventProducer } from 'src/infra/queue/services/event-producer.service';
import { RedlockService } from 'src/infra/redis/services/redlock.service';
import {
	AriCallEventPayload,
	RawAriEvent,
	isRoutingRelevantAriEvent,
	resolveAriPartitionKey,
} from '../types/ari-event.types';
import { buildAriEventIdempotencyKey } from '../utils/ari-idempotency.util';

const REDIS_NAMESPACE = 'ariConsumer';
const LEADER_LOCK_KEY = 'leader';

@Injectable()
export class AriConsumerService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(AriConsumerService.name);
	private websocket: globalThis.WebSocket | null = null;
	private isLeader = false;
	private leaderLockValue: string | null = null;
	private renewTimer: ReturnType<typeof setInterval> | null = null;
	private leaderLoopTimer: ReturnType<typeof setTimeout> | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private reconnectAttempt = 0;
	private running = false;

	constructor(
		private readonly eventProducer: EventProducer,
		private readonly redlockService: RedlockService,
	) {}

	onModuleInit(): void {
		if (!env.ARI_CONSUMER_ENABLED) {
			this.logger.log('ARI consumer disabled (ARI_CONSUMER_ENABLED=false)');
			return;
		}

		this.running = true;
		this.logger.log('Starting ARI consumer leader election');
		void this.leaderElectionLoop();
	}

	async onModuleDestroy(): Promise<void> {
		this.running = false;
		this.clearTimers();
		await this.disconnectWebSocket();
		if (this.leaderLockValue) {
			await this.redlockService.releaseLock(REDIS_NAMESPACE, LEADER_LOCK_KEY, this.leaderLockValue);
		}
	}

	getHealthStatus(): { isLeader: boolean; connected: boolean } {
		return {
			isLeader: this.isLeader,
			connected: this.websocket?.readyState === 1,
		};
	}

	private buildWebSocketUrl(): string {
		if (env.ARI_WS_URL) {
			return env.ARI_WS_URL;
		}

		const parsed = new URL(env.ARI_HOST);
		const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
		const apiKey = `${env.ARI_USER}:${env.ARI_PASSWORD}`;
		return `${wsProtocol}//${parsed.host}/ari/events?app=${ARI_APP_NAME}&api_key=${encodeURIComponent(apiKey)}`;
	}

	private async leaderElectionLoop(): Promise<void> {
		while (this.running) {
			if (!this.isLeader) {
				const lock = await this.redlockService.acquireLock(
					REDIS_NAMESPACE,
					LEADER_LOCK_KEY,
					env.ARI_LEADER_LOCK_TTL_SECONDS,
				);

				if (lock) {
					this.isLeader = true;
					this.leaderLockValue = lock;
					this.logger.log('Acquired ARI consumer leader lock');
					this.startLockRenewal();
					await this.connectWebSocket();
				}
			}

			await new Promise((resolve) => {
				this.leaderLoopTimer = setTimeout(resolve, 2_000);
			});
		}
	}

	private startLockRenewal(): void {
		this.stopLockRenewal();
		this.renewTimer = setInterval(() => {
			void this.renewLeaderLock();
		}, env.ARI_LEADER_LOCK_RENEW_INTERVAL_MS);
	}

	private stopLockRenewal(): void {
		if (this.renewTimer) {
			clearInterval(this.renewTimer);
			this.renewTimer = null;
		}
	}

	private async renewLeaderLock(): Promise<void> {
		if (!this.leaderLockValue) {
			return;
		}

		const renewed = await this.redlockService.renewLock(
			REDIS_NAMESPACE,
			LEADER_LOCK_KEY,
			this.leaderLockValue,
			env.ARI_LEADER_LOCK_TTL_SECONDS,
		);

		if (!renewed) {
			this.logger.warn('Lost ARI consumer leader lock');
			await this.stepDown();
		}
	}

	private async stepDown(): Promise<void> {
		this.isLeader = false;
		this.leaderLockValue = null;
		this.stopLockRenewal();
		await this.disconnectWebSocket();
	}

	private async connectWebSocket(): Promise<void> {
		await this.disconnectWebSocket();

		const url = this.buildWebSocketUrl();
		this.logger.log(`ARI WebSocket URL: ${url}`);
		const parsedUrl = new URL(url);
		this.logger.log(`Connecting ARI WebSocket to ${parsedUrl.host}${parsedUrl.pathname}`);

		const ws = new WebSocket(url);
		this.websocket = ws;

		ws.addEventListener('open', () => {
			this.reconnectAttempt = 0;
			this.logger.log('ARI WebSocket connected');
		});

		ws.addEventListener('message', (event) => {
			void this.handleMessage(String(event.data));
		});

		ws.addEventListener('close', () => {
			this.logger.warn('ARI WebSocket closed');
			if (this.isLeader && this.running) {
				this.scheduleReconnect();
			}
		});

		ws.addEventListener('error', (e) => {
			this.logger.error('ARI WebSocket error', e);
		});
	}

	private scheduleReconnect(): void {
		if (this.reconnectTimer) {
			return;
		}

		const delay = Math.min(30_000, 1_000 * 2 ** this.reconnectAttempt);
		this.reconnectAttempt += 1;
		this.logger.log(`Scheduling ARI WebSocket reconnect in ${delay}ms`);

		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			if (this.isLeader && this.running) {
				void this.connectWebSocket();
			}
		}, delay);
	}

	private async disconnectWebSocket(): Promise<void> {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}

		if (this.websocket) {
			try {
				this.websocket.close();
			} catch {
				// ignore
			}
			this.websocket = null;
		}
	}

	private clearTimers(): void {
		this.stopLockRenewal();
		if (this.leaderLoopTimer) {
			clearTimeout(this.leaderLoopTimer);
			this.leaderLoopTimer = null;
		}
	}

	private async handleMessage(raw: string): Promise<void> {
		let event: RawAriEvent;
		try {
			event = JSON.parse(raw) as RawAriEvent;
		} catch {
			this.logger.warn('Failed to parse ARI WebSocket message');
			return;
		}

		if (isRoutingRelevantAriEvent(event)) {
			this.logger.debug(
				`ARI routing event: type=${event.type} channel=${event.channel?.id ?? 'n/a'} args=${JSON.stringify(event.args ?? [])}`,
			);
		}

		const partitionKey = resolveAriPartitionKey(event);
		const idempotencyKey = buildAriEventIdempotencyKey(event);
		const payload: AriCallEventPayload = {
			partitionKey,
			idempotencyKey,
			body: event as unknown as Record<string, unknown>,
		};

		await this.eventProducer.publish(Events.ariCallEvent, payload, { partitionKey });
	}
}
