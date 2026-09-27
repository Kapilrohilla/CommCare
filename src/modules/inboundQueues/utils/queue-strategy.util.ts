import { QueueStrategy } from '../constants/queue.constant';
import { QueueMember } from '../entity/queue-member.entity';
import { QueueMemberAggregate } from '../repositories/queue-call.repository';

export interface ResolveDialSetInput {
	strategy: QueueStrategy;
	eligibleMembers: QueueMember[];
	aggregates: QueueMemberAggregate[];
	cursorMemberId: string | null;
	attemptOrder: string[];
}

export interface ResolveDialSetResult {
	membersToRing: QueueMember[];
	/** Set only for round_robin, to persist on the Queue for the next attempt/call. */
	nextCursorMemberId?: string;
}

function excludeAlreadyTried(
	members: QueueMember[],
	attemptOrder: string[],
): QueueMember[] {
	const remaining = members.filter((member) => !attemptOrder.includes(member.id));
	// Every eligible member has been tried this session — start a fresh cycle.
	return remaining.length > 0 ? remaining : members;
}

function aggregateFor(
	agentId: string,
	aggregates: QueueMemberAggregate[],
): QueueMemberAggregate {
	return (
		aggregates.find((aggregate) => aggregate.agentId === agentId) ?? {
			agentId,
			answeredCount: 0,
			lastBridgedAt: null,
		}
	);
}

function pickRoundRobin(
	members: QueueMember[],
	cursorMemberId: string | null,
): ResolveDialSetResult {
	if (members.length === 0) {
		return { membersToRing: [] };
	}

	const cursorIndex = cursorMemberId
		? members.findIndex((member) => member.id === cursorMemberId)
		: -1;
	const nextIndex = (cursorIndex + 1) % members.length;
	const chosen = members[nextIndex];

	return { membersToRing: [chosen], nextCursorMemberId: chosen.id };
}

function pickBySortedAggregate(
	members: QueueMember[],
	aggregates: QueueMemberAggregate[],
	compare: (a: QueueMemberAggregate, b: QueueMemberAggregate) => number,
): ResolveDialSetResult {
	const sorted = [...members].sort((a, b) =>
		compare(aggregateFor(a.agentId, aggregates), aggregateFor(b.agentId, aggregates)),
	);

	return { membersToRing: sorted.slice(0, 1) };
}

function pickRandom(members: QueueMember[]): ResolveDialSetResult {
	const index = Math.floor(Math.random() * members.length);
	return { membersToRing: [members[index]] };
}

/** Pure strategy resolver: given eligible members for a queue, decide who to ring next. */
export function resolveDialSet(input: ResolveDialSetInput): ResolveDialSetResult {
	const { strategy, eligibleMembers, aggregates, cursorMemberId, attemptOrder } = input;

	if (eligibleMembers.length === 0) {
		return { membersToRing: [] };
	}

	if (strategy === QueueStrategy.RingAll) {
		return { membersToRing: excludeAlreadyTried(eligibleMembers, attemptOrder) };
	}

	const candidates = excludeAlreadyTried(eligibleMembers, attemptOrder);

	switch (strategy) {
		case QueueStrategy.RoundRobin:
			return pickRoundRobin(candidates, cursorMemberId);
		case QueueStrategy.LeastRecent:
			return pickBySortedAggregate(candidates, aggregates, (a, b) => {
				const aTime = a.lastBridgedAt?.getTime() ?? 0;
				const bTime = b.lastBridgedAt?.getTime() ?? 0;
				return aTime - bTime;
			});
		case QueueStrategy.FewestCalls:
			return pickBySortedAggregate(
				candidates,
				aggregates,
				(a, b) => a.answeredCount - b.answeredCount,
			);
		case QueueStrategy.Random:
			return pickRandom(candidates);
		default:
			return { membersToRing: candidates };
	}
}
