import { Body, Controller, Delete, Get, Param, Patch, Post, UsePipes } from '@nestjs/common';
import ResponseService from 'src/shared/utils/services/response.service';
import { ZodValidationPipe } from 'src/shared/pipes/zodValidationPipe';
import {
	CreateFreePbxExtensionDto,
	CreateFreePbxExtensionRangeDto,
	UpdateFreePbxExtensionDto,
} from '../dto/freepbx.dto';
import { FreePbxService } from '../services/freepbx.service';

@Controller('/pbx/freepbx')
export class FreePbxController {
	constructor(private readonly freePbxService: FreePbxService) {}

	@Post('/authenticate')
	async authenticate() {
		const accessToken = await this.freePbxService.getAccessToken();
		return ResponseService.success('FreePBX authentication successful', accessToken);
	}

	@Post('/apply-config')
	async applyConfig() {
		const data = await this.freePbxService.applyConfig();
		return ResponseService.success('FreePBX config reload initiated', data);
	}

	@Get('/extensions')
	async getExtensions() {
		const data = await this.freePbxService.getExtensions();
		return ResponseService.success('FreePBX extensions fetched', data);
	}

	@Get('/extensions/:extension')
	async getExtension(@Param('extension') extension: string) {
		const data = await this.freePbxService.getExtension(extension);
		return ResponseService.success('FreePBX extension fetched', data);
	}

	@Post('/extensions')
	@UsePipes(new ZodValidationPipe(CreateFreePbxExtensionDto))
	async createExtension(@Body() body: CreateFreePbxExtensionDto) {
		const data = await this.freePbxService.createExtension(body);
		return ResponseService.success('FreePBX extension created', data);
	}

	@Post('/extensions/range')
	@UsePipes(new ZodValidationPipe(CreateFreePbxExtensionRangeDto))
	async createExtensionRange(@Body() body: CreateFreePbxExtensionRangeDto) {
		const data = await this.freePbxService.createExtensionRange(body);
		return ResponseService.success('FreePBX extension range created', data);
	}

	@Patch('/extensions/:extension')
	@UsePipes(new ZodValidationPipe(UpdateFreePbxExtensionDto))
	async updateExtension(@Param('extension') extension: string, @Body() body: UpdateFreePbxExtensionDto) {
		const data = await this.freePbxService.updateExtension(extension, body);
		return ResponseService.success('FreePBX extension updated', data);
	}

	@Delete('/extensions/:extension')
	async deleteExtension(@Param('extension') extension: string) {
		const data = await this.freePbxService.deleteExtension(extension);
		return ResponseService.success('FreePBX extension deleted', data);
	}
}
