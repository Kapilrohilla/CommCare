import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from 'src/infra/database/connectors/baseRepository';
import {
	DB_CONNECTION_READER,
	DB_CONNECTION_WRITER,
} from 'src/infra/database/postgresql/postgresqlConfig';
import { IVREntity } from '../entity/ivr.entity';

@Injectable()
export class IVRRepository {
	constructor(
		@InjectRepository(IVREntity, DB_CONNECTION_READER)
		private readonly readerRepository: BaseRepository<IVREntity>,
		@InjectRepository(IVREntity, DB_CONNECTION_WRITER)
		private readonly writerRepository: BaseRepository<IVREntity>,
	) {}

	async create(ivr: IVREntity): Promise<IVREntity> {
		return this.writerRepository.save(ivr);
	}

	async save(ivr: IVREntity): Promise<IVREntity> {
		return this.writerRepository.save(ivr);
	}

	async delete(id: string): Promise<void> {
		await this.writerRepository.delete(id);
	}

	async getById(id: string): Promise<IVREntity | null> {
		return this.readerRepository.findOne({ where: { id } });
	}

	async getByIdAndTenantId(
		id: string,
		tenantId: string,
	): Promise<IVREntity | null> {
		return this.readerRepository.findOne({
			where: { id, tenantId },
			relations: { options: true },
			order: { options: { digit: 'ASC' } },
		});
	}

	async getByTenantId(tenantId: string): Promise<IVREntity[]> {
		return this.readerRepository.find({
			where: { tenantId },
			order: { updatedAt: 'DESC' },
		});
	}
}
