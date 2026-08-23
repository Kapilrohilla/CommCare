import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { env } from '../../../config/env.config';
import { BullMQConsumerService } from './bullmq-consumer.service';
import { BullMQProducerService } from './bullmq-producer.service';
import { getSubscriberConfigsByEvent } from '../../queue/subscriber-config';

/**
 * BullMQ Subscriber Service
 * This service registers all BullMQ event subscriptions for the application
 * Configuration is loaded from queue/subscriberConfig.ts
 */
@Injectable()
export class BullMQSubscriberService implements OnModuleInit {
  private readonly logger = new Logger(BullMQSubscriberService.name);
  private readonly serviceCache = new Map<string, unknown>();

  constructor(
    private readonly moduleRef: ModuleRef,
    @Optional() private readonly bullmqConsumer?: BullMQConsumerService,
    @Optional() private readonly bullmqProducer?: BullMQProducerService,
  ) {
    // CRITICAL: Register subscriptions in constructor to ensure they happen
    // before BullMQConsumerService.init() runs (which happens in onModuleInit)
    // subscribeEvent() just stores data in Maps, so it's safe to call here
    // This ensures workers are created for all subscribed events
    this.init();
  }

  async onModuleInit() {}

  /**
   * Generic service resolver - dynamically resolves any service using ModuleRef
   * Caches resolved services to avoid repeated lookups
   */
  private getService<T>(ServiceClass: new (...args: unknown[]) => T, serviceName: string): T | null {
    const cacheKey = serviceName;
    if (this.serviceCache.has(cacheKey)) {
      return this.serviceCache.get(cacheKey) as T;
    }

    try {
      const service = this.moduleRef.get(ServiceClass, { strict: false });
      this.serviceCache.set(cacheKey, service);
      return service;
    } catch {
      this.logger.warn(`${serviceName} unavailable, skipping related subscriptions`);
      return null;
    }
  }

  private init(): void {
    const mode = env.BULLMQ_SUBSCRIBER;
    this.logger.log(`Initializing BullMQ subscribers: ${mode}`);
    if (mode === 'ALL' || mode === 'DEFAULT') {
      this.registerBullMQSubscribers();
    } else {
      this.logger.warn(`Unknown mode: ${mode}`);
    }
  }

  /**
   * Register BullMQ subscribers from the centralized configuration
   * All events are processed by BullMQ workers
   */
  private registerBullMQSubscribers(): void {
    if (!this.bullmqConsumer) {
      this.logger.warn('BullMQConsumer not available, skipping BullMQ subscriptions');
      return;
    }

    const configsByEvent = getSubscriberConfigsByEvent();
    let subscriptionCount = 0;

    for (const [eventName, configs] of configsByEvent) {
      for (const config of configs) {
        const service = this.getService(config.serviceClass, config.subscriberServiceName);
        if (!service) continue;

        this.bullmqConsumer.subscribeEvent(
          eventName,
          {
            listener: service as {
              [key: string]: (eventName: string, payload: unknown, retryCount: number) => Promise<unknown>;
            },
            subscriberServiceName: config.subscriberServiceName,
            serviceClass: config.serviceClass,
          },
          config.concurrency || config.limiter
            ? { ...(config.concurrency && { concurrency: config.concurrency }), ...(config.limiter && { limiter: config.limiter }) }
            : undefined,
        );

        if (config.maxAttempts && this.bullmqProducer) {
          this.bullmqProducer.setEventMaxAttempts(eventName, config.maxAttempts);
        }

        subscriptionCount++;
        this.logger.debug(`BullMQ worker: ${eventName} -> ${config.subscriberServiceName}`);
      }
    }

    this.logger.log(`Registered ${subscriptionCount} BullMQ workers`);
  }
}