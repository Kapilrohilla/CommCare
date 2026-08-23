import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
	DB_CONNECTION_WRITER,
} from '../../../infra/database/postgresql/postgresqlConfig';
import { BaseRepository } from '../../../infra/database/connectors/baseRepository';
import { CallEventEntity } from '../entity/call-events.entity';

@Injectable()
export class CallEventsRepository {
	constructor(
		@InjectRepository(CallEventEntity, DB_CONNECTION_WRITER)
		private readonly writerRepository: BaseRepository<CallEventEntity>,
	) {}

	async findByCallId(callId: string): Promise<CallEventEntity[]> {
		return this.writerRepository.find({
			where: { callId },
			order: { eventTime: 'ASC' },
		});
	}

	async save(event: CallEventEntity): Promise<CallEventEntity> {
		return this.writerRepository.save(event);
	}

	async saveMany(events: CallEventEntity[]): Promise<CallEventEntity[]> {
		if (!events.length) {
			return [];
		}

		return this.writerRepository.save(events);
	}

	async deleteByCallId(callId: string): Promise<void> {
		await this.writerRepository.delete({ callId });
	}
}
