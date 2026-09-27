import {
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { AuthContext } from 'src/shared/types/auth.types';
import { UserService } from 'src/modules/iam/services/user.service';
import { CreateQueueMemberDto } from '../dto/queue-member.dto';
import { QueueMember } from '../entity/queue-member.entity';
import { QueueMemberRepository } from '../repositories/queue-member.repository';
import { QueuesService } from './queues.service';

@Injectable()
export class QueueMembersService {
	constructor(
		private readonly queueMemberRepository: QueueMemberRepository,
		private readonly queuesService: QueuesService,
		private readonly userService: UserService,
	) {}

	async addMember(
		auth: AuthContext,
		queueId: string,
		dto: CreateQueueMemberDto,
	): Promise<QueueMember> {
		const queue = await this.queuesService.getQueueById(auth, queueId);

		const agent = await this.userService.findById(dto.agentId);
		if (!agent || agent.tenantId !== queue.tenantId) {
			throw new NotFoundException('Agent not found for this tenant');
		}

		const existing = await this.queueMemberRepository.getByQueueIdAndAgentId(
			queue.id,
			dto.agentId,
		);
		if (existing) {
			throw new ConflictException('Agent is already a member of this queue');
		}

		const member = new QueueMember();
		member.queueId = queue.id;
		member.agentId = dto.agentId;
		member.priority = dto.priority ?? 0;
		member.penalty = dto.penalty ?? 0;
		member.enabled = dto.enabled ?? true;

		return this.queueMemberRepository.create(member);
	}

	async listMembers(auth: AuthContext, queueId: string): Promise<QueueMember[]> {
		const queue = await this.queuesService.getQueueById(auth, queueId);
		return this.queueMemberRepository.getByQueueId(queue.id);
	}

	/** Internal use by the runtime call workflow — no AuthContext required. */
	async getEnabledMembersForQueue(queueId: string): Promise<QueueMember[]> {
		const members = await this.queueMemberRepository.getByQueueId(queueId);
		return members.filter((member) => member.enabled);
	}

	async removeMember(
		auth: AuthContext,
		queueId: string,
		agentId: string,
	): Promise<void> {
		const queue = await this.queuesService.getQueueById(auth, queueId);
		const member = await this.queueMemberRepository.getByQueueIdAndAgentId(
			queue.id,
			agentId,
		);
		if (!member) {
			throw new NotFoundException('Queue member not found');
		}
		await this.queueMemberRepository.delete(member.id);
	}
}
