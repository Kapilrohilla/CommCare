import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from 'src/infra/database/connectors/baseRepository';
import {
	DB_CONNECTION_READER,
	DB_CONNECTION_WRITER,
} from 'src/infra/database/postgresql/postgresqlConfig';
import { IVRSessionEntity } from '../entity/ivr-session.entity';

@Injectable()
export class IVRSessionRepository {
	constructor(
		@InjectRepository(IVRSessionEntity, DB_CONNECTION_READER)
		private readonly readerRepository: BaseRepository<IVRSessionEntity>,
		@InjectRepository(IVRSessionEntity, DB_CONNECTION_WRITER)
		private readonly writerRepository: BaseRepository<IVRSessionEntity>,
	) {}

	create(session: IVRSessionEntity): Promise<IVRSessionEntity> {
		return this.writerRepository.save(session);
	}

	save(session: IVRSessionEntity): Promise<IVRSessionEntity> {
		return this.writerRepository.save(session);
	}

	async delete(id: string): Promise<void> {
		await this.writerRepository.delete(id);
	}

	getById(id: string): Promise<IVRSessionEntity | null> {
		return this.readerRepository.findOne({ where: { id } });
	}

	getByIdAndTenantId(
		id: string,
		tenantId: string,
	): Promise<IVRSessionEntity | null> {
		return this.readerRepository.findOne({ where: { id, tenantId } });
	}

	getByCallId(callId: string): Promise<IVRSessionEntity | null> {
		return this.readerRepository.findOne({
			where: { callId },
			order: { createdAt: 'DESC' },
		});
	}

	getByCallIdAndTenantId(
		callId: string,
		tenantId: string,
	): Promise<IVRSessionEntity | null> {
		return this.readerRepository.findOne({
			where: { callId, tenantId },
			order: { createdAt: 'DESC' },
		});
	}

	getByIvrId(ivrId: string): Promise<IVRSessionEntity[]> {
		return this.readerRepository.find({
			where: { ivrId },
			order: { createdAt: 'DESC' },
		});
	}
}
