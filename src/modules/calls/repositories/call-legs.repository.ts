import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
	DB_CONNECTION_READER,
	DB_CONNECTION_WRITER,
} from '../../../infra/database/postgresql/postgresqlConfig';
import { BaseRepository } from '../../../infra/database/connectors/baseRepository';
import { CallLegEntity } from '../entity/call-legs.entity';

@Injectable()
export class CallLegsRepository {
	constructor(
		@InjectRepository(CallLegEntity, DB_CONNECTION_WRITER)
		private readonly writerRepository: BaseRepository<CallLegEntity>,
		@InjectRepository(CallLegEntity, DB_CONNECTION_READER)
		private readonly readerRepository: BaseRepository<CallLegEntity>,
	) {}

	async findByUniqueId(uniqueId: string): Promise<CallLegEntity | null> {
		return this.readerRepository.findOne({ where: { uniqueId } });
	}

	async findByCallId(callId: string): Promise<CallLegEntity[]> {
		return this.readerRepository.find({ where: { callId } });
	}

	async save(leg: CallLegEntity): Promise<CallLegEntity> {
		return this.writerRepository.save(leg);
	}

	async deleteByCallId(callId: string): Promise<void> {
		await this.writerRepository.delete({ callId });
	}
}
