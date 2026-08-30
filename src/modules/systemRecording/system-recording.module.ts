import { Logger, Module } from '@nestjs/common';
import { DatabaseModule } from 'src/infra/database/connectors/typeORM';
import { StorageModule } from 'src/infra/storage/storage.module';
import { QueueModule } from 'src/infra/queue/queue.module';
import { SystemRecordingService } from './services/system-recording.service';
import { SystemRecordingRepository } from './repositories/system-recording.repository';
import { SystemRecordingController } from './controller/system-recording.controller';
import { RecordingProcessorService } from './services/recording-processor.service';
import { TextToSpeechService } from './services/text-to-speech.service';
import { SystemRecording } from './entity/system-recording.entity';

@Module({
	imports: [
		DatabaseModule.forFeature([SystemRecording]),
		StorageModule,
		QueueModule,
	],
	controllers: [SystemRecordingController],
	providers: [
		SystemRecordingService,
		SystemRecordingRepository,
		RecordingProcessorService,
		TextToSpeechService,
		Logger,
	],
	exports: [SystemRecordingService],
})
export class SystemRecordingModule {}
