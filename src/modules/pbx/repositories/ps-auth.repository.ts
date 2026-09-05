import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from 'src/infra/database/connectors/baseRepository';
import {
	DB_CONNECTION_READER,
	DB_CONNECTION_WRITER,
} from 'src/infra/database/postgresql/postgresqlConfig';
import { PsAuth } from '../entity/ps-auth.entity';

@Injectable()
export class PsAuthRepository {
	constructor(
		@InjectRepository(PsAuth, DB_CONNECTION_WRITER)
		private readonly writerRepository: BaseRepository<PsAuth>,
		@InjectRepository(PsAuth, DB_CONNECTION_READER)
		private readonly readerRepository: BaseRepository<PsAuth>,
	) {}

	save(auth: PsAuth): Promise<PsAuth> {
		return this.writerRepository.save(auth);
	}

	delete(id: string): Promise<void> {
		return this.writerRepository.delete(id).then(() => undefined);
	}

	findById(id: string): Promise<PsAuth | null> {
		return this.readerRepository.findOne({ where: { id } });
	}
}
