import { Injectable, Logger } from '@nestjs/common';
import { KafkaProducerService } from '../../kafka/services/kafka-producer.service';

/** Optional BullMQ job delay after Kafka → worker handoff (ms). */
export interface EventPublishOptions {
  delayMs?: number;
}

/**
 * Event Producer Interface
 * Common interface for publishing events
 */
export interface IEventProducer {
  publish(eventName: string, payload: unknown, options?: EventPublishOptions): Promise<void>;
}

/**
 * Event Producer Service
 * Unified interface for publishing events to the message queue
 *
 * Usage:
 * ```typescript
 * import { EventProducer } from '../../../infra/queue/eventProducer';
 * import { Events } from '../../../infra/queue/eventsConstants';
 *
 * constructor(private readonly eventProducer: EventProducer) {}
 *
 * await this.eventProducer.publish(Events.userCreated, { userId: '123' });
 * ```
 */
@Injectable()
export class EventProducer implements IEventProducer {
  private readonly logger = new Logger(EventProducer.name);

  constructor(private readonly kafkaProducer: KafkaProducerService) {}

  /**
   * Publish an event to the message queue (Kafka → BullMQ consumer applies optional job delay).
   * @param options.delayMs - When set, merged onto payload as `delay` for BullMQ; handlers should ignore/strip it.
   */
  async publish(eventName: string, payload: unknown, options?: EventPublishOptions): Promise<void> {
    try {
      let message: unknown = payload;
      const delayMs = options?.delayMs;
      if (delayMs != null && delayMs > 0) {
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          message = { ...(payload as Record<string, unknown>), delay: delayMs };
        } else {
          message = { payload, delay: delayMs };
        }
      }
      await this.kafkaProducer.publishEvent(eventName, message);
      this.logger.debug(`Event published: ${eventName}${delayMs ? ` (delay ${delayMs}ms)` : ''}`);
    } catch (error) {
      this.logger.error(`Failed to publish event ${eventName}:`, error);
      throw error;
    }
  }
}