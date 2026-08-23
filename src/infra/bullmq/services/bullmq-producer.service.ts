import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Job } from 'bullmq';
// import { ClsService } from '../httpContext/httpContext';
import IORedis from 'ioredis';
import { randomUUID } from 'crypto';
import { env } from '../../../config/env.config';
import { buildRedisOptions } from '../../redis/redis.config';

/** BullMQ job configuration */
const JOB_CONFIG = {
  MAX_ATTEMPTS: 10,
  BACKOFF_DELAY: 5000,
  BACKOFF_TYPE: 'exponential' as const,
  REMOVE_ON_COMPLETE_AGE: 5 * 86400,
  REMOVE_ON_COMPLETE_COUNT: 100000,
  REMOVE_ON_FAIL: false,
  DLQ_SUFFIX: '-DLQ',
};

@Injectable()
export class BullMQProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BullMQProducerService.name);
  private connection: IORedis;
  private queueMap: Map<string, Queue> = new Map();
  private eventMaxAttempts: Map<string, number> = new Map();
  private readonly errorTypes = ['uncaughtException', 'unhandledRejection'];
  private readonly signalTraps = ['SIGTERM', 'SIGINT'];
  private isConnected = false;
  private signalsRegistered = false;

  constructor(
	// private readonly cls: ClsService
) {
    this.connection = new IORedis(buildRedisOptions({ maxRetriesPerRequest: null }));
    this.connection.on('connect', () => this.logger.log('Redis connection established for BullMQ'));
    this.connection.on('error', (error) => {
      if (!this.connection.status || this.connection.status === 'end') return;
      this.logger.warn('Redis connection error:', error instanceof Error ? error.message : error);
    });
  }

  async onModuleInit() {
    await this.connect({ retries: 3, delayMs: 1000 });
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  get ready(): boolean {
    return this.isConnected;
  }

  /** Connect to Redis and mark producer ready. Retries for startup when Redis is still booting. */
  async connect(options?: { retries?: number; delayMs?: number }): Promise<boolean> {
    if (this.isConnected) {
      return true;
    }

    const retries = options?.retries ?? 1;
    const delayMs = options?.delayMs ?? 1000;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (this.connection.status === 'wait' || this.connection.status === 'close') {
          await this.connection.connect();
        }
        await this.connection.ping();
        this.isConnected = true;
        this.logger.log('[bullmq-carrum-producer] Connected to Redis');
        this.registerSignalHandlers();
        return true;
      } catch {
        if (attempt < retries) {
          this.logger.debug(`Redis connect attempt ${attempt}/${retries} failed, retrying in ${delayMs}ms`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        this.logger.warn('[bullmq-carrum-producer] Redis connection failed. Producer unavailable.');
        return false;
      }
    }

    return false;
  }

  /** Register all known queues so Bull Board can monitor them. Call after connect(). */
  prepareMonitoringQueues(eventNames: string[]): Queue[] {
    const queueKeys = [
      ...eventNames,
      'scheduler',
      ...eventNames.map((eventName) => `${eventName}${JOB_CONFIG.DLQ_SUFFIX}`),
    ];

    return queueKeys.map((name) => this.getQueue(name));
  }

  private getQueue(queueName: string): Queue {
    if (!this.queueMap.has(queueName)) {
      try {
        const queue = new Queue(`{${queueName}}`, { connection: this.connection as any });
        this.queueMap.set(queueName, queue);
        this.logger.log(`Queue ${queueName} created`);
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        this.logger.error(`Error creating queue: ${queueName}`, error);
        throw new Error(`Failed to create queue: ${queueName}`);
      }
    }
    return this.queueMap.get(queueName)!;
  }

  getAllQueues(): Queue[] {
    return Array.from(this.queueMap.values());
  }

  setEventMaxAttempts(eventName: string, maxAttempts: number): void {
    this.eventMaxAttempts.set(eventName, maxAttempts);
  }

  async getQueueJobCounts(queueName: string): Promise<{ waiting: number; active: number; completed: number; failed: number; delayed: number }> {
    const queue = this.getQueue(queueName);
    const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
    return {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
    };
  }

  async getFailedJobs(
    queueName: string,
    start = 0,
    end = 99,
  ): Promise<
    {
      id: string | undefined;
      name: string;
      data: unknown;
      failedReason: string | undefined;
      attemptsMade: number;
      timestamp: number | undefined;
      finishedOn: number | undefined;
    }[]
  > {
    const queue = this.getQueue(queueName);
    const jobs = await queue.getFailed(start, end);
    return jobs.map((job) => ({
      id: job.id,
      name: job.name,
      data: job.data,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      finishedOn: job.finishedOn,
    }));
  }

  getConnection(): IORedis {
    return this.connection;
  }

  private async _enqueueJob(
    eventName: string,
    message: unknown,
    queueName: string,
    id: string | null = null,
    retryCount: number = 0,
    retrySubscriber: string | null = null,
  ): Promise<Job | undefined> {
    const queue = this.getQueue(queueName);
    const jobId = id || randomUUID();

    try {
      const delay = message && typeof message === 'object' && 'delay' in message ? Number((message as { delay?: number }).delay) || 0 : 0;
      this.logger.log(
        `[bullmq-carrum-producer] Enqueuing job: ${eventName} to queue: ${queueName}, jobId: ${jobId}, retryCount: ${retryCount}${delay > 0 ? `, delay: ${delay}ms` : ''}`,
      );
      const maxAttempts = this.eventMaxAttempts.get(eventName) ?? JOB_CONFIG.MAX_ATTEMPTS;
      const job = await queue.add(
        eventName,
        {
          id: jobId,
        //   request_id: (this.cls.get('request_id') as string) || randomUUID(),
        //   apiName: this.cls.get('apiName'),
          payload: message,
          timestamp: new Date().toISOString(),
          retryCount,
          retrySubscriber,
        },
        {
          jobId,
          delay,
          attempts: maxAttempts,
          backoff: { type: JOB_CONFIG.BACKOFF_TYPE, delay: JOB_CONFIG.BACKOFF_DELAY },
          removeOnComplete: { age: JOB_CONFIG.REMOVE_ON_COMPLETE_AGE, count: JOB_CONFIG.REMOVE_ON_COMPLETE_COUNT },
          removeOnFail: JOB_CONFIG.REMOVE_ON_FAIL,
        },
      );
      this.logger.log(`[bullmq-carrum-producer] Successfully enqueued job: ${job.id} for event: ${eventName}`);
      return job;
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      this.logger.error(`[bullmq-carrum-producer] Failed to enqueue job: ${error.message}`, error);
      return undefined;
    }
  }

  async publishEvent(eventName: string, message: unknown): Promise<Job | undefined> {
    const id = randomUUID();
    this.logger.log(`[bullmq-carrum-producer] Enqueuing job: ${eventName}`);
    return this._enqueueJob(eventName, message, eventName, id, 0, 'NONE');
  }

  async publishRetryEvent(eventName: string, message: unknown, id: string, retryCount: number, retrySubscriber: string): Promise<Job | undefined> {
    this.logger.log(`[bullmq-carrum-producer] Enqueuing retry job: ${eventName}, RetryCount: ${retryCount}`);
    return this._enqueueJob(eventName, message, eventName, id, retryCount, retrySubscriber);
  }

  async publishEventToDLQ(eventName: string, message: unknown, id: string, retryCount: number, retrySubscriber: string): Promise<Job | undefined> {
    const dlqName = `${eventName}${JOB_CONFIG.DLQ_SUFFIX}`;
    this.logger.warn(`[bullmq-carrum-producer] Enqueuing to DLQ: ${dlqName}`);
    return this._enqueueJob(eventName, message, dlqName, id, retryCount, retrySubscriber);
  }

  private registerSignalHandlers(): void {
    if (this.signalsRegistered) {
      return;
    }
    this.signalsRegistered = true;
    this.handleSignals();
  }
  private handleSignals(): void {
    this.errorTypes.forEach((type) => {
      process.on(type, async (e) => {
        try {
          this.logger.error(`process.on ${type}`, e);
          await this.disconnect();
          process.exit(0);
        } catch (_) {
          process.exit(1);
        }
      });
    });
    this.signalTraps.forEach((type) => {
      process.once(type, async () => {
        try {
          await this.disconnect();
        } finally {
          process.kill(process.pid, type);
        }
      });
    });
  }

  private async disconnect(): Promise<void> {
    try {
      for (const queue of this.queueMap.values()) {
        try {
          await queue.close();
        } catch (e) {
          this.logger.warn('[bullmq-carrum-producer] Error closing queue:', e);
        }
      }
      if (this.connection && this.connection.status !== 'end') {
        await this.connection.quit();
      }
      this.logger.log('[bullmq-carrum-producer] Disconnected from Redis');
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      this.logger.warn('[bullmq-carrum-producer] Error during disconnect:', error);
    }
  }
}