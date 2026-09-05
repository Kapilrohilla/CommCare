import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from 'src/infra/database/connectors/baseRepository';
import {
	DB_CONNECTION_READER,
	DB_CONNECTION_WRITER,
} from 'src/infra/database/postgresql/postgresqlConfig';
import { GlobalConfig } from '../entity/global-config.entity';

@Injectable()
export class GlobalConfigRepository {
	constructor(
		@InjectRepository(GlobalConfig, DB_CONNECTION_WRITER)
		private readonly writerRepository: BaseRepository<GlobalConfig>,
		@InjectRepository(GlobalConfig, DB_CONNECTION_READER)
		private readonly readerRepository: BaseRepository<GlobalConfig>,
	) {}

	create(config: GlobalConfig): Promise<GlobalConfig> {
		return this.writerRepository.save(config);
	}

	save(config: GlobalConfig): Promise<GlobalConfig> {
		return this.writerRepository.save(config);
	}

	delete(id: string): Promise<void> {
		return this.writerRepository.delete(id).then(() => undefined);
	}

	getById(id: string): Promise<GlobalConfig | null> {
		return this.readerRepository.findOne({ where: { id } });
	}

	getByKey(key: string): Promise<GlobalConfig | null> {
		return this.readerRepository.findOne({ where: { key } });
	}

	getAll(): Promise<GlobalConfig[]> {
		return this.readerRepository.find({ order: { updatedAt: 'DESC' } });
	}
}
