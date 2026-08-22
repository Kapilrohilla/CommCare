import {
	DeleteObjectCommand,
	HeadObjectCommand,
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { storageConfig } from '../constants/storage.constant';
import {
	CreateDownloadUrlDto,
	CreateUploadUrlDto,
	DeleteFileDto,
	DownloadUrl,
	ExistsDto,
	UploadUrl,
} from '../dto/storage.dto';

@Injectable()
export class S3Service  {
	private readonly client: S3Client;
	private readonly bucket: string;

	constructor() {
		this.bucket = storageConfig.bucket;
		this.client = new S3Client({
			region: storageConfig.region,
			...(storageConfig.accessKeyId && storageConfig.secretAccessKey
				? {
						credentials: {
							accessKeyId: storageConfig.accessKeyId,
							secretAccessKey: storageConfig.secretAccessKey,
						},
					}
				: {}),
		});
	}

	async createUploadUrl(input: CreateUploadUrlDto): Promise<UploadUrl> {
		this.ensureBucketConfigured();

		const command = new PutObjectCommand({
			Bucket: this.bucket,
			Key: input.path,
		});

		const url = await getSignedUrl(this.client, command, {
			expiresIn: storageConfig.defaultUploadExpiresIn,
		});

		return { url };
	}

	async createDownloadUrl(input: CreateDownloadUrlDto): Promise<DownloadUrl> {
		this.ensureBucketConfigured();

		const command = new GetObjectCommand({
			Bucket: this.bucket,
			Key: input.path,
		});

		const url = await getSignedUrl(this.client, command, {
			expiresIn: input.expiresIn,
		});

		return { url };
	}

	async delete(input: DeleteFileDto): Promise<void> {
		this.ensureBucketConfigured();

		await this.client.send(
			new DeleteObjectCommand({
				Bucket: this.bucket,
				Key: input.path,
			}),
		);
	}

	async exists(input: ExistsDto): Promise<boolean> {
		this.ensureBucketConfigured();

		try {
			await this.client.send(
				new HeadObjectCommand({
					Bucket: this.bucket,
					Key: input.path,
				}),
			);
			return true;
		} catch (error) {
			if (this.isNotFoundError(error)) {
				return false;
			}
			throw error;
		}
	}

	private ensureBucketConfigured(): void {
		if (!this.bucket) {
			throw new InternalServerErrorException('AWS_S3_BUCKET is not configured');
		}
	}

	private isNotFoundError(error: unknown): boolean {
		if (typeof error !== 'object' || error === null) {
			return false;
		}

		if ('name' in error && (error.name === 'NotFound' || error.name === 'NoSuchKey')) {
			return true;
		}

		return (
			'$metadata' in error &&
			typeof error.$metadata === 'object' &&
			error.$metadata !== null &&
			'httpStatusCode' in error.$metadata &&
			error.$metadata.httpStatusCode === 404
		);
	}
}
