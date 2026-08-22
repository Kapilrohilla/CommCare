import { env } from '../../../config/env.config';

export const DEFAULT_UPLOAD_EXPIRES_IN = 3600;

export const storageConfig = {
	region: env.AWS_REGION,
	bucket: env.AWS_S3_BUCKET,
	accessKeyId: env.AWS_ACCESS_KEY_ID,
	secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
	defaultUploadExpiresIn: DEFAULT_UPLOAD_EXPIRES_IN,
	defaultVendor: env.DEFAULT_STORAGE_VENDOR,
};

export const storageVendors = {
	s3: 's3',
};