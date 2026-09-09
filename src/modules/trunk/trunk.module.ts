import { Logger, Module } from '@nestjs/common';
import { DatabaseModule } from 'src/infra/database/connectors/typeORM';
import { PbxModule } from 'src/modules/pbx/pbx.module';
import { SipTrunkController } from './controller/sip-trunk.controller';
import { SipTrunk } from './entity/sip-trunk.entity';
import { SipTrunkIdentifyIp } from './entity/sip-trunk-identify-ip.entity';
import { SipTrunkRepository } from './repositories/sip-trunk.repository';
import { SipTrunkService } from './services/sip-trunk.service';

@Module({
	imports: [
		DatabaseModule.forFeature([SipTrunk, SipTrunkIdentifyIp]),
		PbxModule,
	],
	controllers: [SipTrunkController],
	providers: [SipTrunkService, SipTrunkRepository, Logger],
	exports: [SipTrunkService],
})
export class TrunkModule {}
