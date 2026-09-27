import { QueueStrategy } from '../constants/queue.constant';
import { QueueMember } from '../entity/queue-member.entity';
import { QueueMemberAggregate } from '../repositories/queue-call.repository';
import { resolveDialSet } from './queue-strategy.util';

function buildMember(id: string, agentId: string): QueueMember {
	const member = new QueueMember();
	member.id = id;
	member.agentId = agentId;
	member.queueId = 'queue-1';
	member.priority = 0;
	member.penalty = 0;
	member.enabled = true;
	return member;
}

describe('resolveDialSet', () => {
	const members = [
		buildMember('member-1', 'agent-1'),
		buildMember('member-2', 'agent-2'),
		buildMember('member-3', 'agent-3'),
	];

	it('ring_all dials every eligible member not yet tried this cycle', () => {
		const result = resolveDialSet({
			strategy: QueueStrategy.RingAll,
			eligibleMembers: members,
			aggregates: [],
			cursorMemberId: null,
			attemptOrder: [],
		});

		expect(result.membersToRing.map((m) => m.id)).toEqual([
			'member-1',
			'member-2',
			'member-3',
		]);
	});

	it('ring_all restarts a fresh cycle once everyone has been tried', () => {
		const result = resolveDialSet({
			strategy: QueueStrategy.RingAll,
			eligibleMembers: members,
			aggregates: [],
			cursorMemberId: null,
			attemptOrder: ['member-1', 'member-2', 'member-3'],
		});

		expect(result.membersToRing).toHaveLength(3);
	});

	it('round_robin rotates one member at a time from the cursor', () => {
		const first = resolveDialSet({
			strategy: QueueStrategy.RoundRobin,
			eligibleMembers: members,
			aggregates: [],
			cursorMemberId: null,
			attemptOrder: [],
		});
		expect(first.membersToRing.map((m) => m.id)).toEqual(['member-1']);
		expect(first.nextCursorMemberId).toBe('member-1');

		const second = resolveDialSet({
			strategy: QueueStrategy.RoundRobin,
			eligibleMembers: members,
			aggregates: [],
			cursorMemberId: first.nextCursorMemberId ?? null,
			attemptOrder: [],
		});
		expect(second.membersToRing.map((m) => m.id)).toEqual(['member-2']);

		const wrapped = resolveDialSet({
			strategy: QueueStrategy.RoundRobin,
			eligibleMembers: members,
			aggregates: [],
			cursorMemberId: 'member-3',
			attemptOrder: [],
		});
		expect(wrapped.membersToRing.map((m) => m.id)).toEqual(['member-1']);
	});

	it('least_recent picks the member whose last bridged call is oldest (or never)', () => {
		const aggregates: QueueMemberAggregate[] = [
			{ agentId: 'agent-1', answeredCount: 5, lastBridgedAt: new Date('2026-01-01') },
			{ agentId: 'agent-2', answeredCount: 1, lastBridgedAt: null },
			{ agentId: 'agent-3', answeredCount: 2, lastBridgedAt: new Date('2026-02-01') },
		];

		const result = resolveDialSet({
			strategy: QueueStrategy.LeastRecent,
			eligibleMembers: members,
			aggregates,
			cursorMemberId: null,
			attemptOrder: [],
		});

		expect(result.membersToRing.map((m) => m.id)).toEqual(['member-2']);
	});

	it('fewest_calls picks the member with the lowest answered count', () => {
		const aggregates: QueueMemberAggregate[] = [
			{ agentId: 'agent-1', answeredCount: 5, lastBridgedAt: null },
			{ agentId: 'agent-2', answeredCount: 1, lastBridgedAt: null },
			{ agentId: 'agent-3', answeredCount: 2, lastBridgedAt: null },
		];

		const result = resolveDialSet({
			strategy: QueueStrategy.FewestCalls,
			eligibleMembers: members,
			aggregates,
			cursorMemberId: null,
			attemptOrder: [],
		});

		expect(result.membersToRing.map((m) => m.id)).toEqual(['member-2']);
	});

	it('random picks exactly one eligible member', () => {
		const result = resolveDialSet({
			strategy: QueueStrategy.Random,
			eligibleMembers: members,
			aggregates: [],
			cursorMemberId: null,
			attemptOrder: [],
		});

		expect(result.membersToRing).toHaveLength(1);
		expect(members.map((m) => m.id)).toContain(result.membersToRing[0].id);
	});

	it('returns no one to ring when there are no eligible members', () => {
		const result = resolveDialSet({
			strategy: QueueStrategy.RingAll,
			eligibleMembers: [],
			aggregates: [],
			cursorMemberId: null,
			attemptOrder: [],
		});

		expect(result.membersToRing).toEqual([]);
	});
});
