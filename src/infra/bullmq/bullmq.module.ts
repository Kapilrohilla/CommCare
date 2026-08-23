import { forwardRef, Module } from '@nestjs/common';
import { BullMQProducerService } from './services/bullmq-producer.service';
import { BullMQConsumerService } from './services/bullmq-consumer.service';
import { BullMQSubscriberService } from './services/bullmq-subscriber.service';
import { KafkaModule } from '../kafka/kafka.module';

@Module({
	imports: [forwardRef(() => KafkaModule)],
	providers: [BullMQProducerService, BullMQConsumerService, BullMQSubscriberService],
	exports: [BullMQProducerService, BullMQConsumerService, BullMQSubscriberService],
})
export class BullMQModule {}
