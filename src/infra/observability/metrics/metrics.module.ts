import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import {
	makeCounterProvider,
	makeHistogramProvider,
	PrometheusModule,
} from '@willsoto/nestjs-prometheus';
import {
	HTTP_REQUEST_DURATION_SECONDS,
	HTTP_REQUESTS_TOTAL,
	observabilityConfig,
} from '../constants/observability.constant';
import { HttpMetricsInterceptor } from '../interceptors/http-metrics.interceptor';

@Module({
	imports: [
		PrometheusModule.register({
			path: observabilityConfig.metricsPath,
			defaultMetrics: {
				enabled: observabilityConfig.metricsEnabled,
			},
		}),
	],
	providers: [
		makeCounterProvider({
			name: HTTP_REQUESTS_TOTAL,
			help: 'Total number of HTTP requests',
			labelNames: ['method', 'route', 'status'],
		}),
		makeHistogramProvider({
			name: HTTP_REQUEST_DURATION_SECONDS,
			help: 'HTTP request duration in seconds',
			labelNames: ['method', 'route', 'status'],
			buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
		}),
		{
			provide: APP_INTERCEPTOR,
			useClass: HttpMetricsInterceptor,
		},
	],
	exports: [PrometheusModule],
})
export class MetricsModule {}
