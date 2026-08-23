import { config } from 'dotenv';
import { resolve } from 'node:path';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

config({ path: resolve(process.cwd(), '.env') });

function envBoolean(value: string | undefined, defaultValue: boolean): boolean {
	if (value === undefined) return defaultValue;
	return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
}

const tracingEnabled = envBoolean(process.env.TRACING_ENABLED, true);

if (tracingEnabled) {
	if (process.env.OTEL_LOG_LEVEL === 'debug') {
		diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
	}

	const serviceName = process.env.OTEL_SERVICE_NAME ?? process.env.SERVICE_NAME ?? 'commcare';
	const otlpEndpoint =
		process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';

	const sdk = new NodeSDK({
		resource: resourceFromAttributes({
			[ATTR_SERVICE_NAME]: serviceName,
		}),
		traceExporter: new OTLPTraceExporter({
			url: `${otlpEndpoint.replace(/\/$/, '')}/v1/traces`,
		}),
		instrumentations: [
			getNodeAutoInstrumentations({
				'@opentelemetry/instrumentation-fs': { enabled: false },
			}),
		],
	});

	sdk.start();

	process.on('SIGTERM', () => {
		void sdk.shutdown();
	});
}
