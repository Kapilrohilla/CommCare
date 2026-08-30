import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from 'src/infra/database/connectors/baseRepository';
import { SystemRecording } from '../entity/system-recording.entity';
import {
	DB_CONNECTION_READER,
	DB_CONNECTION_WRITER,
} from 'src/infra/database/postgresql/postgresqlConfig';

@Injectable()
export class SystemRecordingRepository {
	constructor(
		@InjectRepository(SystemRecording, DB_CONNECTION_READER)
		private readonly readerRepository: BaseRepository<SystemRecording>,
		@InjectRepository(SystemRecording, DB_CONNECTION_WRITER)
		private readonly writerRepository: BaseRepository<SystemRecording>,
	) {}

	async create(systemRecording: SystemRecording): Promise<SystemRecording> {
		return this.writerRepository.save(systemRecording);
	}

	async save(systemRecording: SystemRecording): Promise<SystemRecording> {
		return this.writerRepository.save(systemRecording);
	}

	async delete(id: string): Promise<void> {
		await this.writerRepository.delete(id);
	}

	async getByTenantId(tenantId: string): Promise<SystemRecording[]> {
		return this.readerRepository.find({
			where: { tenantId },
			order: { createdAt: 'DESC' },
		});
	}

	async getById(id: string): Promise<SystemRecording | null> {
		return this.readerRepository.findOne({ where: { id } });
	}

	async getByIdAndTenantId(
		id: string,
		tenantId: string,
	): Promise<SystemRecording | null> {
		return this.readerRepository.findOne({ where: { id, tenantId } });
	}
}
