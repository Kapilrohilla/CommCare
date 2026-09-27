import { Logger, Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from 'src/infra/database/connectors/typeORM';
import { IamModule } from 'src/modules/iam/iam.module';
import { PbxModule } from 'src/modules/pbx/pbx.module';
import { RoutingModule } from 'src/modules/routing/routing.module';
import { SystemRecordingModule } from 'src/modules/systemRecording/system-recording.module';
import { QueuesController } from './controller/queues.controller';
import { QueueCallEventEntity } from './entity/queue-call-event.entity';
import { QueueCallEntity } from './entity/queue-call.entity';
import { QueueMember } from './entity/queue-member.entity';
import { Queue } from './entity/queue.entity';
import { QueueCallEventRepository } from './repositories/queue-call-event.repository';
import { QueueCallRepository } from './repositories/queue-call.repository';
import { QueueMemberRepository } from './repositories/queue-member.repository';
import { QueueRepository } from './repositories/queue.repository';
import { AsteriskQueueAdapter } from './services/asterisk-queue-adapter.service';
import { QueueMembersService } from './services/queue-members.service';
import { QueuesService } from './services/queues.service';

@Module({
	imports: [
		DatabaseModule.forFeature([Queue, QueueMember, QueueCallEntity, QueueCallEventEntity]),
		PbxModule,
		SystemRecordingModule,
		IamModule,
		forwardRef(() => RoutingModule),
	],
	controllers: [QueuesController],
	providers: [
		QueuesService,
		QueueMembersService,
		AsteriskQueueAdapter,
		QueueRepository,
		QueueMemberRepository,
		QueueCallRepository,
		QueueCallEventRepository,
		Logger,
	],
	exports: [
		QueuesService,
		QueueMembersService,
		AsteriskQueueAdapter,
		QueueCallRepository,
		QueueCallEventRepository,
	],
})
export class InboundQueuesModule {}
