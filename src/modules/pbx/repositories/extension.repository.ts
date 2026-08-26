import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

	async findAssignedUserIdByExtension(extensionNumber: string | null): Promise<string | null> {
		if (!extensionNumber) {
			return null;
		}

		const extension = await this.getExtensionByNumber(extensionNumber);
		return extension?.userId ?? null;
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

	async reserveAvailableForTenant(tenantId: string, count: number): Promise<Extension[]> {
		return this.writerRepository.manager.transaction(async (manager) => {
			const extensions = await manager
				.getRepository(Extension)
				.createQueryBuilder('extension')
				.setLock('pessimistic_write')
				.where('extension.status = :status', { status: ExtensionStatus.AVAILABLE })
				.andWhere('extension.tenantId IS NULL')
				.orderBy('CAST(extension.extension AS INTEGER)', 'ASC')
				.limit(count)
				.getMany();

			if (extensions.length === 0) {
				return [];
			}

			for (const extension of extensions) {
				extension.tenantId = tenantId;
				extension.status = ExtensionStatus.RESERVED;
			}

			return manager.save(Extension, extensions);
		});
	}

	async assignReservedExtensionsToUser(
		tenantId: string,
		userId: string,
		extensionIds: string[],
		userInfo: UserInfo,
	): Promise<Extension[]> {
		if (extensionIds.length === 0) {
			return [];
		}

		return this.writerRepository.manager.transaction(async (manager) => {
			const extensions = await manager
				.getRepository(Extension)
				.createQueryBuilder('extension')
				.setLock('pessimistic_write')
				.where('extension.id IN (:...ids)', { ids: extensionIds })
				.andWhere('extension.tenantId = :tenantId', { tenantId })
				.getMany();

			if (extensions.length !== extensionIds.length) {
				throw new NotFoundException('One or more extensions not found for this tenant');
			}

			for (const extension of extensions) {
				if (extension.status !== ExtensionStatus.RESERVED) {
					throw new BadRequestException(
						`Extension ${extension.extension} is not available for assignment`,
					);
				}
				if (extension.userId) {
					throw new BadRequestException(
						`Extension ${extension.extension} is already assigned to a user`,
					);
				}

				extension.userId = userId;
				extension.userInfo = { name: userInfo.name, userId };
				extension.status = ExtensionStatus.ASSIGNED;
				extension.callerIdName = userInfo.name;
			}

			return manager.save(Extension, extensions);
		});
	}

	async getExtensionForTenant(tenantId: string, id: string): Promise<Extension | null> {
		return this.readerRepository.findOne({ where: { id, tenantId } });
	}

	async updateUserInfoForUser(userId: string, userInfo: UserInfo): Promise<void> {
		await this.writerRepository.update({ userId }, { userInfo });
	}
}
