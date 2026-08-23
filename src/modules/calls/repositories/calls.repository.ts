import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from '../../../infra/database/connectors/baseRepository';
import {
	DB_CONNECTION_READER,
	DB_CONNECTION_WRITER,
} from '../../../infra/database/postgresql/postgresqlConfig';
import { CallEntity } from '../entity/calls.entity';

@Injectable()
export class CallsRepository {
	constructor(
		@InjectRepository(CallEntity, DB_CONNECTION_WRITER)
		private readonly writerRepository: BaseRepository<CallEntity>,
		@InjectRepository(CallEntity, DB_CONNECTION_READER)
		private readonly readerRepository: BaseRepository<CallEntity>,
	) {}

	async createCall(call: CallEntity): Promise<CallEntity> {
		return this.writerRepository.save(call);
	}

	async updateCall(call: CallEntity): Promise<CallEntity> {
		return this.writerRepository.save(call);
	}

	async deleteCall(id: string): Promise<void> {
		await this.writerRepository.delete(id);
	}

	async getCallById(id: string): Promise<CallEntity> {
		const call = await this.readerRepository.findOne({ where: { id } });
		if (!call) {
			throw new NotFoundException('Call not found');
		}
		return call;
	}

	async getCalls(): Promise<CallEntity[]> {
		return this.readerRepository.find();
	}

	async findByLinkedId(linkedId: string): Promise<CallEntity | null> {
		return this.readerRepository.findOne({ where: { linkedId } });
	}
}
