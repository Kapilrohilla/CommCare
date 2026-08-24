import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from 'src/infra/database/connectors/baseRepository';
import {
	DB_CONNECTION_READER,
	DB_CONNECTION_WRITER,
} from 'src/infra/database/postgresql/postgresqlConfig';
import { SessionEntity } from '../entity/session.entity';

@Injectable()
export class SessionRepository {
	constructor(
		@InjectRepository(SessionEntity, DB_CONNECTION_WRITER)
		private readonly writerRepository: BaseRepository<SessionEntity>,
		@InjectRepository(SessionEntity, DB_CONNECTION_READER)
		private readonly readerRepository: BaseRepository<SessionEntity>,
	) {}

	findById(id: string): Promise<SessionEntity | null> {
		return this.readerRepository.findOne({ where: { id } });
	}

	create(data: Partial<SessionEntity>): Promise<SessionEntity> {
		const session = this.writerRepository.create(data);
		return this.writerRepository.save(session);
	}

	save(session: SessionEntity): Promise<SessionEntity> {
		return this.writerRepository.save(session);
	}
}
