import { Body, Controller, Post } from "@nestjs/common";
import { AsteriskService } from "../services/asterisk.service";
import { AsteriskCDRService } from "../services/asterisk-cdr.service";
import ResponseService from "src/shared/utils/services/response.service";

@Controller('/pbx/asterisk')
export class AsteriskController {

	constructor(
		// private readonly asteriskService: AsteriskService, 
		private readonly asteriskCdrService: AsteriskCDRService,
	) {}

	@Post("/cdr/webhook")
	async cdrWebhook(@Body() body: any){
		const data = await this.asteriskCdrService.handleCdr(body);
		return ResponseService.success("success", data);
	}
}