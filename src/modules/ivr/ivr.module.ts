import { Logger, Module } from '@nestjs/common';
import { DatabaseModule } from 'src/infra/database/connectors/typeORM';
import { PbxModule } from 'src/modules/pbx/pbx.module';
import { SystemRecordingModule } from 'src/modules/systemRecording/system-recording.module';
import { IVROptionsController } from './controller/ivr-options.controller';
import { IVRSessionController } from './controller/ivr-session.controller';
import { IVRController } from './controller/ivr.controller';
import { IVROptionEntity } from './entity/ivr-options.entity';
import { IVRSessionEntity } from './entity/ivr-session.entity';
import { IVREntity } from './entity/ivr.entity';
import { IVROptionsRepository } from './repository/ivr-options.repository';
import { IVRSessionRepository } from './repository/ivr-session.repository';
import { IVRRepository } from './repository/ivr.repository';
import { IVROptionsService } from './services/ivr-options.service';
import { IVRSessionService } from './services/ivr-session.service';
import { IVRService } from './services/ivr.service';

@Module({
	imports: [
		DatabaseModule.forFeature([IVREntity, IVROptionEntity, IVRSessionEntity]),
		SystemRecordingModule,
		PbxModule,
	],
	controllers: [IVRController, IVROptionsController, IVRSessionController],
	providers: [
		IVRService,
		IVROptionsService,
		IVRSessionService,
		IVRRepository,
		IVROptionsRepository,
		IVRSessionRepository,
		Logger,
	],
	exports: [IVRService, IVROptionsService, IVRSessionService],
})
export class IvrModule {}
