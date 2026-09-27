import { Injectable, Logger } from '@nestjs/common';
import { STASIS_WORKFLOW, buildQueueAppArgs } from 'src/constants/stasis-app-args.constant';
import { AsteriskService } from 'src/modules/pbx/services/asterisk.service';
import { ExtensionService } from 'src/modules/pbx/services/extension.service';
import { ExtensionStatus } from 'src/modules/pbx/constants/extension.constant';
import { Extension } from 'src/modules/pbx/entity/extension.entity';
import { RawAriEventBody } from 'src/modules/pbx/types/ari-event.types';
import {
	QueueCallEventType,
	QueueCallStatus,
} from 'src/modules/inboundQueues/constants/queue.constant';
import { QueueCallEventEntity } from 'src/modules/inboundQueues/entity/queue-call-event.entity';
import { QueueCallEntity } from 'src/modules/inboundQueues/entity/queue-call.entity';
import { QueueMember } from 'src/modules/inboundQueues/entity/queue-member.entity';
import { Queue } from 'src/modules/inboundQueues/entity/queue.entity';
import { QueueCallEventRepository } from 'src/modules/inboundQueues/repositories/queue-call-event.repository';
import { QueueCallRepository } from 'src/modules/inboundQueues/repositories/queue-call.repository';
import { AsteriskQueueAdapter } from 'src/modules/inboundQueues/services/asterisk-queue-adapter.service';
import { QueueMembersService } from 'src/modules/inboundQueues/services/queue-members.service';
import { QueuesService } from 'src/modules/inboundQueues/services/queues.service';
import { resolveDialSet } from 'src/modules/inboundQueues/utils/queue-strategy.util';
import {
	ASTERISK_HANGUP_CAUSE,
} from '../utils/ari-hangup.util';

interface EligibleMember {
	member: QueueMember;
	extension: Extension;
}

interface RingingAgentLeg {
	queueCallId: string;
	memberId: string;
	agentId: string;
}

@Injectable()
export class QueueCallWorkflowService {
	readonly workflow = STASIS_WORKFLOW.QUEUE;
	private readonly logger = new Logger(QueueCallWorkflowService.name);

	/** callerChannelId -> queueCallId */
	private readonly queueCallByCallerChannel = new Map<string, string>();
	/** agent-leg channelId -> { queueCallId, memberId, agentId } */
	private readonly ringingAgentLegs = new Map<string, RingingAgentLeg>();

	constructor(
		private readonly queuesService: QueuesService,
		private readonly queueMembersService: QueueMembersService,
		private readonly asteriskQueueAdapter: AsteriskQueueAdapter,
		private readonly queueCallRepository: QueueCallRepository,
		private readonly queueCallEventRepository: QueueCallEventRepository,
		private readonly asteriskService: AsteriskService,
		private readonly extensionService: ExtensionService,
	) {}

	canHandle(event: RawAriEventBody): boolean {
		return event.args?.[0] === this.workflow;
	}

	async handleEvent(
		_eventName: string,
		event: RawAriEventBody,
		_retryCount: number,
	): Promise<void> {
		const eventType = event.type;
		if (!eventType) {
			return;
		}

		switch (eventType) {
			case 'StasisStart':
				await this.handleStasisStart(event);
				break;
			case 'ChannelStateChange':
				await this.handleChannelStateChange(event);
				break;
			case 'ChannelDestroyed':
				await this.handleChannelDestroyed(event);
				break;
			default:
				break;
		}
	}

	private parseQueueArgs(args: string[] | undefined): {
		tenantId: string;
		queueId: string;
		leg: 'caller' | 'agent';
	} | null {
		if (!args?.length || args[0] !== STASIS_WORKFLOW.QUEUE) {
			return null;
		}

		// [queue, tenantId, queueCallId, queueId, leg, memberId]
		const [, tenantId, , queueId, leg] = args;
		if (!tenantId || !queueId) {
			return null;
		}

		return { tenantId, queueId, leg: leg === 'agent' ? 'agent' : 'caller' };
	}

	private async handleStasisStart(event: RawAriEventBody): Promise<void> {
		const channelId = event.channel?.id;
		const parsed = this.parseQueueArgs(event.args);

		if (!channelId || !parsed) {
			return;
		}

		if (parsed.leg === 'agent') {
			// Originated agent leg entering Stasis; nothing to do until it answers
			// (ChannelStateChange) or the ARI origination timeout destroys it.
			return;
		}

		await this.handleCallerEnteredQueue(
			channelId,
			parsed.tenantId,
			parsed.queueId,
			event.channel?.caller?.number ?? null,
		);
	}

	private async handleCallerEnteredQueue(
		channelId: string,
		tenantId: string,
		queueId: string,
		callerNumber: string | null,
	): Promise<void> {
		const queue = await this.queuesService
			.getEnabledQueueForTenant(tenantId, queueId)
			.catch(() => null);
		if (!queue) {
			this.logger.warn(`Queue ${queueId} not found or disabled for tenant ${tenantId}`);
			await this.asteriskService.hangupChannel(channelId);
			return;
		}

		const now = new Date();
		const queueCall = new QueueCallEntity();
		queueCall.tenantId = tenantId;
		queueCall.queueId = queue.id;
		queueCall.callerChannelId = channelId;
		queueCall.callerNumber = callerNumber;
		queueCall.enteredAt = now;
		queueCall.status = QueueCallStatus.Waiting;

		const activeCount = await this.queueCallRepository.countActiveByQueueId(queue.id);
		if (queue.maxCallers && activeCount >= queue.maxCallers) {
			queueCall.status = QueueCallStatus.Full;
			queueCall.endedAt = now;
			const saved = await this.queueCallRepository.create(queueCall);
			await this.logEvent(saved, QueueCallEventType.QueueFull, { channelId });
			await this.asteriskService.hangupChannel(channelId);
			return;
		}

		const eligible = await this.resolveEligibleMembers(queue);
		if (eligible.length === 0) {
			queueCall.status = QueueCallStatus.TimedOut;
			queueCall.endedAt = now;
			const saved = await this.queueCallRepository.create(queueCall);
			await this.logEvent(saved, QueueCallEventType.QueueTimeout, {
				channelId,
				reason: 'no_eligible_members',
			});
			await this.asteriskService.hangupChannel(channelId);
			return;
		}

		const saved = await this.queueCallRepository.create(queueCall);
		this.queueCallByCallerChannel.set(channelId, saved.id);

		await this.logEvent(saved, QueueCallEventType.EnteredQueue, { channelId });
		await this.logPositionChanged(saved);
		await this.asteriskService.answerChannel(channelId);
		await this.startRingAttempt(queue, saved);
	}

	private async resolveEligibleMembers(queue: Queue): Promise<EligibleMember[]> {
		const members = await this.queueMembersService.getEnabledMembersForQueue(queue.id);
		const eligible: EligibleMember[] = [];

		for (const member of members) {
			const busy = await this.queueCallRepository.findActiveBridgedByAgentId(member.agentId);
			if (busy) {
				continue;
			}

			const extensions = await this.extensionService.getExtensionsByUserId(member.agentId);
			const extension = extensions.find(
				(ext) => ext.tenantId === queue.tenantId && ext.status === ExtensionStatus.ASSIGNED,
			);
			if (!extension) {
				continue;
			}

			eligible.push({ member, extension });
		}

		return eligible;
	}

	private async startRingAttempt(queue: Queue, queueCall: QueueCallEntity): Promise<void> {
		const elapsedMs = Date.now() - queueCall.enteredAt.getTime();
		if (elapsedMs >= queue.maxWaitTimeSeconds * 1000) {
			await this.timeoutQueueCall(queueCall);
			return;
		}

		const eligible = await this.resolveEligibleMembers(queue);
		if (eligible.length === 0) {
			await this.timeoutQueueCall(queueCall, 'no_eligible_members');
			return;
		}

		if (eligible.every((entry) => queueCall.attemptOrder.includes(entry.member.id))) {
			queueCall.attemptOrder = [];
		}

		const aggregates = await this.queueCallRepository.getAggregatesByQueueId(queue.id);
		const { membersToRing, nextCursorMemberId } = resolveDialSet({
			strategy: queue.strategy,
			eligibleMembers: eligible.map((entry) => entry.member),
			aggregates,
			cursorMemberId: queue.roundRobinCursorMemberId,
			attemptOrder: queueCall.attemptOrder,
		});

		if (membersToRing.length === 0) {
			await this.timeoutQueueCall(queueCall, 'no_eligible_members');
			return;
		}

		if (nextCursorMemberId) {
			queue.roundRobinCursorMemberId = nextCursorMemberId;
			await this.queuesService.saveQueue(queue);
		}

		const ringingChannelIds: string[] = [];
		for (const member of membersToRing) {
			const entry = eligible.find((candidate) => candidate.member.id === member.id);
			if (!entry) {
				continue;
			}

			try {
				const channel = await this.asteriskQueueAdapter.ringMember(
					entry.extension.pjsipEndpoint,
					buildQueueAppArgs({
						tenantId: queueCall.tenantId,
						queueId: queue.id,
						queueCallId: queueCall.id,
						leg: 'agent',
						memberId: member.id,
					}),
					queueCall.callerNumber,
					queue.ringTimeoutSeconds,
				);

				ringingChannelIds.push(channel.id);
				this.ringingAgentLegs.set(channel.id, {
					queueCallId: queueCall.id,
					memberId: member.id,
					agentId: member.agentId,
				});
				await this.logEvent(queueCall, QueueCallEventType.AgentOffered, {
					memberId: member.id,
					agentId: member.agentId,
					channelId: channel.id,
				});
			} catch (error) {
				this.logger.warn(
					`Failed to ring member ${member.id} for queue call ${queueCall.id}: ${error instanceof Error ? error.message : error}`,
				);
			}
		}

		queueCall.ringingChannelIds = ringingChannelIds;
		queueCall.attemptOrder = [
			...queueCall.attemptOrder,
			...membersToRing.map((member) => member.id),
		];
		queueCall.status = QueueCallStatus.Ringing;
		await this.queueCallRepository.save(queueCall);

		if (ringingChannelIds.length === 0) {
			await this.startRingAttempt(queue, queueCall);
		}
	}

	private async handleChannelStateChange(event: RawAriEventBody): Promise<void> {
		const channelId = event.channel?.id;
		if (!channelId || event.channel?.state !== 'Up') {
			return;
		}

		const agentLeg = this.ringingAgentLegs.get(channelId);
		if (!agentLeg) {
			return;
		}

		const queueCall = await this.queueCallRepository.getById(agentLeg.queueCallId);
		if (!queueCall || queueCall.status !== QueueCallStatus.Ringing) {
			return;
		}
		if (!queueCall.ringingChannelIds.includes(channelId)) {
			return;
		}

		const otherRingingChannelIds = queueCall.ringingChannelIds.filter(
			(id) => id !== channelId,
		);
		for (const loserChannelId of otherRingingChannelIds) {
			this.ringingAgentLegs.delete(loserChannelId);
			await this.asteriskQueueAdapter.cancelRing(loserChannelId);
		}
		this.ringingAgentLegs.delete(channelId);

		const bridge = await this.asteriskQueueAdapter.bridgeCallerAndAgent(
			queueCall.callerChannelId,
			channelId,
		);

		const now = new Date();
		queueCall.status = QueueCallStatus.Bridged;
		queueCall.bridgeId = bridge.id;
		queueCall.bridgedAt = now;
		queueCall.ringingChannelIds = [];
		queueCall.answeredMemberId = agentLeg.memberId;
		queueCall.answeredAgentId = agentLeg.agentId;
		queueCall.waitSeconds = Math.max(
			0,
			Math.floor((now.getTime() - queueCall.enteredAt.getTime()) / 1000),
		);
		await this.queueCallRepository.save(queueCall);

		await this.logEvent(queueCall, QueueCallEventType.AgentAnswered, {
			memberId: agentLeg.memberId,
			agentId: agentLeg.agentId,
			channelId,
		});
		await this.logEvent(queueCall, QueueCallEventType.CallBridged, {
			bridgeId: bridge.id,
			channelId,
		});
	}

	private async handleChannelDestroyed(event: RawAriEventBody): Promise<void> {
		const channelId = event.channel?.id;
		if (!channelId) {
			return;
		}

		const callerQueueCallId = this.queueCallByCallerChannel.get(channelId);
		if (callerQueueCallId) {
			this.queueCallByCallerChannel.delete(channelId);
			await this.handleCallerChannelDestroyed(callerQueueCallId, channelId, event);
			return;
		}

		const agentLeg = this.ringingAgentLegs.get(channelId);
		if (agentLeg) {
			this.ringingAgentLegs.delete(channelId);
			await this.handleAgentChannelDestroyed(channelId, agentLeg, event);
		}
	}

	private async handleCallerChannelDestroyed(
		queueCallId: string,
		channelId: string,
		_event: RawAriEventBody,
	): Promise<void> {
		const queueCall = await this.queueCallRepository.getById(queueCallId);
		if (!queueCall || queueCall.endedAt) {
			return;
		}

		const now = new Date();

		if (queueCall.status === QueueCallStatus.Bridged) {
			queueCall.status = QueueCallStatus.Completed;
			queueCall.endedAt = now;
			if (queueCall.bridgedAt) {
				queueCall.talkSeconds = Math.max(
					0,
					Math.floor((now.getTime() - queueCall.bridgedAt.getTime()) / 1000),
				);
			}
			await this.queueCallRepository.save(queueCall);
			await this.logEvent(queueCall, QueueCallEventType.CallCompleted, { channelId });
			return;
		}

		for (const ringingChannelId of queueCall.ringingChannelIds) {
			this.ringingAgentLegs.delete(ringingChannelId);
			await this.asteriskQueueAdapter.cancelRing(ringingChannelId);
		}

		queueCall.status = QueueCallStatus.Abandoned;
		queueCall.ringingChannelIds = [];
		queueCall.endedAt = now;
		queueCall.waitSeconds = Math.max(
			0,
			Math.floor((now.getTime() - queueCall.enteredAt.getTime()) / 1000),
		);
		await this.queueCallRepository.save(queueCall);
		await this.logEvent(queueCall, QueueCallEventType.CallerAbandoned, { channelId });
	}

	private async handleAgentChannelDestroyed(
		channelId: string,
		agentLeg: RingingAgentLeg,
		event: RawAriEventBody,
	): Promise<void> {
		const queueCall = await this.queueCallRepository.getById(agentLeg.queueCallId);
		if (!queueCall || queueCall.status !== QueueCallStatus.Ringing) {
			return;
		}
		if (!queueCall.ringingChannelIds.includes(channelId)) {
			return;
		}

		const cause = typeof event.cause === 'number' ? event.cause : null;
		const isReject =
			cause === ASTERISK_HANGUP_CAUSE.USER_BUSY ||
			cause === ASTERISK_HANGUP_CAUSE.CALL_REJECTED;
		const eventType = isReject
			? QueueCallEventType.AgentRejected
			: QueueCallEventType.AgentUnavailable;

		queueCall.ringingChannelIds = queueCall.ringingChannelIds.filter(
			(id) => id !== channelId,
		);
		await this.queueCallRepository.save(queueCall);
		await this.logEvent(queueCall, eventType, {
			memberId: agentLeg.memberId,
			agentId: agentLeg.agentId,
			channelId,
			cause,
		});

		if (queueCall.ringingChannelIds.length > 0) {
			return;
		}

		const queue = await this.queuesService
			.getEnabledQueueForTenant(queueCall.tenantId, queueCall.queueId)
			.catch(() => null);
		if (!queue) {
			this.queueCallByCallerChannel.delete(queueCall.callerChannelId);
			await this.asteriskService.hangupChannel(queueCall.callerChannelId);
			return;
		}

		await this.startRingAttempt(queue, queueCall);
	}

	private async timeoutQueueCall(
		queueCall: QueueCallEntity,
		reason: string = 'max_wait_time_exceeded',
	): Promise<void> {
		this.queueCallByCallerChannel.delete(queueCall.callerChannelId);

		queueCall.status = QueueCallStatus.TimedOut;
		queueCall.endedAt = new Date();
		queueCall.waitSeconds = Math.max(
			0,
			Math.floor((queueCall.endedAt.getTime() - queueCall.enteredAt.getTime()) / 1000),
		);
		await this.queueCallRepository.save(queueCall);
		await this.logEvent(queueCall, QueueCallEventType.QueueTimeout, { reason });
		await this.asteriskService.hangupChannel(queueCall.callerChannelId);
	}

	private async logPositionChanged(queueCall: QueueCallEntity): Promise<void> {
		const active = await this.queueCallRepository.getActiveByQueueId(queueCall.queueId);
		const position =
			active.filter(
				(candidate) =>
					candidate.id !== queueCall.id &&
					candidate.enteredAt.getTime() < queueCall.enteredAt.getTime(),
			).length + 1;

		await this.logEvent(queueCall, QueueCallEventType.PositionChanged, { position });
	}

	private async logEvent(
		queueCall: QueueCallEntity,
		eventType: QueueCallEventType,
		payload: Record<string, unknown> = {},
	): Promise<void> {
		const event = new QueueCallEventEntity();
		event.tenantId = queueCall.tenantId;
		event.queueId = queueCall.queueId;
		event.queueCallId = queueCall.id;
		event.eventType = eventType;
		event.memberId = typeof payload.memberId === 'string' ? payload.memberId : null;
		event.agentId = typeof payload.agentId === 'string' ? payload.agentId : null;
		event.channelId = typeof payload.channelId === 'string' ? payload.channelId : null;
		event.payload = payload;
		event.eventTime = new Date();

		await this.queueCallEventRepository.save(event);
	}
}
