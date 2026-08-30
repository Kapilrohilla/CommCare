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
import { CreateIvrOptionDto, UpdateIvrOptionDto } from '../dto/ivr-options.dto';
import { IVRService } from '../services/ivr.service';

@Controller('ivr/:ivrId/options')
export class IVROptionsController {
	constructor(private readonly ivrService: IVRService) {}

	@Post()
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	@UsePipes(new ZodValidationPipe(CreateIvrOptionDto))
	async createOption(
		@CurrentAuth() auth: AuthContext,
		@Param('ivrId') ivrId: string,
		@Body() dto: CreateIvrOptionDto,
	) {
		const data = await this.ivrService.createOption(auth, ivrId, dto);
		return ResponseService.success('IVR option created', data);
	}

	@Get()
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async getOptions(
		@CurrentAuth() auth: AuthContext,
		@Param('ivrId') ivrId: string,
	) {
		const data = await this.ivrService.getOptions(auth, ivrId);
		return ResponseService.success('IVR options fetched', data);
	}

	@Get(':optionId')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async getOptionById(
		@CurrentAuth() auth: AuthContext,
		@Param('ivrId') ivrId: string,
		@Param('optionId') optionId: string,
	) {
		const data = await this.ivrService.getOptionById(auth, ivrId, optionId);
		return ResponseService.success('IVR option fetched', data);
	}

	@Patch(':optionId')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	@UsePipes(new ZodValidationPipe(UpdateIvrOptionDto))
	async updateOption(
		@CurrentAuth() auth: AuthContext,
		@Param('ivrId') ivrId: string,
		@Param('optionId') optionId: string,
		@Body() dto: UpdateIvrOptionDto,
	) {
		const data = await this.ivrService.updateOption(
			auth,
			ivrId,
			optionId,
			dto,
		);
		return ResponseService.success('IVR option updated', data);
	}

	@Delete(':optionId')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async deleteOption(
		@CurrentAuth() auth: AuthContext,
		@Param('ivrId') ivrId: string,
		@Param('optionId') optionId: string,
	) {
		await this.ivrService.deleteOption(auth, ivrId, optionId);
		return ResponseService.success('IVR option deleted', { id: optionId });
	}
}
