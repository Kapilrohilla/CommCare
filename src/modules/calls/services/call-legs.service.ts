import { Injectable } from '@nestjs/common';
import { CallLegEntity } from '../entity/call-legs.entity';
import { CallLegsRepository } from '../repositories/call-legs.repository';
import { ProcessedCallLeg } from '../types/processed-call.types';
import { CallLegStatus } from '../constants/call.constant';
import { UpsertAriCallLegInput } from '../types/click2call-leg.types';

@Injectable()
export class CallLegsService {
	constructor(private readonly callLegsRepository: CallLegsRepository) {}

	async getLegsByCallId(callId: string): Promise<CallLegEntity[]> {
		return this.callLegsRepository.findByCallId(callId);
	}

	async getLegByUniqueId(uniqueId: string): Promise<CallLegEntity | null> {
		return this.callLegsRepository.findByUniqueId(uniqueId);
	}

	async upsertFromAriChannel(input: UpsertAriCallLegInput): Promise<CallLegEntity> {
		const existingLeg = await this.callLegsRepository.findByUniqueId(input.channelId);
		const leg = existingLeg ?? new CallLegEntity();

		leg.callId = input.callId;
		leg.uniqueId = input.channelId;
		leg.linkedId = input.linkedId ?? input.channelId;
		if (input.channelName !== undefined) {
			leg.channel = input.channelName ?? input.channelId;
		} else if (!existingLeg) {
			leg.channel = input.channelId;
		}

		if (input.callerNumber !== undefined) {
			leg.callerNumber = input.callerNumber;
		}
		if (input.callerName !== undefined) {
			leg.callerName = input.callerName;
		}
		if (input.destinationNumber !== undefined) {
			leg.destinationNumber = input.destinationNumber;
		}
		if (input.status !== undefined) {
			leg.status = input.status;
		}
		if (input.startedAt !== undefined) {
			leg.startedAt = input.startedAt;
		}
		if (input.answeredAt !== undefined) {
			leg.answeredAt = input.answeredAt;
		}
		if (input.endedAt !== undefined) {
			leg.endedAt = input.endedAt;
			if (leg.startedAt && input.endedAt) {
				leg.duration = Math.max(
					0,
					Math.floor((input.endedAt.getTime() - leg.startedAt.getTime()) / 1000),
				);
			}
		}
		if (input.bridgeUniqueId !== undefined) {
			leg.bridgeUniqueId = input.bridgeUniqueId;
		}

		leg.raw = {
			...(leg.raw ?? {}),
			...(input.raw ?? {}),
			legRole: input.legRole,
		};

		return this.callLegsRepository.save(leg);
	}

	async finalizeLegEnd(
		channelId: string,
		status: CallLegStatus,
		endedAt: Date,
		hangupCause: number | null = null,
		hangupCauseText: string | null = null,
	): Promise<CallLegEntity | null> {
		const leg = await this.callLegsRepository.findByUniqueId(channelId);
		if (!leg) {
			return null;
		}

		leg.status = status;
		leg.endedAt = endedAt;
		leg.hangupCause = hangupCause;
		leg.hangupCauseText = hangupCauseText;

		if (leg.startedAt) {
			leg.duration = Math.max(
				0,
				Math.floor((endedAt.getTime() - leg.startedAt.getTime()) / 1000),
			);
		}

		return this.callLegsRepository.save(leg);
	}

	async updateLegStatus(
		channelId: string,
		status: CallLegStatus,
		timestamps: { answeredAt?: Date; endedAt?: Date } = {},
	): Promise<CallLegEntity | null> {
		const leg = await this.callLegsRepository.findByUniqueId(channelId);
		if (!leg) {
			return null;
		}

		leg.status = status;
		if (timestamps.answeredAt) {
			leg.answeredAt = timestamps.answeredAt;
		}
		if (timestamps.endedAt) {
			leg.endedAt = timestamps.endedAt;
			if (leg.startedAt) {
				leg.duration = Math.max(
					0,
					Math.floor((timestamps.endedAt.getTime() - leg.startedAt.getTime()) / 1000),
				);
			}
		}

		return this.callLegsRepository.save(leg);
	}

	async upsertFromProcessed(
		callId: string,
		legData: ProcessedCallLeg,
	): Promise<CallLegEntity> {
		const existingLeg = await this.callLegsRepository.findByUniqueId(
			legData.uniqueId,
		);

		const leg = existingLeg ?? new CallLegEntity();
		leg.callId = callId;
		leg.uniqueId = legData.uniqueId;
		leg.linkedId = legData.linkedId;
		leg.channel = legData.channel;
		leg.destinationChannel = legData.destinationChannel;
		leg.callerNumber = legData.callerNumber;
		leg.callerName = legData.callerName;
		leg.destinationNumber = legData.destinationNumber;
		leg.destinationName = legData.destinationName;
		leg.status = legData.status;
		leg.startedAt = legData.startedAt;
		leg.answeredAt = legData.answeredAt;
		leg.endedAt = legData.endedAt;
		leg.duration = legData.duration;
		leg.billableSeconds = legData.billableSeconds;
		leg.hangupCause = legData.hangupCause;
		leg.hangupCauseText = legData.hangupCauseText;
		leg.dialStatus = legData.dialStatus;
		leg.bridgeUniqueId = legData.bridgeUniqueId;
		leg.raw = legData.raw;

		return this.callLegsRepository.save(leg);
	}

	async upsertManyFromProcessed(
		callId: string,
		legs: ProcessedCallLeg[],
	): Promise<Map<string, string>> {
		const legIdByUniqueId = new Map<string, string>();

		for (const legData of legs) {
			const savedLeg = await this.upsertFromProcessed(callId, legData);
			legIdByUniqueId.set(savedLeg.uniqueId, savedLeg.id);
		}

		return legIdByUniqueId;
	}
}
