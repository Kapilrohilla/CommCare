import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from 'src/infra/database/connectors/baseRepository';
import {
	DB_CONNECTION_READER,
	DB_CONNECTION_WRITER,
} from 'src/infra/database/postgresql/postgresqlConfig';
import { QueueMember } from '../entity/queue-member.entity';

@Injectable()
export class QueueMemberRepository {
	constructor(
		@InjectRepository(QueueMember, DB_CONNECTION_READER)
		private readonly readerRepository: BaseRepository<QueueMember>,
		@InjectRepository(QueueMember, DB_CONNECTION_WRITER)
		private readonly writerRepository: BaseRepository<QueueMember>,
	) {}

	async create(member: QueueMember): Promise<QueueMember> {
		return this.writerRepository.save(member);
	}

	async save(member: QueueMember): Promise<QueueMember> {
		return this.writerRepository.save(member);
	}

	async delete(id: string): Promise<void> {
		await this.writerRepository.delete(id);
	}

	async getById(id: string): Promise<QueueMember | null> {
		return this.readerRepository.findOne({ where: { id } });
	}

	async getByQueueId(queueId: string): Promise<QueueMember[]> {
		return this.readerRepository.find({
			where: { queueId },
			order: { priority: 'ASC', createdAt: 'ASC' },
		});
	}

	async getByQueueIdAndAgentId(
		queueId: string,
		agentId: string,
	): Promise<QueueMember | null> {
		return this.readerRepository.findOne({ where: { queueId, agentId } });
	}

	async countByQueueId(queueId: string): Promise<number> {
		return this.readerRepository.count({ where: { queueId } });
	}
}
