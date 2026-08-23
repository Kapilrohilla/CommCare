import { ConsoleLogger, Injectable} from "@nestjs/common";
import { CallsService } from "src/modules/calls/services/calls.service";
import { AsteriskCdrEvent } from "../dto/asterisk-cdr.dto";
import { EventProducer } from "src/infra/queue/services/event-producer.service";
import { Events } from "src/constants/event.constant";

@Injectable()
export class AsteriskCDRService {

	constructor(private readonly callService: CallsService, private readonly logger: ConsoleLogger, private readonly eventProducer: EventProducer) {}


	async handleCdr(event: AsteriskCdrEvent) {

		this.logger.log(`Handling CDR event: ${JSON.stringify(event)}`);
		await this.eventProducer.publish(Events.cdrEvent, event);

		return {
			message: 'CDR event published',
		}
	  }


	private normalize(event: any) {
		return {
		  uniqueId: event.UniqueID,
		  linkedId: event.LinkedID,
		  source: event.Source,
		  destination: event.Destination,
		  callerId: event.CallerID,
		  channel: event.Channel,
		  destinationChannel: event.DestinationChannel,
		  startTime: event.StartTime,
		  answerTime: event.AnswerTime || null,
		  endTime: event.EndTime,
		  duration: Number(event.Duration),
		  billableSeconds: Number(event.BillableSeconds),
		  disposition: event.Disposition,
		  amaFlags: event.AMAFlags,
		  userField: event.UserField || null,
		};
	}

	public async handleEventCdrEvent(
		eventName: string,
		payload: unknown,
		retryCount: number,
	): Promise<void> {
		this.logger.log(`Handling ${eventName} (retry ${retryCount})`, payload);
		const cdr = this.normalize(payload as AsteriskCdrEvent);
		await this.callService.processCdr(cdr, null);
	}
}

