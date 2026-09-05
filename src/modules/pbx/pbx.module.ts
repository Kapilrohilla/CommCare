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
import { PsAuthRepository } from './repositories/ps-auth.repository';
import { PsAorRepository } from './repositories/ps-aor.repository';
import { PsEndpointRepository } from './repositories/ps-endpoint.repository';
import { Extension } from './entity/extension.entity';
import { PsAuth } from './entity/ps-auth.entity';
import { PsAor } from './entity/ps-aor.entity';
import { PsEndpoint } from './entity/ps-endpoint.entity';
import { QueueModule } from 'src/infra/queue/queue.module';
import { RedisModule } from 'src/infra/redis/redis.module';

@Module({
	imports: [
		QueueModule,
		RedisModule,
		DatabaseModule.forFeature([Extension, PsAuth, PsAor, PsEndpoint]),
	],
	controllers: [PbxController],
	providers: [
		RequestClient,
		PbxService,
		AsteriskService,
		PsAuthRepository,
		PsAorRepository,
		PsEndpointRepository,
		PjsipRealtimeRepository,
		AsteriskProvisioningService,
		ExtensionRepository,
		ExtensionService,
		Logger,
	],
	exports: [AsteriskService, ExtensionService, AsteriskProvisioningService],
})
export class PbxModule {}
