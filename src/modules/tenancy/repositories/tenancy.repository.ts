import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
	DB_CONNECTION_READER,
	DB_CONNECTION_WRITER,
} from '../../../infra/database/postgresql/postgresqlConfig';
import { BaseRepository } from '../../../infra/database/connectors/baseRepository';
import { Tenants } from '../entity/tenants.entity';

@Injectable()
export class TenancyRepository {
	constructor(
		@InjectRepository(Tenants, DB_CONNECTION_WRITER)
		private readonly writerRepository: BaseRepository<Tenants>,
		@InjectRepository(Tenants, DB_CONNECTION_READER)
		private readonly readerRepository: BaseRepository<Tenants>,
	) {}

	findAll(): Promise<Tenants[]> {
		return this.readerRepository.find();
	}

	create(name: string): Promise<Tenants> {
		const tenant = this.writerRepository.create({ name });
		return this.writerRepository.save(tenant);
	}

	findById(id: string): Promise<Tenants | null> {
		return this.readerRepository.findOne({ where: { id } });
	}
}
