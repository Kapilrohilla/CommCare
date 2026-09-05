import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from 'src/infra/database/connectors/baseRepository';
import {
	DB_CONNECTION_READER,
	DB_CONNECTION_WRITER,
} from 'src/infra/database/postgresql/postgresqlConfig';
import { PsAor } from '../entity/ps-aor.entity';

@Injectable()
export class PsAorRepository {
	constructor(
		@InjectRepository(PsAor, DB_CONNECTION_WRITER)
		private readonly writerRepository: BaseRepository<PsAor>,
		@InjectRepository(PsAor, DB_CONNECTION_READER)
		private readonly readerRepository: BaseRepository<PsAor>,
	) {}

	save(aor: PsAor): Promise<PsAor> {
		return this.writerRepository.save(aor);
	}

	delete(id: string): Promise<void> {
		return this.writerRepository.delete(id).then(() => undefined);
	}

	findById(id: string): Promise<PsAor | null> {
		return this.readerRepository.findOne({ where: { id } });
	}
}
