import { ConsoleLogger, Injectable} from "@nestjs/common";
import { CallsService } from "src/modules/calls/services/calls.service";
import { AsteriskCdrEvent } from "../dto/asterisk-cdr.dto";


@Injectable()
export class AsteriskCDRService {

	constructor(private readonly callService: CallsService, private readonly logger: ConsoleLogger) {}


	async handleCdr(event: AsteriskCdrEvent) {
		// {
		// 	event: 'call.completed',
		// 	raw: {
		// 	  Event: 'Cdr',
		// 	  Privilege: 'cdr,all',
		// 	  AccountCode: '',
		// 	  Source: '102',
		// 	  Destination: '101',
		// 	  DestinationContext: 'from-internal',
		// 	  CallerID: '"Kapil mobile" <102>',
		// 	  Channel: 'PJSIP/102-00000019',
		// 	  DestinationChannel: 'PJSIP/101-0000001a',
		// 	  LastApplication: 'Dial',
		// 	  LastData: 'PJSIP/101/sip:101@103.211.54.233:60044;rinstance=29a886c9ae428852,,HhTtrb(func-',
		// 	  StartTime: '2026-08-23 11:58:43',
		// 	  AnswerTime: '2026-08-23 11:58:45',
		// 	  EndTime: '2026-08-23 11:58:49',
		// 	  Duration: '6',
		// 	  BillableSeconds: '3',
		// 	  Disposition: 'ANSWERED',
		// 	  AMAFlags: 'DOCUMENTATION',
		// 	  UniqueID: '1787486323.25',
		// 	  UserField: ''
		// 	},
		// 	receivedAt: '2026-08-23T11:58:49.678Z'
		//   }

		
		
		// I want to extract the data to save the event

		//  const cdr = this.normalize(event);
	
		// await this.callService.processCdr(cdr, null);
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
}

