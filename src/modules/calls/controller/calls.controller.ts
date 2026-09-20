import {
	Body,
	Controller,
	Get,
	Param,
	Post,
	Query,
	UsePipes,
} from '@nestjs/common';
import { CallsService } from '../services/calls.service';
import {
	CallOriginateDto,
	DialSessionDto,
	ListCallsQueryDto,
} from '../dto/calls.dto';
import ResponseService from 'src/shared/utils/services/response.service';
import type { AuthContext } from 'src/shared/types/auth.types';
import { CurrentAuth } from 'src/shared/decorators/current-auth.decorator';
import { JwtAuthGuard } from 'src/shared/guards/jwt-auth.guard';
import { TOKEN_TYPE } from 'src/constants/tokenConstants';
import { ZodValidationPipe } from 'src/shared/pipes/zodValidationPipe';
import { AsteriskCdrWebhookPayload } from 'src/modules/pbx/dto/asterisk-cdr.dto';
import { RequireTenant } from 'src/shared/decorators/auth.decorator';

/**
 * Call control, activity listing, and click2call orchestration.
 */
@Controller('calls')
export class CallsController {
	constructor(private readonly callsService: CallsService) {}

	@Post('/cdr/webhook')
	@UsePipes(new ZodValidationPipe(AsteriskCdrWebhookPayload))
	async cdrWebhook(@Body() body: AsteriskCdrWebhookPayload) {
		const data = await this.callsService.consumeCdrWebhook(body);
		return ResponseService.success('success', data);
	}

	@Get('dashboard')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async getDashboard(@CurrentAuth() auth: AuthContext) {
		const data = await this.callsService.getDashboardForTenant(auth);
		return ResponseService.success('Call dashboard fetched', data);
	}

	@Get('tenant')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async listCallsByTenant(
		@CurrentAuth() auth: AuthContext,
		@Query() query: Record<string, string>,
	) {
		const filters = ListCallsQueryDto.parse(query);
		const data = await this.callsService.listCallsForTenant(auth, filters);
		return ResponseService.success('Calls fetched', data);
	}

	@Get(':id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async getCallById(
		@CurrentAuth() auth: AuthContext,
		@Param('id') id: string,
	) {
		const data = await this.callsService.getCallForTenant(auth, id);
		return ResponseService.success('Call fetched', data);
	}

	@Post('/click-to-call')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@UsePipes(new ZodValidationPipe(CallOriginateDto))
	async originateClick2Call(
		@CurrentAuth() auth: AuthContext,
		@Body() callOriginateDto: CallOriginateDto,
	) {
		const { fromNumber, toNumber, type } = callOriginateDto;
		const data = await this.callsService.originateClick2Call(
			auth,
			fromNumber,
			toNumber,
			type,
		);
		return ResponseService.success('success', data);
	}

	@Post('/dialer/session')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@UsePipes(new ZodValidationPipe(DialSessionDto))
	async dialSession(
		@CurrentAuth() auth: AuthContext,
		@Body() dialSessionDto: DialSessionDto,
	) {
		const { startOrEnd, extensionId } = dialSessionDto;
		const data = await this.callsService.startOrEndDialerSession(
			auth,
			startOrEnd,
			extensionId,
		);
		return ResponseService.success('success', data);
	}
}
