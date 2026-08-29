import { Module } from '@nestjs/common';
import { KafkaProducerService } from './services/kafka-producer.service';

@Module({
	providers: [KafkaProducerService],
	exports: [KafkaProducerService],
})
export class KafkaProducerModule {}
