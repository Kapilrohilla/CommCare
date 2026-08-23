import { Injectable } from "@nestjs/common";
import { CallsService } from "src/modules/calls/services/calls.service";
import { AsteriskCdrEvent } from "../dto/asterisk-cdr.dto";


@Injectable()
export class AsteriskCDRService {

	constructor(private readonly callService: CallsService) {}


	async handleCdr(event: AsteriskCdrEvent) {
		console.log("handleCdr called")
		console.log(JSON.stringify(event))
		console.log("handleCdr ended")
		//  const cdr = this.normalize(event);
	
		// await this.callService.processCdr(cdr, null);
	  }


	private normalize(event: AsteriskCdrEvent) {
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
}

