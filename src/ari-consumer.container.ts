import { Module } from '@nestjs/common';
import { RedisModule } from './infra/redis/redis.module';
import { AriConsumerModule } from './modules/pbx/ari-consumer.module';
import { ClsModule } from './shared/context/cls.module';

@Module({
	imports: [ClsModule, RedisModule, AriConsumerModule],
})
export class AriConsumerAppModule {}
