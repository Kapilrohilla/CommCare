import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from 'src/infra/database/connectors/baseRepository';
import {
	DB_CONNECTION_READER,
	DB_CONNECTION_WRITER,
} from 'src/infra/database/postgresql/postgresqlConfig';
import { PhoneNumberStatus } from '../constants/phone-number.constant';
import { PhoneNumber } from '../entity/phone-number.entity';

export interface PhoneNumberFilters {
	sipTrunkId?: string;
	status?: PhoneNumberStatus;
	search?: string;
}

@Injectable()
export class PhoneNumberRepository {
	constructor(
		@InjectRepository(PhoneNumber, DB_CONNECTION_READER)
		private readonly readerRepository: BaseRepository<PhoneNumber>,
		@InjectRepository(PhoneNumber, DB_CONNECTION_WRITER)
		private readonly writerRepository: BaseRepository<PhoneNumber>,
	) {}

	create(phoneNumber: PhoneNumber): Promise<PhoneNumber> {
		return this.writerRepository.save(phoneNumber);
	}

	save(phoneNumber: PhoneNumber): Promise<PhoneNumber> {
		return this.writerRepository.save(phoneNumber);
	}

	delete(id: string): Promise<void> {
		return this.writerRepository.delete(id).then(() => undefined);
	}

	getById(id: string): Promise<PhoneNumber | null> {
		return this.readerRepository.findOne({ where: { id } });
	}

	getByIdAndTenantId(id: string, tenantId: string): Promise<PhoneNumber | null> {
		return this.readerRepository.findOne({ where: { id, tenantId } });
	}

	getByTenantId(tenantId: string, filters?: PhoneNumberFilters): Promise<PhoneNumber[]> {
		const qb = this.readerRepository
			.createQueryBuilder('phoneNumber')
			.where('phoneNumber.tenant_id = :tenantId', { tenantId });

		if (filters?.sipTrunkId) {
			qb.andWhere('phoneNumber.sip_trunk_id = :sipTrunkId', {
				sipTrunkId: filters.sipTrunkId,
			});
		}

		if (filters?.status) {
			qb.andWhere('phoneNumber.status = :status', { status: filters.status });
		}

		if (filters?.search) {
			qb.andWhere('(phoneNumber.number ILIKE :search OR phoneNumber.name ILIKE :search)', {
				search: `%${filters.search}%`,
			});
		}

		return qb.orderBy('phoneNumber.updated_at', 'DESC').getMany();
	}

	/** Unscoped by tenant — used by inbound-call resolution, which has no tenant context yet. */
	findByNumber(number: string): Promise<PhoneNumber | null> {
		return this.readerRepository.findOne({ where: { number } });
	}

	/** Global uniqueness check (see plan decision: DIDs are unique across all tenants). */
	async existsByNumber(number: string, excludeId?: string): Promise<boolean> {
		const qb = this.readerRepository
			.createQueryBuilder('phoneNumber')
			.where('phoneNumber.number = :number', { number });

		if (excludeId) {
			qb.andWhere('phoneNumber.id != :excludeId', { excludeId });
		}

		const count = await qb.getCount();
		return count > 0;
	}
}
