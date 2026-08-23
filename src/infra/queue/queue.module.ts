import { Module } from '@nestjs/common';
import { KafkaModule } from '../kafka/kafka.module';
import { EventProducer } from './services/event-producer.service';

/**
 * Queue Module
 * Provides unified event publishing interface
 *
 * Import this module to use EventProducer in your services/controllers
 */
@Module({
  imports: [KafkaModule],
  providers: [EventProducer],
  exports: [EventProducer],
})
export class QueueModule {}