import { Module } from '@nestjs/common';
import { KafkaProducerModule } from '../kafka/kafka-producer.module';
import { EventProducer } from './services/event-producer.service';

@Module({
	imports: [KafkaProducerModule],
	providers: [EventProducer],
	exports: [EventProducer],
})
export class QueueProducerModule {}
