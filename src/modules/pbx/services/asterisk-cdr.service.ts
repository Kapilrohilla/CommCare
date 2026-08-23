import { Injectable, Logger } from '@nestjs/common';
import { CallsService } from 'src/modules/calls/services/calls.service';
import { AsteriskCdrEvent, AsteriskCdrWebhookPayload } from '../dto/asterisk-cdr.dto';
import { EventProducer } from 'src/infra/queue/services/event-producer.service';
import { Events } from 'src/constants/event.constant';

type AmiEvent = Record<string, string>;

@Injectable()
export class AsteriskCDRService {
	private readonly logger = new Logger(AsteriskCDRService.name);

	constructor(
		private readonly callService: CallsService,
		private readonly eventProducer: EventProducer,
	) {}

	/** HTTP webhook entry — publish to Kafka for async processing. */
	async handleCdr(body: AsteriskCdrWebhookPayload) {
		this.logger.log(`CDR webhook received: ${body.raw?.length ?? 0} AMI events`);
		await this.eventProducer.publish(Events.cdrEvent, body);
		return { message: 'CDR event published' };
	}

	private extractCdrEvent(raw: AmiEvent[] | AmiEvent | undefined): AmiEvent | null {
		if (!raw) {
			return null;
		}
		if (Array.isArray(raw)) {
			return raw.find((entry) => entry.Event === 'Cdr') ?? raw.at(-1) ?? null;
		}
		return raw;
	}

	private normalize(event: AmiEvent) {
		return {
			uniqueId: event.Uniqueid || event.UniqueID,
			linkedId: event.Linkedid || event.LinkedID,
			source: event.Source,
			destination: event.Destination,
			callerId: event.CallerID,
			channel: event.Channel,
			destinationChannel: event.DestinationChannel,
			startTime: event.StartTime,
			answerTime: event.AnswerTime || null,
			endTime: event.EndTime,
			duration: Number(event.Duration || 0),
			billableSeconds: Number(event.BillableSeconds || 0),
			disposition: event.Disposition,
			amaFlags: event.AMAFlags,
			userField: event.UserField || null,
		};
	}

	/** BullMQ worker handler — process accumulated AMI events for a completed call. */
	async handleEventCdrEvent(eventName: string, payload: unknown, retryCount: number): Promise<void> {
		const envelope = payload as AsteriskCdrWebhookPayload;
		this.logger.log(`Handling ${eventName} (retry ${retryCount}), ${envelope.raw?.length ?? 0} AMI events`);

		const cdrEvent = this.extractCdrEvent(envelope.raw);
		if (!cdrEvent) {
			this.logger.warn(`No CDR event found in payload for ${eventName}`);
			return;
		}

		const cdr = this.normalize(cdrEvent);
		await this.callService.processCdr(cdr, envelope);
	}
}
