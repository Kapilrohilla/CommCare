import { Injectable } from '@nestjs/common';
import { CallEventEntity } from '../entity/call-events.entity';
import { CallEventsRepository } from '../repositories/call-events.repository';
import { ProcessedCallEvent } from '../types/processed-call.types';
import { AppendAriCallEventInput } from '../types/click2call-leg.types';

@Injectable()
export class CallEventsService {
	constructor(private readonly callEventsRepository: CallEventsRepository) {}

	async getEventsByCallId(callId: string): Promise<CallEventEntity[]> {
		return this.callEventsRepository.findByCallId(callId);
	}

	async appendAriEvent(input: AppendAriCallEventInput): Promise<CallEventEntity> {
		const event = new CallEventEntity();
		event.callId = input.callId;
		event.callLegId = input.callLegId ?? null;
		event.linkedId = input.linkedId ?? null;
		event.uniqueId = input.channelId ?? null;
		event.eventType = input.eventType;
		event.eventTime = input.eventTime;
		event.channel = input.channelName ?? input.channelId ?? null;
		event.bridgeUniqueId = input.bridgeUniqueId ?? null;
		event.payload = input.payload;

		return this.callEventsRepository.save(event);
	}

	buildFromProcessed(
		callId: string,
		eventData: ProcessedCallEvent,
		legIdByUniqueId: Map<string, string>,
	): CallEventEntity {
		const event = new CallEventEntity();
		event.callId = callId;
		event.callLegId = eventData.uniqueId
			? legIdByUniqueId.get(eventData.uniqueId) ?? null
			: null;
		event.linkedId = eventData.linkedId;
		event.uniqueId = eventData.uniqueId;
		event.eventType = eventData.eventType;
		event.eventTime = eventData.eventTime;
		event.channel = eventData.channel;
		event.bridgeUniqueId = eventData.bridgeUniqueId;
		event.payload = eventData.payload;
		return event;
	}

	async replaceForCall(
		callId: string,
		events: ProcessedCallEvent[],
		legIdByUniqueId: Map<string, string>,
	): Promise<CallEventEntity[]> {
		await this.callEventsRepository.deleteByCallId(callId);

		const callEvents = events.map((eventData) =>
			this.buildFromProcessed(callId, eventData, legIdByUniqueId),
		);

		return this.callEventsRepository.saveMany(callEvents);
	}
}
