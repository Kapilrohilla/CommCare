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

	async createCall(call: Partial<CallEntity>): Promise<CallEntity> {
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

	async findById(id: string): Promise<CallEntity | null> {
		return this.readerRepository.findOne({ where: { id } });
	}

	async findActiveClick2CallByChannel(channelId: string): Promise<CallEntity | null> {
		return this.readerRepository
			.createQueryBuilder('call')
			.where('call.workflow = :workflow', { workflow: 'click_to_call' })
			.andWhere('call.endedAt IS NULL')
			.andWhere(
				'(call.callerChannelId = :channelId OR call.calleeChannelId = :channelId)',
				{ channelId },
			)
			.orderBy('call.createdAt', 'DESC')
			.getOne();
	}

	async findClick2CallForChannel(channelId: string): Promise<CallEntity | null> {
		const active = await this.findActiveClick2CallByChannel(channelId);
		if (active) {
			return active;
		}

		return this.readerRepository
			.createQueryBuilder('call')
			.where('call.workflow = :workflow', { workflow: 'click_to_call' })
			.andWhere(
				'(call.callerChannelId = :channelId OR call.calleeChannelId = :channelId)',
				{ channelId },
			)
			.orderBy('call.createdAt', 'DESC')
			.getOne();
	}
}
