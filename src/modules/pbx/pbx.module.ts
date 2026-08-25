import { Logger, Module } from '@nestjs/common';
import { RequestClient } from 'src/shared/utils/services/request.service';
import { DatabaseModule } from 'src/infra/database/connectors/typeORM';
import { PbxService } from './services/pbx.service';
import { AsteriskService } from './services/asterisk.service';
import { PbxController } from './controller/pbx.controller';
import { AsteriskController } from './controller/asterisk.controller';
import { FreePbxController } from './controller/freepbx.controller';
import { AsteriskCDRService } from './services/asterisk-cdr.service';
import { FreePbxService } from './services/freepbx.service';
import { ExtensionService } from './services/extension.service';
import { ExtensionRepository } from './repositories/extension.repository';
import { Extension } from './entity/extension.entity';
import { CallsModule } from '../calls/calls.module';
import { QueueModule } from 'src/infra/queue/queue.module';
import { RedisModule } from 'src/infra/redis/redis.module';

@Module({
	imports: [CallsModule, QueueModule, RedisModule, DatabaseModule.forFeature([Extension])],
	controllers: [PbxController, AsteriskController, FreePbxController],
	providers: [
		RequestClient,
		PbxService,
		AsteriskService,
		AsteriskCDRService,
		FreePbxService,
		ExtensionRepository,
		ExtensionService,
		Logger,
	],
	exports: [AsteriskCDRService, ExtensionService, FreePbxService],
})
export class PbxModule {}
