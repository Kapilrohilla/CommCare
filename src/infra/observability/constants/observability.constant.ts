import { env } from '../../../config/env.config';

export const observabilityConfig = {
	metricsEnabled: env.METRICS_ENABLED,
	metricsPath: env.METRICS_PATH,
	serviceName: env.SERVICE_NAME,
	logLevel: env.LOG_LEVEL,
	tracingEnabled: env.TRACING_ENABLED,
	otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
};

export const HTTP_REQUESTS_TOTAL = 'http_requests_total';
export const HTTP_REQUEST_DURATION_SECONDS = 'http_request_duration_seconds';
