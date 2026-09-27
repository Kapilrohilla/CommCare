import { ConflictException, NotFoundException } from '@nestjs/common';
import { Queue } from '../entity/queue.entity';
import { QueueMember } from '../entity/queue-member.entity';
import { QueueMembersService } from './queue-members.service';

describe('QueueMembersService', () => {
	const auth = { tenantId: 'tenant-1', userId: 'user-1' } as never;
	const queue = Object.assign(new Queue(), { id: 'queue-1', tenantId: 'tenant-1' });

	function buildService(overrides?: {
		getByQueueIdAndAgentId?: jest.Mock;
		findById?: jest.Mock;
	}) {
		const queueMemberRepository = {
			create: jest.fn(async (member: QueueMember) => member),
			save: jest.fn(),
			delete: jest.fn(),
			getById: jest.fn(),
			getByQueueId: jest.fn(async () => []),
			getByQueueIdAndAgentId:
				overrides?.getByQueueIdAndAgentId ?? jest.fn(async () => null),
			countByQueueId: jest.fn(async () => 0),
		};
		const queuesService = {
			getQueueById: jest.fn(async () => queue),
		};
		const userService = {
			findById:
				overrides?.findById ??
				jest.fn(async () => ({ id: 'agent-1', tenantId: 'tenant-1' })),
		};

		const service = new QueueMembersService(
			queueMemberRepository as never,
			queuesService as never,
			userService as never,
		);

		return { service, queueMemberRepository, queuesService, userService };
	}

	it('rejects an agent that does not exist', async () => {
		const { service } = buildService({ findById: jest.fn(async () => null) });

		await expect(
			service.addMember(auth, 'queue-1', { agentId: 'agent-1' } as never),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it('rejects an agent from a different tenant', async () => {
		const { service } = buildService({
			findById: jest.fn(async () => ({ id: 'agent-1', tenantId: 'tenant-2' })),
		});

		await expect(
			service.addMember(auth, 'queue-1', { agentId: 'agent-1' } as never),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it('rejects adding an agent already in the queue', async () => {
		const { service } = buildService({
			getByQueueIdAndAgentId: jest.fn(async () => new QueueMember()),
		});

		await expect(
			service.addMember(auth, 'queue-1', { agentId: 'agent-1' } as never),
		).rejects.toBeInstanceOf(ConflictException);
	});

	it('adds a member with defaults applied', async () => {
		const { service, queueMemberRepository } = buildService();

		const member = await service.addMember(auth, 'queue-1', {
			agentId: 'agent-1',
		} as never);

		expect(member.queueId).toBe('queue-1');
		expect(member.priority).toBe(0);
		expect(member.penalty).toBe(0);
		expect(member.enabled).toBe(true);
		expect(queueMemberRepository.create).toHaveBeenCalled();
	});

	it('throws when removing a member that is not in the queue', async () => {
		const { service } = buildService();

		await expect(
			service.removeMember(auth, 'queue-1', 'agent-1'),
		).rejects.toBeInstanceOf(NotFoundException);
	});
});
