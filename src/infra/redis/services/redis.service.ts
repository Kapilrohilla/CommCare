import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { env } from '../../../config/env.config';
import { Environment } from '../../../constants/environmentConstants';
import { buildRedisOptions } from '../redis.config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private subscriber: Redis | null = null;
  private hasWarnedAboutConnection = false;

  constructor() {}

  async onModuleInit() {
    await this.initializeConnections();
  }

  onModuleDestroy() {
    this.closeConnections();
  }

  private createRedisConfig() {
    return buildRedisOptions({
      retryStrategy: (times: number) => Math.min(times * 100, 5000),
      enableReadyCheck: false,
      maxRetriesPerRequest: 3,
    });
  }

  private setupClientHandlers(client: Redis, name: string) {
    client.on('connect', () => {
      this.logger.log(`Redis ${name} connected`);
      this.hasWarnedAboutConnection = false;
    });

    client.on('error', (error: unknown) => {
      const isConnectionRefused = error && typeof error === 'object' && 'code' in error && error.code === 'ECONNREFUSED';
      if (isConnectionRefused && !this.hasWarnedAboutConnection) {
        this.logger.warn('Redis unavailable. Queue functionality disabled. Start with: docker compose up -d');
        this.hasWarnedAboutConnection = true;
      } else if (!isConnectionRefused) {
        this.logger.error(`Redis ${name} error:`, error);
      }
    });
  }

  private async initializeConnections() {
    try {
      const redisConfig = this.createRedisConfig();
      this.client = new Redis(redisConfig);
      this.subscriber = new Redis(redisConfig);

      this.setupClientHandlers(this.client, 'client');
      this.setupClientHandlers(this.subscriber, 'subscriber');

      try {
        await Promise.race([
          Promise.all([this.client.connect(), this.subscriber.connect()]),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 5000)),
        ]);
        this.logger.log('Redis connections initialized');
      } catch {
        if (env.ENV === Environment.LOCAL) {
          this.logger.warn('Redis connection failed. App continues without Redis.');
        } else {
          throw new Error('Redis connection failed. Required in non-development environments.');
        }
      }
    } catch (error) {
      if (env.ENV !== Environment.LOCAL) {
        throw error;
      }
      this.logger.warn('Redis initialization failed. App continues without Redis.');
    }
  }

  private async closeConnections() {
    await Promise.all([
      this.client?.quit().then(() => this.logger.log('Redis client disconnected')),
      this.subscriber?.quit().then(() => this.logger.log('Redis subscriber disconnected')),
    ]);
  }

  getClient(): Redis {
    if (!this.client) {
      throw new Error('Redis client not initialized. Make sure Redis is running.');
    }
    return this.client;
  }

  getSubscriber(): Redis {
    if (!this.subscriber) {
      throw new Error('Redis subscriber not initialized. Make sure Redis is running.');
    }
    return this.subscriber;
  }

  async isConnected(): Promise<boolean> {
    if (!this.client) {
      this.logger.debug('Redis client not initialized, connection check failed');
      return false;
    }
    try {
      const result = await this.client.ping();
      const connected = result === 'PONG';
      if (connected) {
        this.logger.debug('Redis connection check: connected');
      } else {
        this.logger.debug('Redis connection check: not connected');
      }
      return connected;
    } catch (error) {
      this.logger.debug('Redis connection check failed:', error);
      return false;
    }
  }

  async getRawKey<T = string>(key: string): Promise<{ resolvedKey: string; value: T } | null> {
    if (!this.client) throw new Error('Redis client not initialized');
    const keysToTry = [key, this.constructKey('CONFIG_VALUE_KEY', key)];
    try {
      for (const candidate of keysToTry) {
        const result = await this.client.get(candidate);
        if (result && result.length > 0) {
          this.logger.debug(`Raw key resolved: ${candidate}`);
          try {
            return { resolvedKey: candidate, value: JSON.parse(result) as T };
          } catch {
            return { resolvedKey: candidate, value: result as T };
          }
        }
      }
      this.logger.debug(`Raw key not found, tried: ${keysToTry.join(', ')}`);
      return null;
    } catch (error) {
      this.logger.error(`Error getting raw key ${key}:`, error);
      return null;
    }
  }

  async setRawKey(key: string, value: unknown, expiryInSeconds?: number): Promise<void> {
    if (!this.client) throw new Error('Redis client not initialized');
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      if (expiryInSeconds) {
        await this.client.setex(key, expiryInSeconds, serialized);
        this.logger.debug(`Raw key set with expiry: ${key}, TTL: ${expiryInSeconds}s`);
      } else {
        await this.client.set(key, serialized);
        this.logger.debug(`Raw key set: ${key}`);
      }
    } catch (error) {
      this.logger.error(`Error setting raw key ${key}:`, error);
      throw error;
    }
  }

  async deleteRawKey(key: string): Promise<number> {
    if (!this.client) throw new Error('Redis client not initialized');
    try {
      const result = await this.client.del(key);
      this.logger.debug(`Raw key deleted: ${key}, deleted count: ${result}`);
      return result;
    } catch (error) {
      this.logger.error(`Error deleting raw key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Construct Redis key with optional namespace
   */
  private constructKey(cacheName: string, key: string): string {
    // CACHE_NS is not in .env, so keeping original behavior
    return `${cacheName}_${key}`;
  }

  /**
   * Get a key from Redis
   */
  async getKey<T = string>(cacheName: string, key: string): Promise<T | null> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }
    try {
      const redisKey = this.constructKey(cacheName, key);
      const result = await this.client.get(redisKey);
      if (!result || result.length === 0) {
        this.logger.debug(`Key not found: ${redisKey}`);
        return null;
      }
      try {
        const parsed = JSON.parse(result) as T;
        this.logger.debug(`Key retrieved: ${redisKey}`);
        return parsed;
      } catch {
        this.logger.debug(`Key retrieved (raw): ${redisKey}`);
        return result as T;
      }
    } catch (error) {
      this.logger.error(`Error getting key ${this.constructKey(cacheName, key)}:`, error);
      return null;
    }
  }

  /**
   * Set a key in Redis with expiry
   */
  async setKey(cacheName: string, key: string, value: unknown, expiryInSeconds?: number): Promise<void> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      const redisKey = this.constructKey(cacheName, key);
      if (expiryInSeconds) {
        await this.client.setex(redisKey, expiryInSeconds, serialized);
        this.logger.debug(`Key set with expiry: ${redisKey}, TTL: ${expiryInSeconds}s`);
      } else {
        await this.client.set(redisKey, serialized);
        this.logger.debug(`Key set: ${redisKey}`);
      }
    } catch (error) {
      this.logger.error(`Error setting key ${this.constructKey(cacheName, key)}:`, error);
      throw error;
    }
  }

  /**
   * Delete a key from Redis
   */
  async deleteKey(cacheName: string, key: string): Promise<number> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }
    try {
      const redisKey = this.constructKey(cacheName, key);
      const result = await this.client.del(redisKey);
      this.logger.debug(`Key deleted: ${redisKey}, deleted count: ${result}`);
      return result;
    } catch (error) {
      this.logger.error(`Error deleting key ${this.constructKey(cacheName, key)}:`, error);
      throw error;
    }
  }

  /**
   * Get TTL (Time To Live) of a key in seconds
   * Returns -1 if key exists but has no expiry, -2 if key doesn't exist, or the remaining seconds
   */
  async getKeyTtl(cacheName: string, key: string): Promise<number> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }
    try {
      const redisKey = this.constructKey(cacheName, key);
      const ttl = await this.client.ttl(redisKey);
      this.logger.debug(`Key TTL: ${redisKey}, remaining seconds: ${ttl}`);
      return ttl;
    } catch (error) {
      this.logger.error(`Error getting TTL for key ${this.constructKey(cacheName, key)}:`, error);
      return -2; // Key doesn't exist
    }
  }

  /**
   * Get or set Redis value (cache-aside pattern)
   */
  async getOrSetRedis<T>(
    cacheName: string,
    key: string,
    storeFunction: () => Promise<T>,
    redisExpiry?: number,
    forceSet: boolean = false,
  ): Promise<T | null> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    const redisKey = this.constructKey(cacheName, key);
    let result: T | null = forceSet ? null : await this.getKey<T>(cacheName, key);

    if (result === null && storeFunction) {
      this.logger.debug(`Cache miss for key: ${redisKey}, executing store function`);
      result = await storeFunction();
      if (result === null || result === undefined) {
        this.logger.debug(`Store function returned null/undefined for key: ${redisKey}`);
        return result;
      }
      this.logger.debug(`Setting cache for key ${redisKey}${redisExpiry ? ` with expiry: ${redisExpiry}s` : ''}`);
      await this.setKey(cacheName, key, result, redisExpiry);
    } else if (result !== null) {
      this.logger.debug(`Cache hit for key: ${redisKey}`);
    }

    return result;
  }

  /**
   * Set Redis cache with a function
   */
  async setRedisCache<T>(cacheName: string, key: string, storeFunction: () => T | Promise<T>, redisExpiry?: number): Promise<T | null> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    const redisKey = this.constructKey(cacheName, key);
    let result: T | null = null;
    if (storeFunction) {
      this.logger.debug(`Executing store function for key: ${redisKey}`);
      result = await Promise.resolve(storeFunction());
      if (result !== null && result !== undefined) {
        this.logger.debug(`Setting cache for key: ${redisKey}${redisExpiry ? ` with expiry: ${redisExpiry}s` : ''}`);
        await this.setKey(cacheName, key, result, redisExpiry);
      } else {
        this.logger.debug(`Store function returned null/undefined for key: ${redisKey}`);
      }
    }
    return result;
  }
  async incrementKey(cacheName: string, key: string, incrementBy = 1) {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    const redisKey = this.constructKey(cacheName, key);
    return await this.client.incrby(redisKey, incrementBy);
  }

  /** Append to a Redis list (e.g. etrans results per vehicle). */
  async listPush(cacheName: string, key: string, value: string): Promise<number> {
    if (!this.client) throw new Error('Redis client not initialized');
    const redisKey = this.constructKey(cacheName, key);
    return await this.client.rpush(redisKey, value);
  }

  /** Get all elements of a Redis list. */
  async listRange(cacheName: string, key: string): Promise<string[]> {
    if (!this.client) throw new Error('Redis client not initialized');
    const redisKey = this.constructKey(cacheName, key);
    return await this.client.lrange(redisKey, 0, -1);
  }
  /** Expire a key in Redis. */
  async expireKey(cacheName: string, key: string, expiryInSeconds: number): Promise<void> {
    if (!this.client) throw new Error('Redis client not initialized');
    const redisKey = this.constructKey(cacheName, key);
    await this.client.expire(redisKey, expiryInSeconds);
  }

  /**
   * Set a key only if it does NOT exist (atomic NX lock).
   * Returns true  → key was set (you acquired the lock)
   * Returns false → key already existed (someone else has it)
   */
  async setKeyNX(cacheName: string, key: string, value: string, expiryInSeconds: number): Promise<boolean> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }
    try {
      const redisKey = this.constructKey(cacheName, key);
      const result = await this.client.set(redisKey, value, 'EX', expiryInSeconds, 'NX');
      this.logger.debug(`setKeyNX ${redisKey}: ${result === 'OK' ? 'acquired' : 'already exists'}`);
      return result === 'OK';
    } catch (error) {
      this.logger.error(`Error in setKeyNX for key ${this.constructKey(cacheName, key)}:`, error);
      throw error;
    }
  }
  /**
   * Add members to a set.
   * Returns 1 if member was added, 0 if it was already in the set.
   */
  async sAdd(cacheName: string, key: string, value: string | number): Promise<number> {
    if (!this.client) throw new Error('Redis client not initialized');
    try {
      const redisKey = this.constructKey(cacheName, key);
      const result = await this.client.sadd(redisKey, String(value));
      this.logger.debug(`sAdd to ${redisKey}: member ${value}, result ${result}`);
      return result;
    } catch (error) {
      this.logger.error(`Error in sAdd for key ${this.constructKey(cacheName, key)}:`, error);
      throw error;
    }
  }

  /**
   * Get the number of members in a set (Set Cardinality).
   */
  async sCard(cacheName: string, key: string): Promise<number> {
    if (!this.client) throw new Error('Redis client not initialized');
    try {
      const redisKey = this.constructKey(cacheName, key);
      const result = await this.client.scard(redisKey);
      this.logger.debug(`sCard for ${redisKey}: count ${result}`);
      return result;
    } catch (error) {
      this.logger.error(`Error in sCard for key ${this.constructKey(cacheName, key)}:`, error);
      throw error;
    }
  }
}