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
import { CreateIvrDto, UpdateIvrDto } from '../dto/ivr.dto';
import { IVRService } from '../services/ivr.service';

@Controller('ivr')
export class IVRController {
	constructor(private readonly ivrService: IVRService) {}

	@Post()
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	@UsePipes(new ZodValidationPipe(CreateIvrDto))
	async createIvr(@CurrentAuth() auth: AuthContext, @Body() dto: CreateIvrDto) {
		const data = await this.ivrService.createIvr(auth, dto);
		return ResponseService.success('IVR created', data);
	}

	@Get('tenant')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async getIvrsByTenant(@CurrentAuth() auth: AuthContext) {
		const data = await this.ivrService.getIvrsByTenant(auth);
		return ResponseService.success('IVRs fetched', data);
	}

	@Get(':id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async getIvrById(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
		const data = await this.ivrService.getIvrById(auth, id);
		return ResponseService.success('IVR fetched', data);
	}

	@Patch(':id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	@UsePipes(new ZodValidationPipe(UpdateIvrDto))
	async updateIvr(
		@CurrentAuth() auth: AuthContext,
		@Param('id') id: string,
		@Body() dto: UpdateIvrDto,
	) {
		const data = await this.ivrService.updateIvr(auth, id, dto);
		return ResponseService.success('IVR updated', data);
	}

	@Delete(':id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async deleteIvr(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
		await this.ivrService.deleteIvr(auth, id);
		return ResponseService.success('IVR deleted', { id });
	}
}
