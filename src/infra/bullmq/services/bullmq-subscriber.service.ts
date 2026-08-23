import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { env } from '../../../config/env.config';
import { BullMQConsumerService } from './bullmq-consumer.service';
import { BullMQProducerService } from './bullmq-producer.service';
import { getSubscriberConfigsByEvent } from '../../queue/subscriber-config';

@Injectable()
export class BullMQSubscriberService {
  private readonly logger = new Logger(BullMQSubscriberService.name);
  private readonly serviceCache = new Map<string, unknown>();
  private registered = false;

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly bullmqProducer: BullMQProducerService,
  ) {}

  registerSubscriptions(): void {
    if (this.registered) {
      return;
    }
    this.registered = true;

    const mode = env.BULLMQ_SUBSCRIBER;
    this.logger.log(`Initializing BullMQ subscribers: ${mode}`);

    if (mode !== 'ALL' && mode !== 'DEFAULT') {
      this.logger.log('BullMQ subscribers disabled');
      return;
    }

    const bullmqConsumer = this.moduleRef.get(BullMQConsumerService, { strict: false });
    const configsByEvent = getSubscriberConfigsByEvent();
    let subscriptionCount = 0;

    for (const [eventName, configs] of configsByEvent) {
      for (const config of configs) {
        const service = this.getService(config.serviceClass, config.subscriberServiceName);
        if (!service) continue;

        bullmqConsumer.subscribeEvent(
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

        if (config.maxAttempts) {
          this.bullmqProducer.setEventMaxAttempts(eventName, config.maxAttempts);
        }

        subscriptionCount++;
        this.logger.debug(`BullMQ worker: ${eventName} -> ${config.subscriberServiceName}`);
      }
    }

    this.logger.log(`Registered ${subscriptionCount} BullMQ worker subscriptions`);
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
