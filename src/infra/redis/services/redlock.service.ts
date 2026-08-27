import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RedisService } from './redis.service';

@Injectable()
export class RedlockService {
	constructor(private readonly redisService: RedisService) {}

	async acquireLock(
		cacheName: string,
		key: string,
		ttlSeconds: number,
		lockValue = randomUUID(),
	): Promise<string | null> {
		cacheName = "LOCK:" + cacheName;
		const acquired = await this.redisService.setKeyNX(cacheName, key, lockValue, ttlSeconds);
		return acquired ? lockValue : null;
	}

	async acquireLockWithRetry(
		cacheName: string,
		key: string,
		ttlSeconds: number,
		options: { maxWaitMs?: number; retryIntervalMs?: number } = {},
	): Promise<string | null> {
		const maxWaitMs = options.maxWaitMs ?? 60_000;
		const retryIntervalMs = options.retryIntervalMs ?? 1_000;
		const deadline = Date.now() + maxWaitMs;
		const lockValue = randomUUID();

		while (Date.now() < deadline) {
			const lock = await this.acquireLock(cacheName, key, ttlSeconds, lockValue);
			if (lock) {
				return lock;
			}
			await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
		}

		return null;
	}

	async releaseLock(cacheName: string, key: string, lockValue: string): Promise<boolean> {
		cacheName = 'LOCK:' + cacheName;
		const current = await this.redisService.getKey(cacheName, key);
		if (current !== lockValue) {
			return false;
		}
		return (await this.redisService.deleteKey(cacheName, key)) > 0;
	}
}
