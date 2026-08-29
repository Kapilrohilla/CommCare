import { Injectable, Logger } from '@nestjs/common';
import { AsteriskCdrWebhookPayload } from '../dto/asterisk-cdr.dto';
import { EventProducer } from 'src/infra/queue/services/event-producer.service';
import { Events } from 'src/constants/event.constant';
import { buildProcessedCall } from '../utils/asterisk-cdr.mapper';
import { CallsService } from 'src/modules/calls/services/calls.service';

@Injectable()
export class AsteriskCDRService {
	private readonly logger = new Logger(AsteriskCDRService.name);

	constructor(
		private readonly callServices: CallsService,
		private readonly eventProducer: EventProducer,
	) {}

	/** HTTP webhook entry — publish to Kafka for async processing. */
	async handleCdr(body: AsteriskCdrWebhookPayload) {
		const linkedId =
			typeof body.call?.linkedId === 'string' ? body.call.linkedId : 'unknown';

		this.logger.log(
			`CDR webhook received for ${linkedId}: ${body.cdrs.length} CDR events, ${body.events.length} AMI events`,
		);

		await this.eventProducer.publish(Events.cdrEvent, body);
		return { message: 'CDR event published' };
	}

	/** BullMQ worker handler — process accumulated AMI events for a completed call. */
	async handleEventCdrEvent(
		eventName: string,
		payload: unknown,
		retryCount: number,
	): Promise<void> {
		// TODO: Do acquire lock here before processing the call
		const body = payload as AsteriskCdrWebhookPayload;
		const linkedId =
			typeof body.call?.linkedId === 'string' ? body.call.linkedId : 'unknown';

		this.logger.log(
			`Handling ${eventName} for ${linkedId} (retry ${retryCount}): ${body.cdrs.length} CDR events, ${body.events.length} AMI events`,
		);

		// const processedCall = buildProcessedCall(body);
		// if (!processedCall) {
		// 	this.logger.warn(
		// 		`Skipping ${eventName} for ${linkedId}: missing linkedId or CDR data`,
		// 	);
		// 	return;
		// }

		// await this.callServices.processCdr(processedCall);

	}
}
