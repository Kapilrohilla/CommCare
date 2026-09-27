import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from 'src/infra/database/connectors/baseRepository';
import {
	DB_CONNECTION_READER,
	DB_CONNECTION_WRITER,
} from 'src/infra/database/postgresql/postgresqlConfig';
import { Queue } from '../entity/queue.entity';

@Injectable()
export class QueueRepository {
	constructor(
		@InjectRepository(Queue, DB_CONNECTION_READER)
		private readonly readerRepository: BaseRepository<Queue>,
		@InjectRepository(Queue, DB_CONNECTION_WRITER)
		private readonly writerRepository: BaseRepository<Queue>,
	) {}

	async create(queue: Queue): Promise<Queue> {
		return this.writerRepository.save(queue);
	}

	async save(queue: Queue): Promise<Queue> {
		return this.writerRepository.save(queue);
	}

	async delete(id: string): Promise<void> {
		await this.writerRepository.delete(id);
	}

	async getById(id: string): Promise<Queue | null> {
		return this.readerRepository.findOne({ where: { id } });
	}

	async getByIdAndTenantId(id: string, tenantId: string): Promise<Queue | null> {
		return this.readerRepository.findOne({ where: { id, tenantId } });
	}

	async getByTenantId(tenantId: string): Promise<Queue[]> {
		return this.readerRepository.find({
			where: { tenantId },
			order: { updatedAt: 'DESC' },
		});
	}

	async existsByNameAndTenant(
		name: string,
		tenantId: string,
		excludeId?: string,
	): Promise<boolean> {
		const qb = this.readerRepository
			.createQueryBuilder('queue')
			.where('queue.tenant_id = :tenantId', { tenantId })
			.andWhere('queue.name = :name', { name });

		if (excludeId) {
			qb.andWhere('queue.id != :excludeId', { excludeId });
		}

		const count = await qb.getCount();
		return count > 0;
	}
}
