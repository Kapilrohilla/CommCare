import { Logger, Module } from '@nestjs/common';
import { DatabaseModule } from 'src/infra/database/connectors/typeORM';
import { RedisModule } from 'src/infra/redis/redis.module';
import { GlobalConfigController } from './controller/global-config.controller';
import { GlobalConfig } from './entity/global-config.entity';
import { GlobalConfigRepository } from './repositories/global-config.repository';
import { GlobalConfigService } from './services/global-config.service';

@Module({
	imports: [DatabaseModule.forFeature([GlobalConfig]), RedisModule],
	controllers: [GlobalConfigController],
	providers: [GlobalConfigRepository, GlobalConfigService, Logger],
	exports: [GlobalConfigService],
})
export class GlobalModule {}
