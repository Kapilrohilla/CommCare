import { Body, Controller, Post } from "@nestjs/common";
import { AsteriskService } from "../services/asterisk.service";
import { AsteriskCDRService } from "../services/asterisk-cdr.service";

@Controller('/pbx/asterisk')
export class AsteriskController {

	constructor(
		// private readonly asteriskService: AsteriskService, 
		private readonly asteriskCdrService: AsteriskCDRService
	) {}

	@Post("/cdr/webhook")
	async cdrWebhook(@Body() body: any){
		return this.asteriskCdrService.handleCdr(body);
	}
}