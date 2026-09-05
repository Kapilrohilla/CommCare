import { Logger, Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from 'src/infra/database/connectors/typeORM';
import { RedisModule } from 'src/infra/redis/redis.module';
import { CallEntity } from './entity/calls.entity';
import { CallLegEntity } from './entity/call-legs.entity';
import { CallEventEntity } from './entity/call-events.entity';
import { CallsController } from './controller/calls.controller';
import { CallsService } from './services/calls.service';
import { CallLegsService } from './services/call-legs.service';
import { CallEventsService } from './services/call-events.service';
import { CallWorkflowRouterService } from './services/call-workflow-router.service';
import { Click2CallWorkflowService } from './services/click2call-workflow.service';
import { IvrCallWorkflowService } from './services/ivr-call-workflow.service';
import { InboundRouteCallWorkflowService } from './services/inbound-route-call-workflow.service';
import { AutoAttendantCallWorkflowService } from './services/auto-attendant-call-workflow.service';
import { CallsRepository } from './repositories/calls.repository';
import { CallLegsRepository } from './repositories/call-legs.repository';
import { CallEventsRepository } from './repositories/call-events.repository';
import { PbxModule } from '../pbx/pbx.module';
import { QueueModule } from 'src/infra/queue/queue.module';
import { IvrModule } from '../ivr/ivr.module';
import { RoutingModule } from '../routing/routing.module';
import { SystemRecordingModule } from '../systemRecording/system-recording.module';

@Module({
	imports: [
		DatabaseModule.forFeature([
			CallEntity,
			CallLegEntity,
			CallEventEntity,
		]),
		PbxModule,
		QueueModule,
		RedisModule,
		forwardRef(() => IvrModule),
		forwardRef(() => RoutingModule),
		SystemRecordingModule,
	],
	controllers: [CallsController],
	providers: [
		CallsRepository,
		CallLegsRepository,
		CallEventsRepository,
		CallsService,
		CallLegsService,
		CallEventsService,
		CallWorkflowRouterService,
		Click2CallWorkflowService,
		IvrCallWorkflowService,
		InboundRouteCallWorkflowService,
		AutoAttendantCallWorkflowService,
		Logger,
	],
	exports: [
		CallsService,
		CallLegsService,
		CallEventsService,
		CallWorkflowRouterService,
	],
})
export class CallsModule {}
