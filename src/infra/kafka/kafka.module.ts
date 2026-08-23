import { forwardRef, Module } from '@nestjs/common';
import { BullMQModule } from '../bullmq/bullmq.module';
import { KafkaConsumerService } from './services/kafka-consumer.service';
import { KafkaProducerService } from './services/kafka-producer.service';
import { KafkaSubscriberService } from './services/kafka-subscriber.service';

@Module({
	imports: [forwardRef(() => BullMQModule)],
	providers: [KafkaConsumerService, KafkaProducerService, KafkaSubscriberService],
	exports: [KafkaConsumerService, KafkaProducerService, KafkaSubscriberService],
})
export class KafkaModule {}
