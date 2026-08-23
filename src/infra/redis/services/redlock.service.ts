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
		const acquired = await this.redisService.setKeyNX(cacheName, key, lockValue, ttlSeconds);
		return acquired ? lockValue : null;
	}

	async releaseLock(cacheName: string, key: string, lockValue: string): Promise<boolean> {
		const current = await this.redisService.getKey(cacheName, key);
		if (current !== lockValue) {
			return false;
		}
		return (await this.redisService.deleteKey(cacheName, key)) > 0;
	}
}
