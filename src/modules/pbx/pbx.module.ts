import { Module } from '@nestjs/common';
import { PbxService } from './services/pbx.service';
import { AsteriskService } from './services/asterisk.service';
import { PbxController } from './controller/pbx.controller';

@Module({
	controllers: [PbxController],
	providers: [PbxService, AsteriskService]
})
export class PbxModule {}
