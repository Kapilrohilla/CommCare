import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { KafkaProducerService } from '../../kafka/services/kafka-producer.service';
import { getEnabledSchedulerConfigs, SchedulerConfig } from '../../queue/scheduler-config';
import { env } from '../../../config/env.config';
import { buildRedisOptions } from '../../redis/redis.config';

/** Queue name for scheduled jobs */
const SCHEDULER_QUEUE_NAME = '{scheduler}';

/**
 * BullMQ Scheduler Service
 * Manages scheduled jobs that fire Kafka events
 *
 * Flow: Schedule triggers → Worker fires Kafka event → Normal processing
 */
@Injectable()
export class BullMQSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BullMQSchedulerService.name);
  private connection: IORedis | null = null;
  private schedulerQueue: Queue | null = null;
  private schedulerWorker: Worker | null = null;

  constructor(private readonly kafkaProducer: KafkaProducerService) {}

  async onModuleInit() {
    await this.init();
  }

  async onModuleDestroy() {
    await this.shutdown();
  }

  private async init(): Promise<void> {
    const enabled = env.BULLMQ_SCHEDULER_ENABLED;
    if (!enabled) {
      this.logger.log('BullMQ Scheduler disabled (set BULLMQ_SCHEDULER_ENABLED=true to enable)');
      return;
    }

    try {
      // Create Redis connection
      this.connection = new IORedis(buildRedisOptions({ maxRetriesPerRequest: null }));
      this.connection.on('error', (error) => {
        this.logger.warn('Redis connection error:', error instanceof Error ? error.message : error);
      });

      // Create scheduler queue
      this.schedulerQueue = new Queue(SCHEDULER_QUEUE_NAME, {
        connection: this.connection as any,
      });

      // Create worker to process scheduled jobs and fire Kafka events
      this.schedulerWorker = new Worker(
        SCHEDULER_QUEUE_NAME,
        async (job: Job) => {
          await this.handleScheduledJob(job);
        },
        {
          connection: this.connection as any,
          concurrency: 1, // Process one scheduled job at a time
        },
      );

      this.schedulerWorker.on('completed', (job) => {
        this.logger.debug(`Scheduled job completed: ${job.name}`);
      });

      this.schedulerWorker.on('failed', (job, error) => {
        this.logger.error(`Scheduled job failed: ${job?.name}`, error);
      });

      // Register all scheduled jobs
      await this.registerScheduledJobs();

      this.logger.log('BullMQ Scheduler initialized');
    } catch (error) {
      this.logger.error('Failed to initialize BullMQ Scheduler', error);
    }
  }

  /**
   * Handle a scheduled job by firing the corresponding Kafka event
   */
  private async handleScheduledJob(job: Job): Promise<void> {
    const { eventName, payload, scheduleName } = job.data as {
      eventName: string;
      payload: Record<string, unknown>;
      scheduleName: string;
    };

    this.logger.log(`Firing scheduled event: ${eventName} (schedule: ${scheduleName})`);

    try {
      // Fire Kafka event - follows normal flow from here
      await this.kafkaProducer.publishEvent(eventName, {
        ...payload,
        _scheduled: true,
        _scheduleName: scheduleName,
        _scheduledAt: new Date().toISOString(),
      });

      this.logger.log(`Scheduled event fired: ${eventName}`);
    } catch (error) {
      this.logger.error(`Failed to fire scheduled event: ${eventName}`, error);
      throw error;
    }
  }

  /**
   * Register all scheduled jobs from configuration
   */
  private async registerScheduledJobs(): Promise<void> {
    if (!this.schedulerQueue) return;

    const configs = getEnabledSchedulerConfigs();

    // Remove existing job schedulers to avoid duplicates
    const existingJobs = await this.schedulerQueue.getJobSchedulers();
    for (const job of existingJobs) {
      await this.schedulerQueue.removeJobScheduler(job.key);
      this.logger.debug(`Removed existing scheduled job: ${job.name ?? job.key}`);
    }

    // Register new scheduled jobs
    for (const config of configs) {
      await this.addScheduledJob(config);
    }

    this.logger.log(`Registered ${configs.length} scheduled jobs`);
  }

  /**
   * Add a single scheduled job
   */
  private async addScheduledJob(config: SchedulerConfig): Promise<void> {
    if (!this.schedulerQueue) return;

    const jobData = {
      eventName: config.eventName,
      payload: config.payload || {},
      scheduleName: config.name,
    };

    const repeatOptions: { pattern?: string; every?: number; limit?: number; tz?: string } = {};

    if (config.cron) {
      repeatOptions.pattern = config.cron;
      if (config.timezone) {
        repeatOptions.tz = config.timezone;
      }
    } else if (config.every) {
      repeatOptions.every = config.every;
    } else {
      this.logger.warn(`Schedule ${config.name} has no cron or every - skipping`);
      return;
    }

    if (config.limit) {
      repeatOptions.limit = config.limit;
    }

    await this.schedulerQueue.upsertJobScheduler(config.name, repeatOptions, {
      name: config.name,
      data: jobData,
      opts: {
        removeOnComplete: true,
        removeOnFail: false,
      },
    });

    const scheduleType = config.cron ? `cron: ${config.cron}` : `every: ${config.every}ms`;
    this.logger.log(`Scheduled: ${config.name} → ${config.eventName} (${scheduleType})`);
  }

  /**
   * Manually trigger a scheduled job (useful for testing)
   */
  async triggerScheduledJob(scheduleName: string): Promise<void> {
    const config = getEnabledSchedulerConfigs().find((c) => c.name === scheduleName);
    if (!config) {
      throw new Error(`Schedule not found: ${scheduleName}`);
    }

    this.logger.log(`Manually triggering scheduled job: ${scheduleName}`);

    await this.kafkaProducer.publishEvent(config.eventName, {
      ...config.payload,
      _scheduled: true,
      _scheduleName: scheduleName,
      _manualTrigger: true,
      _scheduledAt: new Date().toISOString(),
    });
  }

  /**
   * Get all registered scheduled jobs
   */
  async getScheduledJobs(): Promise<{ name: string; pattern?: string; every?: number; next?: Date }[]> {
    if (!this.schedulerQueue) return [];

    const jobs = await this.schedulerQueue.getJobSchedulers();
    return jobs.map((job) => ({
      name: job.name ?? job.key,
      pattern: job.pattern ?? undefined,
      every: job.every ?? undefined,
      next: job.next ? new Date(job.next) : undefined,
    }));
  }

  private async shutdown(): Promise<void> {
    try {
      if (this.schedulerWorker) {
        await this.schedulerWorker.close();
      }
      if (this.schedulerQueue) {
        await this.schedulerQueue.close();
      }
      if (this.connection) {
        this.connection.disconnect();
      }
      this.logger.log('BullMQ Scheduler shutdown complete');
    } catch (error) {
      this.logger.error('Error during scheduler shutdown', error);
    }
  }
}