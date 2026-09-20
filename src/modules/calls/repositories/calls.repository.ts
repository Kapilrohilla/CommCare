import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from '../../../infra/database/connectors/baseRepository';
import {
	DB_CONNECTION_READER,
	DB_CONNECTION_WRITER,
} from '../../../infra/database/postgresql/postgresqlConfig';
import {
	CallDirection,
	CallStatus,
	CallWorkflow,
} from '../constants/call.constant';
import { CallEntity } from '../entity/calls.entity';

export type CallListFilters = {
	from?: Date;
	to?: Date;
	direction?: CallDirection;
	workflow?: CallWorkflow;
	status?: CallStatus;
	agentExtension?: string;
	number?: string;
	limit: number;
	offset: number;
};

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

	async findByTenantId(
		tenantId: string,
		filters: CallListFilters,
	): Promise<{ items: CallEntity[]; total: number }> {
		const qb = this.readerRepository
			.createQueryBuilder('call')
			.where('call.tenantId = :tenantId', { tenantId });

		if (filters.from) {
			qb.andWhere('call.startedAt >= :from', { from: filters.from });
		}
		if (filters.to) {
			qb.andWhere('call.startedAt <= :to', { to: filters.to });
		}
		if (filters.direction) {
			qb.andWhere('call.direction = :direction', {
				direction: filters.direction,
			});
		}
		if (filters.workflow) {
			qb.andWhere('call.workflow = :workflow', {
				workflow: filters.workflow,
			});
		}
		if (filters.status) {
			qb.andWhere('call.status = :status', { status: filters.status });
		}
		if (filters.agentExtension) {
			qb.andWhere('call.agentExtension = :agentExtension', {
				agentExtension: filters.agentExtension,
			});
		}
		if (filters.number) {
			qb.andWhere(
				'(call.callerNumber ILIKE :number OR call.callToNumber ILIKE :number)',
				{ number: `%${filters.number}%` },
			);
		}

		const [items, total] = await qb
			.orderBy('call.startedAt', 'DESC', 'NULLS LAST')
			.addOrderBy('call.createdAt', 'DESC')
			.skip(filters.offset)
			.take(filters.limit)
			.getManyAndCount();

		return { items, total };
	}

	async findByIdAndTenantId(
		id: string,
		tenantId: string,
	): Promise<CallEntity | null> {
		return this.readerRepository.findOne({ where: { id, tenantId } });
	}

	async getDashboardStats(
		tenantId: string,
		dayStart: Date,
	): Promise<{
		callsToday: number;
		talkTimeSeconds: number;
		missedCalls: number;
		byStatus: Array<{ status: CallStatus; count: string }>;
	}> {
		const base = this.readerRepository
			.createQueryBuilder('call')
			.where('call.tenantId = :tenantId', { tenantId })
			.andWhere('call.startedAt >= :dayStart', { dayStart });

		const callsToday = await base.getCount();

		const talkRow = await this.readerRepository
			.createQueryBuilder('call')
			.select('COALESCE(SUM(call.duration), 0)', 'talkTimeSeconds')
			.where('call.tenantId = :tenantId', { tenantId })
			.andWhere('call.startedAt >= :dayStart', { dayStart })
			.getRawOne<{ talkTimeSeconds: string }>();

		const missedCalls = await this.readerRepository
			.createQueryBuilder('call')
			.where('call.tenantId = :tenantId', { tenantId })
			.andWhere('call.startedAt >= :dayStart', { dayStart })
			.andWhere('call.status IN (:...missed)', {
				missed: [
					CallStatus.NO_ANSWER,
					CallStatus.CANCELLED,
					CallStatus.BUSY,
				],
			})
			.getCount();

		const byStatus = await this.readerRepository
			.createQueryBuilder('call')
			.select('call.status', 'status')
			.addSelect('COUNT(*)', 'count')
			.where('call.tenantId = :tenantId', { tenantId })
			.andWhere('call.startedAt >= :dayStart', { dayStart })
			.groupBy('call.status')
			.getRawMany<{ status: CallStatus; count: string }>();

		return {
			callsToday,
			talkTimeSeconds: Number(talkRow?.talkTimeSeconds ?? 0),
			missedCalls,
			byStatus,
		};
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
