import { Body, Controller, Post, UsePipes } from '@nestjs/common';
import { AsteriskCDRService } from '../services/asterisk-cdr.service';
import ResponseService from 'src/shared/utils/services/response.service';
import { AsteriskCdrWebhookPayload } from '../dto/asterisk-cdr.dto';
import { ZodValidationPipe } from 'src/shared/pipes/zodValidationPipe';

@Controller('/pbx/asterisk')
export class AsteriskController {
	constructor(private readonly asteriskCdrService: AsteriskCDRService) {}

	@Post('/cdr/webhook')
	@UsePipes(new ZodValidationPipe(AsteriskCdrWebhookPayload))
	async cdrWebhook(@Body() body: AsteriskCdrWebhookPayload) {
		const data = await this.asteriskCdrService.handleCdr(body);
		return ResponseService.success('success', data);
	}
}
