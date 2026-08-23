import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/infra/database/connectors/typeORM';
import { CallEntity } from './entity/calls.entity';
import { CallLegEntity } from './entity/call-legs.entity';
import { CallEventEntity } from './entity/call-events.entity';
import { CallsController } from './controller/calls.controller';
import { CallsService } from './services/calls.service';
import { CallLegsService } from './services/call-legs.service';
import { CallEventsService } from './services/call-events.service';
import { CallsRepository } from './repositories/calls.repository';
import { CallLegsRepository } from './repositories/call-legs.repository';
import { CallEventsRepository } from './repositories/call-events.repository';

@Module({
	imports: [
		DatabaseModule.forFeature([
			CallEntity,
			CallLegEntity,
			CallEventEntity,
		]),
	],
	controllers: [CallsController],
	providers: [
		CallsRepository,
		CallLegsRepository,
		CallEventsRepository,
		CallsService,
		CallLegsService,
		CallEventsService,
	],
	exports: [
		CallsService,
		CallLegsService,
		CallEventsService,
	],
})
export class CallsModule {}
