import { Module } from '@nestjs/common';
import { QueueProducerModule } from 'src/infra/queue/queue-producer.module';
import { RedisModule } from 'src/infra/redis/redis.module';
import { AriConsumerService } from './services/ari-consumer.service';

@Module({
	imports: [QueueProducerModule, RedisModule],
	providers: [AriConsumerService],
})
export class AriConsumerModule {}
