import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
// import { ClsService } from '../httpContext/httpContext';
import { Producer, CompressionTypes, Kafka } from 'kafkajs';
import { randomUUID } from 'crypto';
// import { generateAlphaNumericId } from '../../shared/helpers/stringUtils';
import { buildKafkaConfig } from '../kafkaConfig';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private producer: Producer | null = null;
  private readonly errorTypes = ['uncaughtException', 'unhandledRejection'];
  private readonly signalTraps = ['SIGTERM', 'SIGINT'];

  constructor(
    // private readonly cls: ClsService
  ) {}

  async onModuleInit() {
    await this.init();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async init(): Promise<void> {
    try {
      const kafka = new Kafka(buildKafkaConfig());
      this.producer = kafka.producer();

      try {
        await this.producer.connect().catch((e) => {
          const error = e instanceof Error ? e : new Error(String(e));
          this.logger.error(`[kafka-carrum-service-producer] ${error.message}`, error);
        });
        this.logger.log('[kafka-carrum-service-producer], Connected to Kafka producer');
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        this.logger.error('[kafka-carrum-service-producer], Unable to publish app event producer :  ', error);
        process.exit(0);
      }

      this.handleSignals();
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      this.logger.error('[kafka-carrum-service-producer], Unable to publish app event producer :  ', error);
      process.exit(0);
    }
  }

  private async _publishEvent(
    eventName: string,
    message: unknown,
    topic: string = eventName,
    id: string | null = null,
    retryCount: number = 0,
    retrySubscriber: string | null = null,
  ): Promise<void> {
    if (!this.producer) {
      this.logger.warn(`[kafka-carrum-service-producer] Producer unavailable. Event ${eventName} skipped.`);
      return;
    }

    await this.producer
      .send({
        topic,
        compression: CompressionTypes.GZIP,
        messages: [
          {
            key: id || undefined,
            value: JSON.stringify({
              id: id || randomUUID(),
              // request_id: (this.cls.get('request_id') as string) || randomUUID(),
              // apiName: this.cls.get('apiName'),
              payload: message,
              timestamp: new Date().toISOString(),
              retryCount,
              retrySubscriber: retrySubscriber || null,
            }),
          },
        ],
      })
      .catch((e) => {
        const error = e instanceof Error ? e : new Error(String(e));
        this.logger.error(`[kafka-carrum-service-producer] ${error.message}`, error);
      });
  }

  async publishEvent(eventName: string, message: unknown): Promise<void> {
    // const id = generateAlphaNumericId(20);
    const id = randomUUID();
    this.logger.log(`[kafka-carrum-service-producer], Producing message to kafka EventName : ${eventName}, Message ; ${JSON.stringify(message)}`);
    return this._publishEvent(eventName, message, eventName, id, 0, 'NONE');
  }

  async publishRetryEvent(eventName: string, message: unknown, id: string, retryCount: number, retrySubscriber: string): Promise<void> {
    this.logger.log(
      `[kafka-carrum-service-producer], Producing retry message to kafka EventName : ${eventName}, Message ; ${JSON.stringify(message)}`,
    );
    return this._publishEvent(eventName, message, eventName, id, retryCount, retrySubscriber);
  }

  async publishEventToDLQ(eventName: string, message: unknown, id: string, retryCount: number, retrySubscriber: string): Promise<void> {
    return this._publishEvent(eventName, message, `${eventName}-DLQ`, id, retryCount, retrySubscriber);
  }

  private handleSignals(): void {
    this.errorTypes.forEach((type) => {
      process.on(type, async (e) => {
        try {
          this.logger.error(`[kafka-carrum-service-producer], type ${type}`, e);
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

  async disconnect(): Promise<void> {
    if (this.producer) {
      await this.producer.disconnect();
      this.logger.log('[kafka-carrum-service-producer], Disconnected from Kafka producer');
    }
  }
}