import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ClsService } from '../../../shared/context/cls.service';
import { Consumer, EachMessagePayload, Kafka } from 'kafkajs';
import { BullMQProducerService } from '../../bullmq/services/bullmq-producer.service';
import { KafkaProducerService } from './kafka-producer.service';
import { env } from '../../../config/env.config';
import { buildKafkaConfig } from '../kafkaConfig';

export interface EventListener {
  listener: {
    [key: string]: (eventName: string, payload: unknown, retryCount: number) => Promise<unknown>;
  };
  subscriberServiceName: string;
  retry?: boolean;
  delay?: number;
  serviceClass?: new (...args: unknown[]) => unknown; // Store service class for fresh resolution
}

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private consumer: Consumer | null = null;
  private listenerConfig: Map<string, EventListener[]> = new Map();
  private readonly errorTypes = ['uncaughtException', 'unhandledRejection'];
  private readonly signalTraps = ['SIGTERM', 'SIGINT'];
  private readonly MAX_RETRY_COUNT = 10;

  constructor(
    private readonly cls: ClsService,
    private readonly moduleRef: ModuleRef,
    @Optional() private readonly bullmqEventProducer?: BullMQProducerService,
    @Optional() private readonly kafkaProducer?: KafkaProducerService,
  ) {}

  async onModuleInit() {
    await this.init();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  subscribeEvent(eventName: string, listeners: EventListener | EventListener[]): void {
    const listenerArray = Array.isArray(listeners) ? listeners : [listeners];
    if (!this.listenerConfig.has(eventName)) {
      this.listenerConfig.set(eventName, []);
    }
    listenerArray.forEach((listener) => {
      this.listenerConfig.get(eventName)!.push(listener);
      this.logger.log(`Subscribed: ${eventName} -> ${listener.subscriberServiceName}`);
    });
  }

  /**
   * Generic error handler for Kafka event handlers
   * Normalizes errors, logs them, and re-throws for consumer retry logic
   */
  static handleEventError(error: unknown, eventName: string, serviceName: string): never {
    const err = error instanceof Error ? error : new Error(String(error));
    const logger = new Logger('KafkaConsumerService');
    logger.error(`[${serviceName}] Error handling ${eventName}: ${err.message}`, err);
    throw err;
  }

  private static readonly CONNECT_RETRIES = 5;
  private static readonly CONNECT_RETRY_DELAY_MS = 3000;

  private async init(): Promise<void> {
    if (!env.KAFKA_TOPIC_SUBSCRIBER) {
      this.logger.log('Kafka consumer disabled');
      return;
    }

    try {
      const groupId = env.KAFKA_GROUP_ID;
      const consumerOpts = { groupId, heartbeatInterval: 5000, sessionTimeout: 45000, rebalanceTimeout: 90000 };

      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= KafkaConsumerService.CONNECT_RETRIES; attempt++) {
        const kafka = new Kafka(buildKafkaConfig('consumer'));
        this.consumer = kafka.consumer(consumerOpts);
        try {
          await this.consumer.connect();
          for (const [topic] of this.listenerConfig.entries()) {
            await this.consumer.subscribe({ topic, fromBeginning: true });
          }
          this.logger.log('[kafka-carrum-service-consumer] Connected to Kafka consumer');
          lastError = null;
          break;
        } catch (e) {
          lastError = e instanceof Error ? e : new Error(String(e));
          this.consumer = null;
          this.logger.warn(
            `[kafka-carrum-service-consumer] Connect attempt ${attempt}/${KafkaConsumerService.CONNECT_RETRIES} failed: ${lastError.message}`,
          );
          if (attempt < KafkaConsumerService.CONNECT_RETRIES) {
            await new Promise((r) => setTimeout(r, KafkaConsumerService.CONNECT_RETRY_DELAY_MS));
          }
        }
      }

      if (lastError || !this.consumer) {
        this.logger.error('[kafka-carrum-service-consumer] All connect attempts failed. App continues without Kafka consumer.', lastError);
        this.consumer = null;
        return;
      }

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message, heartbeat }: EachMessagePayload) => {
          return this.cls.run(async () => {
            try {
              await heartbeat();
              const eventName = `${topic}`;
              const value = `${message.value}`;
              this.logger.log(`[kafka-carrum-service-consumer] : ${topic}`);

              const { id, request_id, apiName, payload, timestamp, retryCount = 0, retrySubscriber } = JSON.parse(value);
              const messageTimestamp = timestamp || new Date().toISOString();

              const listeners = this.listenerConfig.get(eventName);
              if (!listeners) {
                this.logger.debug(`[kafka-carrum-service-consumer] : No listeners found for topic: ${topic}`);
                return;
              }


              const startTime = Date.now();
              for (const listener of listeners) {
                let messageConsumedSuccess = true;
                try {
                  // Set subscriber service in context for logging
                  // this.cls.set('eventSubscriberService', listener.subscriberServiceName);

                  if (retryCount > 0 && retrySubscriber !== 'NONE') {
                    if (retrySubscriber !== listener.subscriberServiceName) {
                      this.logger.log(
                        `[kafka-carrum-service-consumer] : ${topic} : Message Id ${id} : Retry Count ${retryCount} : Timestamp ${messageTimestamp} : Skipping message, Event Name : ${eventName}, Payload : ${JSON.stringify(payload)}`,
                      );
                      continue;
                    }
                  }

                  this.logger.log(
                    `[kafka-carrum-service-consumer] : ${topic} : Message Id ${id} : Retry Count ${retryCount} : Timestamp ${messageTimestamp} : Consuming message, Event Name : ${eventName}, Payload : ${JSON.stringify(payload)}`,
                  );
                  const listenerStartTime = Date.now();

                  // All events are forwarded to BullMQ for processing
                  if (this.bullmqEventProducer) {
                    const delayFromPayload =
                      payload && typeof payload === 'object' && payload !== null && 'delay' in payload
                        ? Number((payload as { delay?: number }).delay) || 0
                        : 0;
                    const workerPayload = {
                      eventName,
                      payload,
                      retryCount,
                      id,
                      request_id,
                      apiName,
                      subscriberServiceName: listener.subscriberServiceName,
                      delay: delayFromPayload || listener.delay || 0,
                    };
                    await this.bullmqEventProducer.publishEvent(eventName, workerPayload);
                    this.logger.debug(`[kafka-carrum-service-consumer] Forwarded to BullMQ: ${eventName}`);
                  } else {
                    // Fallback: if BullMQ is unavailable, log warning
                    this.logger.warn(`[kafka-carrum-service-consumer] BullMQ unavailable, event not processed: ${eventName}`);
                  }

                  const listenerEndTime = Date.now();
                  const listenerDuration = listenerEndTime - listenerStartTime;
                  this.logger.log(
                    `[kafka-carrum-service-consumer] : Single Event ${topic} ${listener.subscriberServiceName} : Message Id ${id} : Retry Count ${retryCount} : Timestamp ${messageTimestamp} : Processed in ${listenerDuration} ms`,
                  );
                } catch (e) {
                  messageConsumedSuccess = false;
                  const error = e instanceof Error ? e : new Error(String(e));
                  this.logger.error(
                    `[kafka-carrum-service-consumer] : ${topic} : Message Id ${id} : Retry Count ${retryCount} : Timestamp ${messageTimestamp} error on listener : ${listener.subscriberServiceName}.handleEvent${eventName}, Event Name : ${eventName}, Payload : ${JSON.stringify(payload)} :  `,
                    error,
                  );
                }

                if (!messageConsumedSuccess) {
                  await this.handleRetryOrDLQ(eventName, payload, id, retryCount, listener, value);
                }
              }

              const endTime = Date.now();
              const duration = endTime - startTime;
              this.logger.log(
                `[kafka-carrum-service-consumer] : ${env.HTTP_PORT} Group Event ${topic} : Message Id ${id} : Retry Count ${retryCount} : Timestamp ${messageTimestamp} : Processed in ${duration} ms`,
              );
              await heartbeat();
            } catch (err) {
              const error = err instanceof Error ? err : new Error(String(err));
              this.logger.error(`[kafka-carrum-service-consumer] : Event Name : ${topic}, Payload : ${JSON.stringify(message)} :  `, error);
            }
          });
        },
      });

      this.handleSignals();
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      this.logger.error('[kafka-carrum-service-consumer] Kafka consumer init failed. App continues without Kafka consumer.', error);
      this.consumer = null;
    }
  }


  private async handleRetryOrDLQ(
    eventName: string,
    payload: unknown,
    id: string,
    retryCount: number,
    listener: EventListener,
    value?: string,
  ): Promise<void> {
    if (!this.kafkaProducer) {
      this.logger.warn('[kafka-carrum-service-consumer] Producer unavailable for retry/DLQ');
      return;
    }

    if (retryCount < this.MAX_RETRY_COUNT && listener.retry) {
      this.logger.log(`[kafka-carrum-service-consumer] : ${eventName} : ${value || JSON.stringify(payload)} : Retrying ${retryCount + 1}`);
      await this.kafkaProducer.publishRetryEvent(eventName, payload, id, retryCount + 1, listener.subscriberServiceName);
    } else {
      this.logger.error(`[kafka-carrum-service-consumer] : ${eventName} : ${value || JSON.stringify(payload)} error :  Max retry count reached`);
      await this.kafkaProducer.publishEventToDLQ(eventName, payload, id, retryCount + 1, listener.subscriberServiceName);
    }
  }

  private handleSignals(): void {
    this.errorTypes.forEach((type) => {
      process.on(type, async (e) => {
        try {
          this.logger.log(`process.on ${type}`);
          this.logger.error(String(e), e);
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
      if (this.consumer) {
        await this.consumer.disconnect();
        this.logger.log('[kafka-carrum-service-consumer] Disconnected');
      }
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      this.logger.warn('[kafka-carrum-service-consumer] Error during disconnect:', error);
    }
  }
}