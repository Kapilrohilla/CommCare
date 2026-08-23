import { Module } from '@nestjs/common';
import { KafkaModule } from '../kafka/kafka.module';
import { BullMQSchedulerService } from '../bullmq/services/bullmq-scheduler.service';

@Module({
	imports: [KafkaModule],
	providers: [BullMQSchedulerService],
	exports: [BullMQSchedulerService],
})
export class SubscriberModule {}
