import { config } from 'dotenv';
import { resolve } from 'node:path';
import z from 'zod';

config({ path: resolve(process.cwd(), '.env') });

export const envSchema = z.object({
	HTTP_PORT: z.coerce.number().int().positive().default(3000),
	ENV: z.enum(['development', 'production', 'test']).default('development'),
	AWS_REGION: z.string().min(1).default('us-east-1'),
	AWS_S3_BUCKET: z.string().min(1),
	AWS_ACCESS_KEY_ID: z.string().min(1).optional(),
	AWS_SECRET_ACCESS_KEY: z.string().min(1).optional(),
	DEFAULT_STORAGE_VENDOR: z.enum(['s3']).default('s3'),
	WRITER_DB_HOST: z.string().min(1),
	WRITER_DB_PORT: z.coerce.number().int().positive().default(5432),
	WRITER_DB_USER: z.string().min(1),
	WRITER_DB_PASSWORD: z.string().min(1),
	WRITER_DB_NAME: z.string().min(1),
	READER_DB_HOST: z.string().min(1),
	READER_DB_PORT: z.coerce.number().int().positive().default(5432),
	READER_DB_USER: z.string().min(1),
	READER_DB_PASSWORD: z.string().min(1),
	READER_DB_NAME: z.string().min(1),
	METRICS_ENABLED: z.coerce.boolean().default(true),
	METRICS_PATH: z.string().min(1).default('/metrics'),
	SERVICE_NAME: z.string().min(1).default('commcare'),
	LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
	console.error('Invalid environment variables:', parsedEnv.error.flatten().fieldErrors);
	process.exit(1);
}

export const env = parsedEnv.data;
export type Env = z.infer<typeof envSchema>;
