import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, UsePipes } from '@nestjs/common';
import ResponseService from 'src/shared/utils/services/response.service';
import { ZodValidationPipe } from 'src/shared/pipes/zodValidationPipe';
import { ExtensionService } from '../services/extension.service';
import { JwtAuthGuard } from 'src/shared/guards/jwt-auth.guard';
import { TOKEN_TYPE } from 'src/constants/tokenConstants';
import { ClsService } from 'src/shared/context/cls.service';
import { RequireTenant } from 'src/shared/decorators/auth.decorator';
import {
	BulkCreateExtensionDto,
	CreateExtensionDto,
	UpdateExtensionDto,
} from '../dto/extension.dto';

@Controller('/pbx/extension')
export class ExtensionController {
	constructor(
		private readonly extensionService: ExtensionService,
		private readonly clsService: ClsService,
	) {}

	@Get('/tenant')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async getTenantExtensions() {
		const tenantId = this.clsService.get('tenantId') as string;
		const extensions = await this.extensionService.getExtensionsByTenantId(tenantId);
		return ResponseService.success('Extensions fetched successfully', extensions);
	}

	@Get('/')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	async getExtensions() {
		const extensions = await this.extensionService.getExtensions();
		return ResponseService.success('Extensions fetched successfully', extensions);
	}

	@Get('/:id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	async getExtension(@Param('id') id: string) {
		const extension = await this.extensionService.getExtension(id);
		if (!extension) {
			throw new NotFoundException('Extension not found');
		}
		return ResponseService.success('Extension fetched successfully', extension);
	}

	@Post('/')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	@UsePipes(new ZodValidationPipe(CreateExtensionDto))
	async createExtension(@Body() body: CreateExtensionDto) {
		const tenantId = this.clsService.get('tenantId') as string;
		const extension = await this.extensionService.createExtension({ ...body, tenantId });
		return ResponseService.success('Extension created successfully', extension);
	}

	@Post('/bulk')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	@UsePipes(new ZodValidationPipe(BulkCreateExtensionDto))
	async bulkCreateExtensions(@Body() body: BulkCreateExtensionDto) {
		const tenantId = this.clsService.get('tenantId') as string;
		const result = await this.extensionService.queueBulkExtensionCreate(body, tenantId);
		return ResponseService.success('Bulk extension creation queued', result);
	}

	@Patch('/:id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@UsePipes(new ZodValidationPipe(UpdateExtensionDto))
	async updateExtension(@Param('id') id: string, @Body() body: UpdateExtensionDto) {
		const extension = await this.extensionService.updateExtension(id, body);
		return ResponseService.success('Extension updated successfully', extension);
	}

	@Delete('/:id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	async deleteExtension(@Param('id') id: string) {
		await this.extensionService.deleteExtension(id);
		return ResponseService.success('Extension deleted successfully', null);
	}
}
