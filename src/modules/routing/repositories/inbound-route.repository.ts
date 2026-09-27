import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from 'src/infra/database/connectors/baseRepository';
import {
	DB_CONNECTION_READER,
	DB_CONNECTION_WRITER,
} from 'src/infra/database/postgresql/postgresqlConfig';
import {
	InboundRouteDestinationType,
	InboundRouteSourceType,
} from '../constants/inbound-routes.constant';
import { InboundRoute } from '../entity/inbound-route.entity';

@Injectable()
export class InboundRouteRepository {
	constructor(
		@InjectRepository(InboundRoute, DB_CONNECTION_READER)
		private readonly readerRepository: BaseRepository<InboundRoute>,
		@InjectRepository(InboundRoute, DB_CONNECTION_WRITER)
		private readonly writerRepository: BaseRepository<InboundRoute>,
	) {}

	async create(route: InboundRoute): Promise<InboundRoute> {
		return this.writerRepository.save(route);
	}

	async save(route: InboundRoute): Promise<InboundRoute> {
		return this.writerRepository.save(route);
	}

	async delete(id: string): Promise<void> {
		await this.writerRepository.delete(id);
	}

	async getById(id: string): Promise<InboundRoute | null> {
		return this.readerRepository.findOne({ where: { id } });
	}

	async getByIdAndTenantId(
		id: string,
		tenantId: string,
	): Promise<InboundRoute | null> {
		return this.readerRepository.findOne({ where: { id, tenantId } });
	}

	async getByTenantId(tenantId: string): Promise<InboundRoute[]> {
		return this.readerRepository.find({
			where: { tenantId },
			order: { updatedAt: 'DESC' },
		});
	}

	async getEnabledBySourceValue(sourceValue: string): Promise<InboundRoute | null> {
		return this.readerRepository.findOne({
			where: { sourceValue, enabled: true },
		});
	}

	async getEnabledBySourceTypeAndId(
		sourceType: InboundRouteSourceType,
		sourceId: string,
	): Promise<InboundRoute | null> {
		return this.readerRepository.findOne({
			where: { sourceType, sourceId, enabled: true },
		});
	}

	async existsBySource(
		sourceType: InboundRouteSourceType,
		sourceId: string,
	): Promise<boolean> {
		const count = await this.readerRepository.count({
			where: { sourceType, sourceId },
		});
		return count > 0;
	}

	async existsEnabledBySourceTypeAndId(
		sourceType: InboundRouteSourceType,
		sourceId: string,
		excludeId?: string,
	): Promise<boolean> {
		const qb = this.readerRepository
			.createQueryBuilder('route')
			.where('route.source_type = :sourceType', { sourceType })
			.andWhere('route.source_id = :sourceId', { sourceId })
			.andWhere('route.enabled = true');

		if (excludeId) {
			qb.andWhere('route.id != :excludeId', { excludeId });
		}

		const count = await qb.getCount();
		return count > 0;
	}

	async existsBySourceValue(
		sourceValue: string,
		excludeId?: string,
	): Promise<boolean> {
		const qb = this.readerRepository
			.createQueryBuilder('route')
			.where('route.source_value = :sourceValue', { sourceValue });

		if (excludeId) {
			qb.andWhere('route.id != :excludeId', { excludeId });
		}

		const count = await qb.getCount();
		return count > 0;
	}

	async existsByDestination(
		destinationType: InboundRouteDestinationType,
		destinationId: string,
	): Promise<boolean> {
		const count = await this.readerRepository.count({
			where: { destinationType, destinationId },
		});
		return count > 0;
	}
}
