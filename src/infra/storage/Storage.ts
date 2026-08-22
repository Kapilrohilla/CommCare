import {
	CreateDownloadUrlDto,
	CreateUploadUrlDto,
	DeleteFileDto,
	DownloadUrl,
	ExistsDto,
	UploadUrl,
} from './dto/storage.dto';

export interface Storage {
	createUploadUrl(input: CreateUploadUrlDto): Promise<UploadUrl>;
	createDownloadUrl(input: CreateDownloadUrlDto): Promise<DownloadUrl>;
	delete(input: DeleteFileDto): Promise<void>;
	exists(input: ExistsDto): Promise<boolean>;
}
