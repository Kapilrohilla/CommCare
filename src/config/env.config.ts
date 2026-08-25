import { config } from 'dotenv';
import { resolve } from 'node:path';
import { Environment } from 'src/constants/environmentConstants';
import z from 'zod';

config({ path: resolve(process.cwd(), '.env') });

/** Parse env booleans correctly — z.coerce.boolean() treats "false" as true. */
const envBoolean = (defaultValue: boolean) =>
	z
		.union([z.boolean(), z.string()])
		.optional()
		.transform((val) => {
			if (val === undefined) return defaultValue;
			if (typeof val === 'boolean') return val;
			return ['true', '1', 'yes', 'on'].includes(val.toLowerCase());
		});

export const envSchema = z.object({
	HTTP_PORT: z.coerce.number().int().positive().default(3000),
	ENV: z.enum([Environment.LOCAL, Environment.PRODUCTION, Environment.TEST]).default(Environment.LOCAL),
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
	METRICS_ENABLED: envBoolean(true),
	METRICS_PATH: z.string().min(1).default('/infra/observability/metrics'),
	SERVICE_NAME: z.string().min(1).default('commcare'),
	LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
	TRACING_ENABLED: envBoolean(true),
	OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://localhost:4318'),
	OTEL_SERVICE_NAME: z.string().min(1).optional(),
	REDIS_HOST: z.string().default('localhost'),
	REDIS_PORT: z.coerce.number().int().positive().default(6379),
	REDIS_USERNAME: z.string().optional(),
	REDIS_PASSWORD: z.string().optional(),
	REDIS_DB: z.coerce.number().int().nonnegative().default(0),
	REDIS_TLS: envBoolean(false),
	KAFKA_BROKERS: z.string().default('localhost:9092'),
	KAFKA_HOST_IP: z.string().optional(),
	KAFKA_CLIENT_ID: z.string().default('commcare'),
	KAFKA_GROUP_ID: z.string().default('commcare-group'),
	KAFKA_SUBSCRIBER: z.enum(['ALL', 'DEFAULT', 'NONE']).default('NONE'),
	KAFKA_SSL_ENABLED: envBoolean(false),
	KAFKA_SECURITY_PROTOCOL: z.string().optional(),
	KAFKA_SSL_REJECT_UNAUTHORIZED: envBoolean(true),
	KAFKA_SASL_MECHANISM: z.string().optional(),
	KAFKA_USERNAME: z.string().optional(),
	KAFKA_PASSWORD: z.string().optional(),
	BULLMQ_SCHEDULER_ENABLED: envBoolean(false),
	BULLMQ_CONSUMERS_ENABLED: envBoolean(false),
	BULLMQ_SUBSCRIBER: z.enum(['ALL', 'DEFAULT', 'NONE']).default('NONE'),
	BULLMQ_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
	BULLMQ_UI_ENABLED: envBoolean(false),
	BULLMQ_UI_PATH: z.string().min(1).default('/infra/bullmq/queues'),
	JWT_SECRET: z.string().min(32).default('dev-jwt-secret-change-in-production-min-32-chars'),
	// Asterisk
	ARI_HOST: z.string().min(1),
	ARI_USER: z.string().min(1),
	ARI_PASSWORD: z.string().min(1),

	// FreePbx
	FREEPBX_BASE_URL: z.string().url().min(1),
	FREEPBX_GRAPHQL_URL: z.string().url().min(1),
	FREEPBX_TOKEN_URL: z.string().url().min(1),
	FREEPBX_CLIENT_ID: z.string().min(1),
	FREEPBX_CLIENT_SECRET: z.string().min(1),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
	console.error('Invalid environment variables:', parsedEnv.error.flatten().fieldErrors);
	process.exit(1);
}

export const env = parsedEnv.data;
export type Env = z.infer<typeof envSchema>;
