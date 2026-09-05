import { Logger, Module } from '@nestjs/common';
import { RequestClient } from 'src/shared/utils/services/request.service';
import { DatabaseModule } from 'src/infra/database/connectors/typeORM';
import { PbxService } from './services/pbx.service';
import { AsteriskService } from './services/asterisk.service';
import { PbxController } from './controller/pbx.controller';
import { AsteriskCDRService } from './services/asterisk-cdr.service';
import { AsteriskProvisioningService } from './services/asterisk-provisioning.service';
import { ExtensionService } from './services/extension.service';
import { ExtensionRepository } from './repositories/extension.repository';
import { PjsipRealtimeRepository } from './repositories/pjsip-realtime.repository';
import { Extension } from './entity/extension.entity';
import { QueueModule } from 'src/infra/queue/queue.module';
import { RedisModule } from 'src/infra/redis/redis.module';

@Module({
	imports: [QueueModule, RedisModule, DatabaseModule.forFeature([Extension])],
	controllers: [PbxController],
	providers: [
		RequestClient,
		PbxService,
		AsteriskService,
		PjsipRealtimeRepository,
		AsteriskProvisioningService,
		ExtensionRepository,
		ExtensionService,
		Logger,
	],
	exports: [AsteriskService, ExtensionService, AsteriskProvisioningService],
})
export class PbxModule {}
