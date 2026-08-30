import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	UsePipes,
} from '@nestjs/common';
import { TOKEN_TYPE } from 'src/constants/tokenConstants';
import { RequireTenant } from 'src/shared/decorators/auth.decorator';
import { CurrentAuth } from 'src/shared/decorators/current-auth.decorator';
import { JwtAuthGuard } from 'src/shared/guards/jwt-auth.guard';
import { ZodValidationPipe } from 'src/shared/pipes/zodValidationPipe';
import type { AuthContext } from 'src/shared/types/auth.types';
import ResponseService from 'src/shared/utils/services/response.service';
import { CreateIvrSessionDto, UpdateIvrSessionDto } from '../dto/ivr-session.dto';
import { IVRService } from '../services/ivr.service';

@Controller('ivr-sessions')
export class IVRSessionController {
	constructor(private readonly ivrService: IVRService) {}

	@Post()
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	@UsePipes(new ZodValidationPipe(CreateIvrSessionDto))
	async createSession(
		@CurrentAuth() auth: AuthContext,
		@Body() dto: CreateIvrSessionDto,
	) {
		const data = await this.ivrService.createSession(auth, dto);
		return ResponseService.success('IVR session created', data);
	}

	@Get('call/:callId')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async getSessionByCallId(
		@CurrentAuth() auth: AuthContext,
		@Param('callId') callId: string,
	) {
		const data = await this.ivrService.getSessionByCallId(auth, callId);
		return ResponseService.success('IVR session fetched', data);
	}

	@Get('ivr/:ivrId')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async getSessionsByIvrId(
		@CurrentAuth() auth: AuthContext,
		@Param('ivrId') ivrId: string,
	) {
		const data = await this.ivrService.getSessionsByIvrId(auth, ivrId);
		return ResponseService.success('IVR sessions fetched', data);
	}

	@Get(':id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async getSessionById(
		@CurrentAuth() auth: AuthContext,
		@Param('id') id: string,
	) {
		const data = await this.ivrService.getSessionById(auth, id);
		return ResponseService.success('IVR session fetched', data);
	}

	@Patch(':id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	@UsePipes(new ZodValidationPipe(UpdateIvrSessionDto))
	async updateSession(
		@CurrentAuth() auth: AuthContext,
		@Param('id') id: string,
		@Body() dto: UpdateIvrSessionDto,
	) {
		const data = await this.ivrService.updateSession(auth, id, dto);
		return ResponseService.success('IVR session updated', data);
	}

	@Delete(':id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async deleteSession(
		@CurrentAuth() auth: AuthContext,
		@Param('id') id: string,
	) {
		await this.ivrService.deleteSession(auth, id);
		return ResponseService.success('IVR session deleted', { id });
	}
}
