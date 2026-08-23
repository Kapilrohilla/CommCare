import { Module } from '@nestjs/common';
import { RedisService } from './services/redis.service';
import { RedlockService } from './services/redlock.service';
import { RedisController } from './controller/redis.controller';

@Module({
	controllers: [RedisController],
	providers: [RedisService, RedlockService],
	exports: [RedisService, RedlockService],
})
export class RedisModule {}
