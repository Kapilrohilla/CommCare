import { Body, Controller, Delete, Get, Post, Query, UsePipes } from '@nestjs/common';
import { ZodValidationPipe } from '../../../shared/pipes/zodValidationPipe';
import {
	CreateDownloadUrlDto,
	CreateUploadUrlDto,
	DeleteFileDto,
	DownloadUrl,
	ExistsDto,
	UploadUrl,
} from '../dto/storage.dto';
import { StorageService } from '../services/storage.service';

@Controller('storage')
export class StorageController {
	constructor(private readonly storageService: StorageService) {}

	@Post('upload')
	@UsePipes(new ZodValidationPipe(CreateUploadUrlDto))
	async createUploadUrl(@Body() body: CreateUploadUrlDto): Promise<UploadUrl> {
		return this.storageService.createUploadUrl(body);
	}

	@Post('download')
	@UsePipes(new ZodValidationPipe(CreateDownloadUrlDto))
	async createDownloadUrl(@Body() body: CreateDownloadUrlDto): Promise<DownloadUrl> {
		return this.storageService.createDownloadUrl(body);
	}

	@Delete()
	@UsePipes(new ZodValidationPipe(DeleteFileDto))
	async delete(@Body() body: DeleteFileDto): Promise<{ success: boolean }> {
		await this.storageService.delete(body);
		return { success: true };
	}

	@Get('exists')
	async exists(@Query(new ZodValidationPipe(ExistsDto)) query: ExistsDto): Promise<{ exists: boolean }> {
		const exists = await this.storageService.exists(query);
		return { exists };
	}
}
