import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { env } from '../../../config/env.config';
import { KafkaConsumerService, EventListener as KafkaEventListener } from './kafka-consumer.service';
import { getSubscriberConfigsByEvent } from '../../queue/subscriber-config';

/**
 * Kafka Subscriber Service
 * This service registers all Kafka event subscriptions for the application
 * Configuration is loaded from queue/subscriberConfig.ts
 */
@Injectable()
export class KafkaSubscriberService implements OnModuleInit {
  private readonly logger = new Logger(KafkaSubscriberService.name);
  private readonly serviceCache = new Map<string, unknown>();
  private readonly defaultGroupId: string;

  constructor(
    private readonly moduleRef: ModuleRef,
    @Optional() private readonly kafkaConsumer?: KafkaConsumerService,
  ) {
    this.defaultGroupId = env.KAFKA_GROUP_ID;
    // Register subscriptions in constructor to ensure they happen early
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
    const mode = env.KAFKA_SUBSCRIBER;
    this.logger.log(`Initializing Kafka subscribers: ${mode}`);
    if (mode === 'ALL' || mode === 'DEFAULT') {
      this.registerKafkaSubscribers();
    } else {
      this.logger.warn(`Unknown mode: ${mode}`);
    }
  }

  /**
   * Register Kafka subscribers from the centralized configuration
   * All events flow: Kafka → BullMQ Worker → Handler
   */
  private registerKafkaSubscribers(): void {
    if (!this.kafkaConsumer) {
      this.logger.warn('KafkaConsumer not available, skipping Kafka subscriptions');
      return;
    }

    const configsByEvent = getSubscriberConfigsByEvent();
    let subscriptionCount = 0;

    for (const [eventName, configs] of configsByEvent) {
      for (const config of configs) {
        const service = this.getService(config.serviceClass, config.subscriberServiceName);
        if (!service) continue;

        const groupId = config.groupId || this.defaultGroupId;

        const kafkaListener: KafkaEventListener = {
          listener: service as {
            [key: string]: (eventName: string, payload: unknown, retryCount: number) => Promise<unknown>;
          },
          subscriberServiceName: config.subscriberServiceName,
          retry: config.retry,
          delay: config.delay,
          serviceClass: config.serviceClass,
        };

        this.kafkaConsumer.subscribeEvent(eventName, kafkaListener);
        subscriptionCount++;
        this.logger.debug(`Subscription: ${eventName} -> ${config.subscriberServiceName} [groupId: ${groupId}]`);
      }
    }

    this.logger.log(`Registered ${subscriptionCount} event subscriptions`);
  }
}