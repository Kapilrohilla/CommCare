import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from 'src/infra/database/connectors/baseRepository';
import {
	DB_CONNECTION_READER,
	DB_CONNECTION_WRITER,
} from 'src/infra/database/postgresql/postgresqlConfig';
import { IVROptionEntity } from '../entity/ivr-options.entity';

@Injectable()
export class IVROptionsRepository {
	constructor(
		@InjectRepository(IVROptionEntity, DB_CONNECTION_READER)
		private readonly readerRepository: BaseRepository<IVROptionEntity>,
		@InjectRepository(IVROptionEntity, DB_CONNECTION_WRITER)
		private readonly writerRepository: BaseRepository<IVROptionEntity>,
	) {}

	async create(option: IVROptionEntity): Promise<IVROptionEntity> {
		return this.writerRepository.save(option);
	}

	async save(option: IVROptionEntity): Promise<IVROptionEntity> {
		return this.writerRepository.save(option);
	}

	async delete(id: string): Promise<void> {
		await this.writerRepository.delete(id);
	}

	async deleteByIvrId(ivrId: string): Promise<void> {
		await this.writerRepository.delete({ ivrId });
	}

	async getById(id: string): Promise<IVROptionEntity | null> {
		return this.readerRepository.findOne({ where: { id } });
	}

	async getByIdAndIvrId(
		id: string,
		ivrId: string,
	): Promise<IVROptionEntity | null> {
		return this.readerRepository.findOne({ where: { id, ivrId } });
	}

	async getByIvrId(ivrId: string): Promise<IVROptionEntity[]> {
		return this.readerRepository.find({
			where: { ivrId },
			order: { digit: 'ASC' },
		});
	}

	async getByIvrIdAndDigit(
		ivrId: string,
		digit: string,
	): Promise<IVROptionEntity | null> {
		return this.readerRepository.findOne({ where: { ivrId, digit } });
	}
}
