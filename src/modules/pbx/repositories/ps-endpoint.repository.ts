import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from 'src/infra/database/connectors/baseRepository';
import {
	DB_CONNECTION_READER,
	DB_CONNECTION_WRITER,
} from 'src/infra/database/postgresql/postgresqlConfig';
import { PsEndpoint } from '../entity/ps-endpoint.entity';

@Injectable()
export class PsEndpointRepository {
	constructor(
		@InjectRepository(PsEndpoint, DB_CONNECTION_WRITER)
		private readonly writerRepository: BaseRepository<PsEndpoint>,
		@InjectRepository(PsEndpoint, DB_CONNECTION_READER)
		private readonly readerRepository: BaseRepository<PsEndpoint>,
	) {}

	save(endpoint: PsEndpoint): Promise<PsEndpoint> {
		return this.writerRepository.save(endpoint);
	}

	delete(id: string): Promise<void> {
		return this.writerRepository.delete(id).then(() => undefined);
	}

	findById(id: string): Promise<PsEndpoint | null> {
		return this.readerRepository.findOne({ where: { id } });
	}

	listIds(): Promise<string[]> {
		return this.readerRepository
			.find({ select: { id: true }, order: { id: 'ASC' } })
			.then((rows) => rows.map((row) => row.id));
	}
}
