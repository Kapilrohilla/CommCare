import { Injectable, Logger } from '@nestjs/common';
import { CallsRepository } from '../repositories/calls.repository';
import { CallEntity } from '../entity/calls.entity';
import { ProcessedCallData } from '../types/processed-call.types';
import { CallEventsService } from './call-events.service';
import { CallLegsService } from './call-legs.service';

@Injectable()
export class CallsService {
	private readonly logger = new Logger(CallsService.name);
	constructor(private readonly callsRepository: CallsRepository, private readonly callLegsService: CallLegsService, private readonly callEventsService: CallEventsService) {}

	async getCalls(): Promise<CallEntity[]> {
		return this.callsRepository.getCalls();
	}

	async getCallById(id: string): Promise<CallEntity> {
		return this.callsRepository.getCallById(id);
	}

	async getCallByLinkedId(linkedId: string): Promise<CallEntity | null> {
		return this.callsRepository.findByLinkedId(linkedId);
	}

	async createCall(call: CallEntity): Promise<CallEntity> {
		return this.callsRepository.createCall(call);
	}

	async updateCall(call: CallEntity): Promise<CallEntity> {
		return this.callsRepository.updateCall(call);
	}

	async deleteCall(id: string): Promise<void> {
		return this.callsRepository.deleteCall(id);
	}

	async processCdr(processedCall: ProcessedCallData): Promise<CallEntity> {
		const savedCall = await this.upsertFromProcessed(processedCall);
		const legIdByUniqueId = await this.callLegsService.upsertManyFromProcessed(
			savedCall.id,
			processedCall.legs,
		);
		const callEvents = await this.callEventsService.replaceForCall(
			savedCall.id,
			processedCall.events,
			legIdByUniqueId,
		);

		this.logger.log(
			`Processed call ${savedCall.linkedId}: ${processedCall.legs.length} legs, ${callEvents.length} events`,
		);

		return savedCall;
	}

	async upsertFromProcessed(processedCall: ProcessedCallData): Promise<CallEntity> {
		const existingCall = await this.callsRepository.findByLinkedId(
			processedCall.linkedId,
		);

		const call = existingCall ?? new CallEntity();
		call.linkedId = processedCall.linkedId;
		call.direction = processedCall.direction;
		call.from = processedCall.from;
		call.fromName = processedCall.fromName;
		call.to = processedCall.to;
		call.toName = processedCall.toName;
		call.status = processedCall.status;
		call.startedAt = processedCall.startedAt;
		call.answeredAt = processedCall.answeredAt;
		call.endedAt = processedCall.endedAt;
		call.duration = processedCall.duration;
		call.billableSeconds = processedCall.billableSeconds;
		call.source = processedCall.source;
		call.destination = processedCall.destination;
		call.context = processedCall.context;

		return existingCall
			? this.callsRepository.updateCall(call)
			: this.callsRepository.createCall(call);
	}
}
