import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from 'src/infra/database/connectors/baseRepository';
import {
	DB_CONNECTION_READER,
	DB_CONNECTION_WRITER,
} from 'src/infra/database/postgresql/postgresqlConfig';
import { Extension } from '../entity/extension.entity';
import { BASE_EXTENSION_ID } from '../constants/extension.constant';

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
}
