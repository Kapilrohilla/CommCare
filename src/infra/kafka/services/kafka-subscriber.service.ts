import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { env } from '../../../config/env.config';
import { KafkaConsumerService, EventListener as KafkaEventListener } from './kafka-consumer.service';
import { getSubscriberConfigsByEvent } from '../../queue/subscriber-config';

@Injectable()
export class KafkaSubscriberService {
  private readonly logger = new Logger(KafkaSubscriberService.name);
  private readonly serviceCache = new Map<string, unknown>();
  private readonly defaultGroupId: string;
  private registered = false;

  constructor(private readonly moduleRef: ModuleRef) {
    this.defaultGroupId = env.KAFKA_GROUP_ID;
  }

  registerSubscriptions(): void {
    if (this.registered) {
      return;
    }
    this.registered = true;

    const mode = env.KAFKA_SUBSCRIBER;
    this.logger.log(`Initializing Kafka subscribers: ${mode}`);

    if (mode !== 'ALL' && mode !== 'DEFAULT') {
      this.logger.log('Kafka subscribers disabled');
      return;
    }

    const kafkaConsumer = this.moduleRef.get(KafkaConsumerService, { strict: false });
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

        kafkaConsumer.subscribeEvent(eventName, kafkaListener);
        subscriptionCount++;
        this.logger.debug(`Subscription: ${eventName} -> ${config.subscriberServiceName} [groupId: ${groupId}]`);
      }
    }

    this.logger.log(`Registered ${subscriptionCount} Kafka event subscriptions`);
  }

  private getService<T>(ServiceClass: new (...args: unknown[]) => T, serviceName: string): T | null {
    if (this.serviceCache.has(serviceName)) {
      return this.serviceCache.get(serviceName) as T;
    }

    try {
      const service = this.moduleRef.get(ServiceClass, { strict: false });
      this.serviceCache.set(serviceName, service);
      return service;
    } catch {
      this.logger.warn(`${serviceName} unavailable, skipping related subscriptions`);
      return null;
    }
  }
}
