import { Module } from '@nestjs/common';
import { StorageController } from './controller/storage.controller';
import { S3Service } from './services/s3.service';
import { StorageService } from './services/storage.service';

@Module({
	controllers: [StorageController],
	providers: [StorageService, S3Service],
	exports: [StorageService],
})
export class StorageModule {}
