import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Worker, Job, DelayedError } from 'bullmq';
import { ClsService } from '../../../shared/context/cls.service';
import IORedis from 'ioredis';
import { env } from '../../../config/env.config';
import { buildRedisOptions } from '../../redis/redis.config';
import { DelayedRetryError } from '../delayedRetryError';

export interface EventListener {
  listener: {
    [key: string]: (eventName: string, payload: unknown, retryCount: number) => Promise<unknown>;
  };
  subscriberServiceName: string;
  serviceClass?: new (...args: unknown[]) => unknown; // Store service class for fresh resolution
}

export interface SubscribeEventOptions {
  concurrency?: number;
  limiter?: { max: number; duration: number };
}

export interface CsvBatchTracker {
  recordSuccess(uploadBatchId: string): Promise<void>;
  recordFailure(
    uploadBatchId: string,
    failure: { sourceRow: number; eventName: string; reason: string; attemptsMade: number; payload: Record<string, unknown>; failedAt: string },
  ): Promise<void>;
}

export const CSV_BATCH_TRACKER_TOKEN = 'CSV_BATCH_TRACKER_TOKEN';

@Injectable()
export class BullMQConsumerService implements OnModuleInit {
  private readonly logger = new Logger(BullMQConsumerService.name);
  private connection: IORedis | null = null;
  private listenerConfig: Map<string, EventListener[]> = new Map();
  private optionsConfig: Map<string, SubscribeEventOptions> = new Map();
  private workers: Worker[] = [];
  private readonly errorTypes = ['uncaughtException', 'unhandledRejection'];
  private readonly signalTraps = ['SIGTERM', 'SIGINT'];
  private batchTracker: CsvBatchTracker | null = null;

  constructor(
    private readonly cls: ClsService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async onModuleInit() {
    try {
      this.batchTracker = this.moduleRef.get(CSV_BATCH_TRACKER_TOKEN, { strict: false });
    } catch {
      this.logger.log('[bullmq-carrum-consumer] CsvBatchTracker not available, batch tracking disabled');
    }
    await this.init();
  }

  /**
   * Subscribe to an event for BullMQ processing
   *
   * This method stores listener configuration in listenerConfig Map.
   * During init(), workers are created from this Map for each registered event.
   *
   * IMPORTANT: This must be called BEFORE init() runs (typically during module initialization)
   * to ensure workers are created and ready to process jobs when they arrive.
   *
   * @param eventName - The event name to subscribe to
   * @param listener - The event listener configuration
   * @param options - Optional configuration (concurrency, etc.)
   */
  subscribeEvent(eventName: string, listener: EventListener, options?: SubscribeEventOptions): void {
    if (!this.listenerConfig.has(eventName)) {
      this.listenerConfig.set(eventName, []);
    }
    this.listenerConfig.get(eventName)!.push(listener);
    if (options) {
      this.optionsConfig.set(eventName, options);
    }
    this.logger.log(
      `[bullmq-carrum-consumer] Subscribed: ${eventName} -> ${listener.subscriberServiceName} (Total subscriptions: ${this.listenerConfig.size})`,
    );
  }

  /**
   * Generic error handler for BullMQ event handlers
   * Normalizes errors, logs them, and re-throws for worker retry logic
   */
  static handleEventError(error: unknown, eventName: string, serviceName: string): never {
    const err = error instanceof Error ? error : new Error(String(error));
    const logger = new Logger('BullMQConsumerService');
    logger.error(`[${serviceName}] Error handling ${eventName}:`, err);
    throw err;
  }

  private async init(): Promise<void> {
    if (!env.BULLMQ_CONSUMERS_ENABLED) {
      this.logger.log('BullMQ consumers disabled');
      return;
    }

    this.connection = new IORedis(buildRedisOptions({ maxRetriesPerRequest: null }));
    this.connection.on('error', (error) => {
      this.logger.warn('Redis connection error:', error instanceof Error ? error.message : error);
    });

    try {
      await this.connection.ping();
      this.logger.log('[bullmq-carrum-consumer] Connected to Redis');

      if (this.listenerConfig.size === 0) {
        this.logger.warn('[bullmq-carrum-consumer] No event subscriptions found. No workers will be created.');
        this.logger.warn('[bullmq-carrum-consumer] Make sure subscriptions are registered before BullMQConsumerService.init() runs.');
      }
      for (const [eventName, listeners] of this.listenerConfig.entries()) {
        const options = this.optionsConfig.get(eventName);
        const concurrency = options?.concurrency || env.BULLMQ_WORKER_CONCURRENCY;

        const limiter = options?.limiter;
        this.logger.log(
          `[bullmq-carrum-consumer] Initializing worker: ${eventName} (${listeners.length} listeners, concurrency: ${concurrency}${limiter ? `, limiter: ${limiter.max}/${limiter.duration}ms` : ''})`,
        );

        const worker = new Worker(
          `{${eventName}}`,
          async (job: Job, token?: string) => {
            try {
              return await this.cls.run(async () => {
                const {
                  id,
                  request_id,
                  apiName,
                  payload,
                  retryCount = 0,
                } = job.data as {
                  id?: string;
                  request_id?: string;
                  apiName?: string;
                  payload?: unknown;
                  retryCount?: number;
                };

                this.logger.log(`[bullmq-carrum-consumer] Processing job: ${job.id} for event: ${eventName}, retryCount: ${retryCount}`);
                const startTime = Date.now();
                const delay =
                  job.data && typeof job.data === 'object' && 'delay' in job.data ? Number((job.data as { delay?: number }).delay) || 0 : 0;

                this.setContext(request_id, apiName, eventName, {
                  messageId: id,
                  jobId: job.id,
                  retryCount,
                  timestamp: new Date().toISOString(),
                  queueName: eventName,
                  attemptsMade: job.attemptsMade,
                  delay,
                });

                for (const listener of listeners) {
                  try {
                    // Set subscriber service in context for logging
                    this.cls.set('eventSubscriberService', listener.subscriberServiceName);

                    // Convert event name to handler method name (PascalCase after handleEvent)
                    const eventNameClean = eventName.replace(/\./g, '');
                    const handlerMethodName = `handleEvent${eventNameClean.charAt(0).toUpperCase()}${eventNameClean.slice(1)}`;

                    // CRITICAL: Resolve service instance fresh from ModuleRef to ensure proper context
                    // Stored instances in Maps can lose their prototype chain/context
                    let serviceInstance = listener.listener;
                    if (listener.serviceClass) {
                      try {
                        serviceInstance = this.moduleRef.get(listener.serviceClass, { strict: false });
                      } catch (e) {
                        this.logger.warn(
                          `[bullmq-carrum-consumer] Could not resolve service class for ${listener.subscriberServiceName}, using stored instance`,
                          e,
                        );
                      }
                    }

                    // Verify the service instance exists
                    if (!serviceInstance) {
                      throw new Error(`Service instance is undefined for ${listener.subscriberServiceName}`);
                    }

                    // Verify the handler method exists
                    if (typeof serviceInstance[handlerMethodName] !== 'function') {
                      throw new Error(`Handler ${handlerMethodName} not found for ${listener.subscriberServiceName}`);
                    }

                    const listenerStartTime = Date.now();
                    const payloadData =
                      payload && typeof payload === 'object' && 'payload' in payload ? (payload as { payload?: unknown }).payload : payload;

                    // Call handler directly on service instance - this preserves 'this' context
                    this.logger.log(`[bullmq-carrum-consumer] Processing ${eventName} with handler: ${listener.subscriberServiceName}`);
                    await (serviceInstance as any)[handlerMethodName](eventName, payloadData, retryCount);

                    const duration = Date.now() - listenerStartTime;
                    this.logger.log(`[bullmq-carrum-consumer] Processed ${eventName}/${listener.subscriberServiceName} in ${duration}ms`);
                  } catch (err) {
                    const error = err instanceof Error ? err : new Error(String(err));
                    this.logger.error(
                      `[bullmq-carrum-consumer] ${eventName} listener ${listener.subscriberServiceName} failed: ${error.message}`,
                      error,
                    );
                    throw error;
                  }
                }

                const duration = Date.now() - startTime;
                this.logger.log(`[bullmq-carrum-consumer] Group processed ${eventName} in ${duration}ms (id: ${id}, retry: ${retryCount})`);
                return { success: true, eventName, id };
              });
            } catch (error) {
              if (error instanceof DelayedRetryError) {
                this.logger.warn(`[bullmq-carrum-consumer] Job ${job.id} requesting delayed retry (${error.delayMs}ms): ${error.message}`);
                await job.moveToDelayed(Date.now() + error.delayMs, token);
                throw new DelayedError();
              }
              this.logger.error(
                `[bullmq-carrum-consumer] Job ${job.id} processing failed: ${error instanceof Error ? error.message : String(error)}`,
                error,
              );
              throw error;
            }
          },
          { connection: this.connection as any, concurrency, ...(limiter && { limiter }) },
        );

        worker.on('completed', async (job) => {
          this.logger.log(`[bullmq-carrum-consumer] Job ${job.id} completed: ${eventName}`);
          await this.recordBatchSuccess(job);
        });
        worker.on('failed', async (job, err) => {
          this.logger.error(`[bullmq-carrum-consumer] Job ${job?.id} failed: ${eventName}`, err);
          await this.recordBatchFailure(job, err, eventName);
        });
        worker.on('active', (job) => this.logger.log(`[bullmq-carrum-consumer] Job ${job.id} is now active: ${eventName}`));
        worker.on('stalled', (jobId) => this.logger.warn(`[bullmq-carrum-consumer] Job ${jobId} stalled: ${eventName}`));

        this.workers.push(worker);
        this.logger.log(`[bullmq-carrum-consumer] Worker started: ${eventName}`);
      }

      this.handleSignals();
    } catch (_error) {
      this.logger.warn('[bullmq-carrum-consumer] Initialization failed. Consumers unavailable.');
    }
  }

  private setContext(
    request_id: string | undefined,
    apiName: string | undefined,
    eventName: string,
    extra?: {
      messageId?: string;
      jobId?: string;
      retryCount?: number;
      timestamp?: string;
      queueName?: string;
      attemptsMade?: number;
      delay?: number;
      subscriberService?: string;
    },
  ): void {
    this.cls.set('request_id', request_id);
    this.cls.set('apiName', apiName);
    this.cls.set('eventSource', 'BULLMQ');
    this.cls.set('eventName', eventName);
    this.cls.set('eventGroupId', extra?.queueName || eventName);

    if (extra) {
      if (extra.messageId) this.cls.set('eventMessageId', extra.messageId);
      if (extra.retryCount !== undefined) this.cls.set('eventRetryCount', extra.retryCount);
      if (extra.timestamp) this.cls.set('eventTimestamp', extra.timestamp);
      if (extra.subscriberService) this.cls.set('eventSubscriberService', extra.subscriberService);
      if (extra.queueName) this.cls.set('bullmqQueueName', extra.queueName);
      if (extra.jobId) this.cls.set('bullmqJobId', extra.jobId);
      if (extra.attemptsMade !== undefined) this.cls.set('bullmqAttemptsMade', extra.attemptsMade);
      if (extra.delay !== undefined) this.cls.set('bullmqDelay', extra.delay);
    }
  }

  private extractBatchMeta(job: Job): { uploadBatchId: string; sourceRow: number; innerPayload: Record<string, unknown> } | null {
    const innerPayload = job.data?.payload?.payload ?? job.data?.payload;
    if (!innerPayload?.uploadBatchId || !this.batchTracker) return null;
    return { uploadBatchId: innerPayload.uploadBatchId, sourceRow: innerPayload.sourceRow ?? 0, innerPayload };
  }

  private async recordBatchSuccess(job: Job): Promise<void> {
    const meta = this.extractBatchMeta(job);
    if (!meta) return;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.batchTracker!.recordSuccess(meta.uploadBatchId);
        return;
      } catch (e) {
        this.logger.warn(`[bullmq-carrum-consumer] recordSuccess attempt ${attempt}/3 failed for job ${job.id}: ${e}`);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
    this.logger.error(`[bullmq-carrum-consumer] recordSuccess permanently failed for job ${job.id}, batch ${meta.uploadBatchId}`);
  }

  private async recordBatchFailure(job: Job | undefined, err: Error, eventName: string): Promise<void> {
    if (!job) return;
    const meta = this.extractBatchMeta(job);
    if (!meta) return;

    if (err?.message?.startsWith('DEFERRED_429:')) {
      await this.recordBatchSuccess(job);
      return;
    }

    const jobState = await job.getState().catch(() => 'unknown');
    if (jobState !== 'failed') return;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.batchTracker!.recordFailure(meta.uploadBatchId, {
          sourceRow: meta.sourceRow,
          eventName,
          reason: err?.message ?? 'Unknown error',
          attemptsMade: job.attemptsMade,
          payload: this.stripTrackingFields(meta.innerPayload),
          failedAt: new Date().toISOString(),
        });
        return;
      } catch (e) {
        this.logger.warn(`[bullmq-carrum-consumer] recordFailure attempt ${attempt}/3 failed for job ${job.id}: ${e}`);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
    this.logger.error(`[bullmq-carrum-consumer] recordFailure permanently failed for job ${job.id}, batch ${meta.uploadBatchId}`);
  }

  private stripTrackingFields(payload: unknown): Record<string, unknown> {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return {};
    }
    const { uploadBatchId: _, sourceRow: _s, ...rest } = payload as Record<string, unknown>;
    return rest;
  }

  private handleSignals(): void {
    this.errorTypes.forEach((type) => {
      process.on(type, async (e) => {
        try {
          this.logger.error(`process.on ${type}`, e);
          for (const worker of this.workers) {
            try {
              await worker.close();
            } catch (err) {
              this.logger.warn('[bullmq-carrum-consumer] Error closing worker:', err);
            }
          }
          if (this.connection && this.connection.status !== 'end') {
            await this.connection.quit();
          }
          this.logger.log('[bullmq-carrum-consumer] Shut down cleanly');
          process.exit(0);
        } catch (_) {
          process.exit(1);
        }
      });
    });
    this.signalTraps.forEach((type) => {
      process.once(type, async () => {
        try {
          for (const worker of this.workers) {
            try {
              await worker.close();
            } catch (e) {
              this.logger.warn('[bullmq-carrum-consumer] Error closing worker:', e);
            }
          }
          if (this.connection && this.connection.status !== 'end') {
            await this.connection.quit();
          }
          this.logger.log('[bullmq-carrum-consumer] Shut down cleanly');
        } catch (e) {
          const error = e instanceof Error ? e : new Error(String(e));
          this.logger.warn('[bullmq-carrum-consumer] Error during disconnect:', error);
        } finally {
          process.kill(process.pid, type);
        }
      });
    });
  }
}