import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { BaseRepository } from 'src/infra/database/connectors/baseRepository';
import {
	DB_CONNECTION_READER,
	DB_CONNECTION_WRITER,
} from 'src/infra/database/postgresql/postgresqlConfig';
import { QueueCallStatus } from '../constants/queue.constant';
import { QueueCallEntity } from '../entity/queue-call.entity';

const ACTIVE_STATUSES = [QueueCallStatus.Waiting, QueueCallStatus.Ringing];

export interface QueueMemberAggregate {
	agentId: string;
	answeredCount: number;
	lastBridgedAt: Date | null;
}

@Injectable()
export class QueueCallRepository {
	constructor(
		@InjectRepository(QueueCallEntity, DB_CONNECTION_READER)
		private readonly readerRepository: BaseRepository<QueueCallEntity>,
		@InjectRepository(QueueCallEntity, DB_CONNECTION_WRITER)
		private readonly writerRepository: BaseRepository<QueueCallEntity>,
	) {}

	async create(queueCall: QueueCallEntity): Promise<QueueCallEntity> {
		return this.writerRepository.save(queueCall);
	}

	async save(queueCall: QueueCallEntity): Promise<QueueCallEntity> {
		return this.writerRepository.save(queueCall);
	}

	async getById(id: string): Promise<QueueCallEntity | null> {
		return this.readerRepository.findOne({ where: { id } });
	}

	async getByCallerChannelId(callerChannelId: string): Promise<QueueCallEntity | null> {
		return this.readerRepository.findOne({ where: { callerChannelId } });
	}

	async countActiveByQueueId(queueId: string): Promise<number> {
		return this.readerRepository.count({
			where: { queueId, status: In(ACTIVE_STATUSES) },
		});
	}

	async getActiveByQueueId(queueId: string): Promise<QueueCallEntity[]> {
		return this.readerRepository.find({
			where: { queueId, status: In(ACTIVE_STATUSES) },
			order: { enteredAt: 'ASC' },
		});
	}

	async findActiveBridgedByAgentId(agentId: string): Promise<QueueCallEntity | null> {
		return this.readerRepository.findOne({
			where: { answeredAgentId: agentId, status: QueueCallStatus.Bridged },
		});
	}

	/** Per-agent answered-call count and last bridged timestamp, for fewest_calls/least_recent strategies. */
	async getAggregatesByQueueId(queueId: string): Promise<QueueMemberAggregate[]> {
		const rows = await this.readerRepository
			.createQueryBuilder('queueCall')
			.select('queueCall.answered_agent_id', 'agentId')
			.addSelect('COUNT(*)', 'answeredCount')
			.addSelect('MAX(queueCall.bridged_at)', 'lastBridgedAt')
			.where('queueCall.queue_id = :queueId', { queueId })
			.andWhere('queueCall.answered_agent_id IS NOT NULL')
			.groupBy('queueCall.answered_agent_id')
			.getRawMany<{ agentId: string; answeredCount: string; lastBridgedAt: Date | null }>();

		return rows.map((row) => ({
			agentId: row.agentId,
			answeredCount: Number(row.answeredCount),
			lastBridgedAt: row.lastBridgedAt ? new Date(row.lastBridgedAt) : null,
		}));
	}
}
