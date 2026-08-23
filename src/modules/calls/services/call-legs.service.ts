import { Injectable } from '@nestjs/common';
import { CallLegEntity } from '../entity/call-legs.entity';
import { CallLegsRepository } from '../repositories/call-legs.repository';
import { ProcessedCallLeg } from '../types/processed-call.types';

@Injectable()
export class CallLegsService {
	constructor(private readonly callLegsRepository: CallLegsRepository) {}

	async getLegsByCallId(callId: string): Promise<CallLegEntity[]> {
		return this.callLegsRepository.findByCallId(callId);
	}

	async getLegByUniqueId(uniqueId: string): Promise<CallLegEntity | null> {
		return this.callLegsRepository.findByUniqueId(uniqueId);
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
