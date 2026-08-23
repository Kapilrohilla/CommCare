import { ConsoleLogger, Module } from '@nestjs/common';
import { PbxService } from './services/pbx.service';
import { AsteriskService } from './services/asterisk.service';
import { PbxController } from './controller/pbx.controller';
import { AsteriskController } from './controller/asterisk.controller';
import { AsteriskCDRService } from './services/asterisk-cdr.service';
import { CallsModule } from '../calls/calls.module';

@Module({
	imports: [CallsModule ],
	controllers: [PbxController, AsteriskController],
	providers: [PbxService, AsteriskService, AsteriskCDRService, ConsoleLogger]
})
export class PbxModule {}
