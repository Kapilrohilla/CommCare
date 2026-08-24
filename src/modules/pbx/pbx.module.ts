import { Logger, Module } from '@nestjs/common';
import { RequestClient } from 'src/shared/utils/services/request.service';
import { PbxService } from './services/pbx.service';
import { AsteriskService } from './services/asterisk.service';
import { PbxController } from './controller/pbx.controller';
import { AsteriskController } from './controller/asterisk.controller';
import { AsteriskCDRService } from './services/asterisk-cdr.service';
import { CallsModule } from '../calls/calls.module';
import { QueueModule } from 'src/infra/queue/queue.module';

@Module({
	imports: [CallsModule, QueueModule],
	controllers: [PbxController, AsteriskController],
	providers: [RequestClient, PbxService, AsteriskService, AsteriskCDRService, RequestClient, Logger],
	exports: [AsteriskCDRService],
})
export class PbxModule {}
