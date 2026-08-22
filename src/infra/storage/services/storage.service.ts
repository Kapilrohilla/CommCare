import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
	CreateDownloadUrlDto,
	CreateUploadUrlDto,
	DeleteFileDto,
	DownloadUrl,
	ExistsDto,
	UploadUrl,
} from '../dto/storage.dto';
import { S3Service } from './s3.service';
import { env } from '../../../config/env.config';
import { storageVendors } from '../constants/storage.constant';

@Injectable()
export class StorageService {
	constructor(private readonly s3Service: S3Service) { }

	private defaultVendor() {
		switch (env.DEFAULT_STORAGE_VENDOR) {
			case storageVendors.s3:
				return this.s3Service;
			default:
				throw new InternalServerErrorException('Invalid storage vendor: ' + env.DEFAULT_STORAGE_VENDOR);
		}
	}

	async createUploadUrl(input: CreateUploadUrlDto): Promise<UploadUrl> {
		return this.defaultVendor().createUploadUrl(input);
	}

	async createDownloadUrl(input: CreateDownloadUrlDto): Promise<DownloadUrl> {
		return this.defaultVendor().createDownloadUrl(input);
	}

	async delete(input: DeleteFileDto): Promise<void> {
		return this.defaultVendor().delete(input);
	}

	async exists(input: ExistsDto): Promise<boolean> {
		return this.defaultVendor().exists(input);
	}
}
