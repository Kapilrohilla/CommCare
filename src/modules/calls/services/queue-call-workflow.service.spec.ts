import { randomUUID } from 'node:crypto';

jest.mock('src/modules/pbx/services/asterisk.service', () => ({
	AsteriskService: class AsteriskService {},
}));
jest.mock('src/modules/pbx/services/extension.service', () => ({
	ExtensionService: class ExtensionService {},
}));
jest.mock('src/modules/inboundQueues/services/queues.service', () => ({
	QueuesService: class QueuesService {},
}));
jest.mock('src/modules/inboundQueues/services/queue-members.service', () => ({
	QueueMembersService: class QueueMembersService {},
}));
jest.mock('src/modules/inboundQueues/services/asterisk-queue-adapter.service', () => ({
	AsteriskQueueAdapter: class AsteriskQueueAdapter {},
}));
jest.mock('src/modules/inboundQueues/repositories/queue-call.repository', () => ({
	QueueCallRepository: class QueueCallRepository {},
}));
jest.mock('src/modules/inboundQueues/repositories/queue-call-event.repository', () => ({
	QueueCallEventRepository: class QueueCallEventRepository {},
}));

import { STASIS_WORKFLOW, buildQueueAppArgs } from 'src/constants/stasis-app-args.constant';
import { ExtensionStatus } from 'src/modules/pbx/constants/extension.constant';
import {
	QueueCallEventType,
	QueueCallStatus,
	QueueStrategy,
} from 'src/modules/inboundQueues/constants/queue.constant';
import { QueueCallEntity } from 'src/modules/inboundQueues/entity/queue-call.entity';
import { QueueMember } from 'src/modules/inboundQueues/entity/queue-member.entity';
import { Queue } from 'src/modules/inboundQueues/entity/queue.entity';

import { QueueCallWorkflowService } from './queue-call-workflow.service';

function buildQueue(overrides: Partial<Queue> = {}): Queue {
	return Object.assign(new Queue(), {
		id: 'queue-1',
		tenantId: 'tenant-1',
		name: 'Sales',
		strategy: QueueStrategy.RingAll,
		ringTimeoutSeconds: 15,
		maxWaitTimeSeconds: 300,
		maxCallers: null,
		roundRobinCursorMemberId: null,
		enabled: true,
		...overrides,
	});
}

function buildMember(overrides: Partial<QueueMember> = {}): QueueMember {
	return Object.assign(new QueueMember(), {
		id: 'member-1',
		queueId: 'queue-1',
		agentId: 'agent-1',
		priority: 0,
		penalty: 0,
		enabled: true,
		...overrides,
	});
}

/** In-memory fake so getById reflects mutations made via save/create, like a real repo. */
function buildFakeQueueCallRepository() {
	const store = new Map<string, QueueCallEntity>();
	return {
		create: jest.fn(async (queueCall: QueueCallEntity) => {
			queueCall.id = queueCall.id || randomUUID();
			store.set(queueCall.id, queueCall);
			return queueCall;
		}),
		save: jest.fn(async (queueCall: QueueCallEntity) => {
			store.set(queueCall.id, queueCall);
			return queueCall;
		}),
		getById: jest.fn(async (id: string) => store.get(id) ?? null),
		countActiveByQueueId: jest.fn(async () => 0),
		getActiveByQueueId: jest.fn(async () => []),
		findActiveBridgedByAgentId: jest.fn(async () => null),
		getAggregatesByQueueId: jest.fn(async () => []),
		__store: store,
	};
}

describe('QueueCallWorkflowService', () => {
	const channelId = 'caller-channel-1';

	function buildStasisStartEvent(queue: Queue) {
		const args = buildQueueAppArgs({
			tenantId: queue.tenantId,
			queueId: queue.id,
			queueCallId: '',
			leg: 'caller',
		});
		return {
			type: 'StasisStart',
			channel: { id: channelId, caller: { number: '9999999999' } },
			args,
		} as never;
	}

	function buildService(queue: Queue, members: QueueMember[]) {
		const queueCallRepository = buildFakeQueueCallRepository();
		const queueCallEventRepository = { save: jest.fn(), getByQueueCallId: jest.fn() };
		const queuesService = {
			getEnabledQueueForTenant: jest.fn(async () => queue),
			saveQueue: jest.fn(async (q: Queue) => q),
		};
		const queueMembersService = {
			getEnabledMembersForQueue: jest.fn(async () => members),
		};
		const asteriskService = {
			hangupChannel: jest.fn(),
			answerChannel: jest.fn(),
		};
		const extensionService = {
			getExtensionsByUserId: jest.fn(async (agentId: string) => [
				{
					id: `ext-${agentId}`,
					tenantId: queue.tenantId,
					status: ExtensionStatus.ASSIGNED,
					pjsipEndpoint: `PJSIP/${agentId}`,
				},
			]),
		};
		let ringCounter = 0;
		const asteriskQueueAdapter = {
			ringMember: jest.fn(async () => ({
				id: `agent-channel-${++ringCounter}`,
				name: 'agent',
				state: 'Ring',
				caller: { name: '', number: '' },
			})),
			bridgeCallerAndAgent: jest.fn(async () => ({ id: 'bridge-1' })),
			cancelRing: jest.fn(),
		};

		const service = new QueueCallWorkflowService(
			queuesService as never,
			queueMembersService as never,
			asteriskQueueAdapter as never,
			queueCallRepository as never,
			queueCallEventRepository as never,
			asteriskService as never,
			extensionService as never,
		);

		return {
			service,
			queueCallRepository,
			queueCallEventRepository,
			queuesService,
			queueMembersService,
			asteriskService,
			extensionService,
			asteriskQueueAdapter,
		};
	}

	it('rejects a new caller once the queue is at maxCallers', async () => {
		const queue = buildQueue({ maxCallers: 1 });
		const { service, queueCallRepository, asteriskService, queueCallEventRepository } =
			buildService(queue, [buildMember()]);
		queueCallRepository.countActiveByQueueId.mockResolvedValue(1);

		await service.handleEvent('StasisStart', buildStasisStartEvent(queue), 0);

		expect(asteriskService.hangupChannel).toHaveBeenCalledWith(channelId);
		expect(queueCallEventRepository.save).toHaveBeenCalledWith(
			expect.objectContaining({ eventType: QueueCallEventType.QueueFull }),
		);
	});

	it('times out immediately when there are no eligible members', async () => {
		const queue = buildQueue();
		const { service, asteriskService, queueCallEventRepository } = buildService(queue, []);

		await service.handleEvent('StasisStart', buildStasisStartEvent(queue), 0);

		expect(asteriskService.hangupChannel).toHaveBeenCalledWith(channelId);
		expect(queueCallEventRepository.save).toHaveBeenCalledWith(
			expect.objectContaining({ eventType: QueueCallEventType.QueueTimeout }),
		);
	});

	it('rings the eligible member, answers on ChannelStateChange Up, and bridges', async () => {
		const queue = buildQueue({ strategy: QueueStrategy.RingAll });
		const member = buildMember();
		const {
			service,
			queueCallRepository,
			asteriskService,
			asteriskQueueAdapter,
			queueCallEventRepository,
		} = buildService(queue, [member]);

		await service.handleEvent('StasisStart', buildStasisStartEvent(queue), 0);

		expect(asteriskService.answerChannel).toHaveBeenCalledWith(channelId);
		expect(asteriskQueueAdapter.ringMember).toHaveBeenCalledTimes(1);

		const queueCall = queueCallRepository.create.mock.calls[0][0] as QueueCallEntity;
		expect(queueCall.status).toBe(QueueCallStatus.Ringing);
		expect(queueCall.ringingChannelIds).toHaveLength(1);
		const ringingChannelId = queueCall.ringingChannelIds[0];

		await service.handleEvent(
			'ChannelStateChange',
			{ type: 'ChannelStateChange', channel: { id: ringingChannelId, state: 'Up' } } as never,
			0,
		);

		expect(asteriskQueueAdapter.bridgeCallerAndAgent).toHaveBeenCalledWith(
			channelId,
			ringingChannelId,
		);
		expect(queueCall.status).toBe(QueueCallStatus.Bridged);
		expect(queueCall.answeredAgentId).toBe(member.agentId);
		expect(queueCallEventRepository.save).toHaveBeenCalledWith(
			expect.objectContaining({ eventType: QueueCallEventType.CallBridged }),
		);
	});

	it('marks the call abandoned when the caller hangs up while ringing', async () => {
		const queue = buildQueue();
		const member = buildMember();
		const { service, queueCallRepository, asteriskQueueAdapter, queueCallEventRepository } =
			buildService(queue, [member]);

		await service.handleEvent('StasisStart', buildStasisStartEvent(queue), 0);
		const queueCall = queueCallRepository.create.mock.calls[0][0] as QueueCallEntity;
		const ringingChannelId = queueCall.ringingChannelIds[0];

		await service.handleEvent(
			'ChannelDestroyed',
			{ type: 'ChannelDestroyed', channel: { id: channelId }, cause: 16 } as never,
			0,
		);

		expect(queueCall.status).toBe(QueueCallStatus.Abandoned);
		expect(asteriskQueueAdapter.cancelRing).toHaveBeenCalledWith(ringingChannelId);
		expect(queueCallEventRepository.save).toHaveBeenCalledWith(
			expect.objectContaining({ eventType: QueueCallEventType.CallerAbandoned }),
		);
	});

	it('advances past a no-answer member and times out once maxWaitTime elapses', async () => {
		const queue = buildQueue({ maxWaitTimeSeconds: 10 });
		const member = buildMember();
		const { service, queueCallRepository, asteriskService, queueCallEventRepository } =
			buildService(queue, [member]);

		await service.handleEvent('StasisStart', buildStasisStartEvent(queue), 0);
		const queueCall = queueCallRepository.create.mock.calls[0][0] as QueueCallEntity;
		const ringingChannelId = queueCall.ringingChannelIds[0];

		// Simulate the queue call having been waiting long enough to exceed maxWaitTimeSeconds
		queueCall.enteredAt = new Date(Date.now() - 60_000);

		await service.handleEvent(
			'ChannelDestroyed',
			{
				type: 'ChannelDestroyed',
				channel: { id: ringingChannelId },
				cause: 19, // no answer
			} as never,
			0,
		);

		expect(queueCall.status).toBe(QueueCallStatus.TimedOut);
		expect(asteriskService.hangupChannel).toHaveBeenCalledWith(channelId);
		expect(queueCallEventRepository.save).toHaveBeenCalledWith(
			expect.objectContaining({ eventType: QueueCallEventType.AgentUnavailable }),
		);
		expect(queueCallEventRepository.save).toHaveBeenCalledWith(
			expect.objectContaining({ eventType: QueueCallEventType.QueueTimeout }),
		);
	});

	it('canHandle only matches events tagged for the queue workflow', () => {
		const service = buildService(buildQueue(), []).service;
		expect(service.canHandle({ args: [STASIS_WORKFLOW.QUEUE] } as never)).toBe(true);
		expect(service.canHandle({ args: [STASIS_WORKFLOW.IVR] } as never)).toBe(false);
		expect(service.canHandle({ args: undefined } as never)).toBe(false);
	});
});
