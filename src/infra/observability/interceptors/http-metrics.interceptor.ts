import {
	CallHandler,
	ExecutionContext,
	Injectable,
	NestInterceptor,
} from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import { Observable, tap } from 'rxjs';
import {
	HTTP_REQUEST_DURATION_SECONDS,
	HTTP_REQUESTS_TOTAL,
} from '../constants/observability.constant';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
	constructor(
		@InjectMetric(HTTP_REQUESTS_TOTAL)
		private readonly httpRequestsTotal: Counter<string>,
		@InjectMetric(HTTP_REQUEST_DURATION_SECONDS)
		private readonly httpRequestDuration: Histogram<string>,
	) {}

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		if (context.getType() !== 'http') {
			return next.handle();
		}

		const request = context.switchToHttp().getRequest<{
			method: string;
			route?: { path?: string };
			url: string;
		}>();
		const start = process.hrtime.bigint();
		const route = request.route?.path ?? request.url;

		return next.handle().pipe(
			tap({
				next: () => this.recordMetrics(context, request.method, route, start),
				error: () => this.recordMetrics(context, request.method, route, start),
			}),
		);
	}

	private recordMetrics(
		context: ExecutionContext,
		method: string,
		route: string,
		start: bigint,
	): void {
		const response = context.switchToHttp().getResponse<{ statusCode: number }>();
		const status = String(response.statusCode ?? 500);
		const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
		const labels = { method, route, status };

		this.httpRequestsTotal.inc(labels);
		this.httpRequestDuration.observe(labels, durationSeconds);
	}
}
