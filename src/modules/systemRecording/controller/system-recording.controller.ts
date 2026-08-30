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
import { SystemRecordingService } from '../services/system-recording.service';
import { JwtAuthGuard } from 'src/shared/guards/jwt-auth.guard';
import { TOKEN_TYPE } from 'src/constants/tokenConstants';
import { RequireTenant } from 'src/shared/decorators/auth.decorator';
import {
	ConfirmUploadSystemRecordingDto,
	CreateSystemRecordingDto,
	UpdateSystemRecordingDto,
	UploadSystemRecordingFileDto,
} from '../dto/system-recording.dto';
import { CurrentAuth } from 'src/shared/decorators/current-auth.decorator';
import type { AuthContext } from 'src/shared/types/auth.types';
import { ZodValidationPipe } from 'src/shared/pipes/zodValidationPipe';
import ResponseService from 'src/shared/utils/services/response.service';

@Controller('system-recordings')
export class SystemRecordingController {
	constructor(
		private readonly systemRecordingService: SystemRecordingService,
	) {}

	@Post()
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	@UsePipes(new ZodValidationPipe(CreateSystemRecordingDto))
	async createSystemRecording(
		@CurrentAuth() auth: AuthContext,
		@Body() dto: CreateSystemRecordingDto,
	) {
		const data = await this.systemRecordingService.createSystemRecording(auth, dto);
		return ResponseService.success('System recording created', data);
	}

	@Get('tenant')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async getByTenantId(@CurrentAuth() auth: AuthContext) {
		const data =
			await this.systemRecordingService.getSystemRecordingsByTenant(auth);
		return ResponseService.success('System recordings fetched', data);
	}

	@Get(':id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async getSystemRecordingById(
		@CurrentAuth() auth: AuthContext,
		@Param('id') id: string,
	) {
		const data = await this.systemRecordingService.getSystemRecordingById(
			auth,
			id,
		);
		return ResponseService.success('System recording fetched', data);
	}

	@Patch(':id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	@UsePipes(new ZodValidationPipe(UpdateSystemRecordingDto))
	async updateSystemRecordingById(
		@CurrentAuth() auth: AuthContext,
		@Param('id') id: string,
		@Body() dto: UpdateSystemRecordingDto,
	) {
		const data = await this.systemRecordingService.updateSystemRecordingById(
			auth,
			id,
			dto,
		);
		return ResponseService.success('System recording updated', data);
	}

	@Post(':id/upload-url')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	@UsePipes(new ZodValidationPipe(UploadSystemRecordingFileDto))
	async createUploadUrl(
		@CurrentAuth() auth: AuthContext,
		@Param('id') id: string,
		@Body() dto: UploadSystemRecordingFileDto,
	) {
		const data = await this.systemRecordingService.createUploadUrl(auth, id, dto);
		return ResponseService.success('Upload URL created', data);
	}

	@Post(':id/upload/confirm')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	@UsePipes(new ZodValidationPipe(ConfirmUploadSystemRecordingDto))
	async confirmUpload(
		@CurrentAuth() auth: AuthContext,
		@Param('id') id: string,
		@Body() dto: ConfirmUploadSystemRecordingDto,
	) {
		const data = await this.systemRecordingService.confirmUpload(auth, id, dto);
		return ResponseService.success('Upload confirmed, processing queued', data);
	}

	@Post(':id/process')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async processSystemRecording(
		@CurrentAuth() auth: AuthContext,
		@Param('id') id: string,
	) {
		const data = await this.systemRecordingService.processSystemRecording(
			auth,
			id,
		);
		return ResponseService.success('Processing queued', data);
	}

	@Delete(':id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async deleteSystemRecordingById(
		@CurrentAuth() auth: AuthContext,
		@Param('id') id: string,
	) {
		await this.systemRecordingService.deleteSystemRecordingById(auth, id);
		return ResponseService.success('System recording deleted', { id });
	}
}
