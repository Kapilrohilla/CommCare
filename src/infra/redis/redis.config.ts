import { env } from '../../config/env.config';
import IORedis from 'ioredis';
import type { RedisOptions } from 'ioredis';

export function buildRedisOptions(overrides: Partial<RedisOptions> = {}): RedisOptions {
	const options: RedisOptions = {
		host: env.REDIS_HOST,
		port: env.REDIS_PORT,
		db: env.REDIS_DB,
		lazyConnect: true,
		enableOfflineQueue: false,
		...overrides,
	};

	if (env.REDIS_USERNAME) {
		options.username = env.REDIS_USERNAME;
	}
	if (env.REDIS_PASSWORD) {
		options.password = env.REDIS_PASSWORD;
	}
	if (env.REDIS_TLS) {
		options.tls = {};
	}

	return options;
}

export async function connectRedisClient(
	connection: IORedis,
	options?: { retries?: number; delayMs?: number },
): Promise<boolean> {
	const retries = options?.retries ?? 5;
	const delayMs = options?.delayMs ?? 2000;

	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
			if (connection.status === 'wait' || connection.status === 'close') {
				await connection.connect();
			}
			await connection.ping();
			return true;
		} catch {
			if (attempt < retries) {
				await new Promise((resolve) => setTimeout(resolve, delayMs));
			}
		}
	}

	return false;
}
