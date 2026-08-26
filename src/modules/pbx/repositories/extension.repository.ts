import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull } from 'typeorm';
import { BaseRepository } from 'src/infra/database/connectors/baseRepository';
import {
	DB_CONNECTION_READER,
	DB_CONNECTION_WRITER,
} from 'src/infra/database/postgresql/postgresqlConfig';
import { Extension, UserInfo } from '../entity/extension.entity';
import { BASE_EXTENSION_ID, ExtensionStatus } from '../constants/extension.constant';

@Injectable()
export class ExtensionRepository {
	constructor(
		@InjectRepository(Extension, DB_CONNECTION_WRITER)
		private readonly writerRepository: BaseRepository<Extension>,
		@InjectRepository(Extension, DB_CONNECTION_READER)
		private readonly readerRepository: BaseRepository<Extension>,
	) {}

	async createExtension(extension: Extension): Promise<Extension> {
		return this.writerRepository.save(extension);
	}

	async getExtension(id: string): Promise<Extension | null> {
		return this.readerRepository.findOne({ where: { id } });
	}

	async getExtensionByNumber(extensionNumber: string): Promise<Extension | null> {
		return this.readerRepository.findOne({ where: { extension: extensionNumber } });
	}

	async updateExtension(extension: Extension): Promise<Extension> {
		return this.writerRepository.save(extension);
	}

	async deleteExtension(id: string): Promise<void> {
		await this.writerRepository.delete(id);
	}

	async getExtensionsByTenantId(tenantId: string): Promise<Extension[]> {
		return this.readerRepository.find({ where: { tenantId } });
	}

	async getExtensionsByUserId(userId: string): Promise<Extension[]> {
		return this.readerRepository.find({ where: { userId } });
	}

	async getMaxExtensionId(): Promise<number> {
		const maxExtension = await this.readerRepository
			.createQueryBuilder('extension')
			.select('MAX(CAST(extension.extension AS INTEGER))', 'max')
			.getRawOne<{ max: string | null }>();

		if (maxExtension?.max) {
			return parseInt(maxExtension.max, 10);
		}

		return BASE_EXTENSION_ID;
	}

	async getExtensions(): Promise<Extension[]> {
		return this.readerRepository.find();
	}

	countAvailable(): Promise<number> {
		return this.readerRepository.count({
			where: { status: ExtensionStatus.AVAILABLE, tenantId: IsNull() },
		});
	}

	async findAvailableForAssignment(count: number): Promise<Extension[]> {
		return this.writerRepository
			.createQueryBuilder('extension')
			.setLock('pessimistic_write')
			.where('extension.status = :status', { status: ExtensionStatus.AVAILABLE })
			.andWhere('extension.tenant_id IS NULL')
			.orderBy('CAST(extension.extension AS INTEGER)', 'ASC')
			.limit(count)
			.getMany();
	}

	async findOneAvailableForAssignment(): Promise<Extension | null> {
		const extensions = await this.findAvailableForAssignment(1);
		return extensions[0] ?? null;
	}

	async findByIdsForTenant(tenantId: string, ids: string[]): Promise<Extension[]> {
		if (ids.length === 0) {
			return [];
		}
		return this.writerRepository
			.createQueryBuilder('extension')
			.setLock('pessimistic_write')
			.where('extension.id IN (:...ids)', { ids })
			.andWhere('extension.tenant_id = :tenantId', { tenantId })
			.getMany();
	}

	async getExtensionForTenant(tenantId: string, id: string): Promise<Extension | null> {
		return this.readerRepository.findOne({ where: { id, tenantId } });
	}

	async updateUserInfoForUser(userId: string, userInfo: UserInfo): Promise<void> {
		await this.writerRepository.update({ userId }, { userInfo });
	}
}
