import { env } from '../../config/env.config';
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
