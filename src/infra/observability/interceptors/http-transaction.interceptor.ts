import {
	CallHandler,
	ExecutionContext,
	Injectable,
	NestInterceptor,
} from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import { Observable, tap } from 'rxjs';
import { observabilityConfig } from '../constants/observability.constant';
import { sanitizePayload, serializePayload } from '../utils/sanitize-payload.util';

const SKIP_PAYLOAD_PATHS = [
	'/healthCheck/livez',
	'/healthCheck/readyz',
	'/healthCheck/health',
	observabilityConfig.metricsPath,
];

@Injectable()
export class HttpTransactionInterceptor implements NestInterceptor {
	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		if (context.getType() !== 'http') {
			return next.handle();
		}

		const request = context.switchToHttp().getRequest<{
			method: string;
			route?: { path?: string };
			url: string;
			body?: unknown;
			query?: Record<string, unknown>;
			params?: Record<string, unknown>;
			headers?: Record<string, string | string[] | undefined>;
		}>();

		const route = request.route?.path ?? request.url.split('?')[0];
		const skipPayload = SKIP_PAYLOAD_PATHS.some((path) => route.startsWith(path));
		const start = process.hrtime.bigint();
		const activeSpan = trace.getActiveSpan();

		if (activeSpan) {
			activeSpan.setAttribute('http.route', route);
			if (!skipPayload) {
				activeSpan.setAttribute('http.request.body', serializePayload(request.body));
				if (request.query && Object.keys(request.query).length > 0) {
					activeSpan.setAttribute(
						'http.request.query',
						serializePayload(request.query),
					);
				}
			}
		}

		return next.handle().pipe(
			tap({
				next: () => this.recordTransaction(context, request.method, route, start, skipPayload, request),
				error: () => this.recordTransaction(context, request.method, route, start, skipPayload, request),
			}),
		);
	}

	private recordTransaction(
		context: ExecutionContext,
		method: string,
		route: string,
		start: bigint,
		skipPayload: boolean,
		request: {
			body?: unknown;
			query?: Record<string, unknown>;
			params?: Record<string, unknown>;
		},
	): void {
		const response = context.switchToHttp().getResponse<{ statusCode: number }>();
		const status = response.statusCode ?? 500;
		const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
		const span = trace.getActiveSpan();
		const spanContext = span?.spanContext();

		if (span) {
			span.setAttribute('http.status_code', status);
			span.setAttribute('http.response.duration_ms', durationMs);
		}

		if (skipPayload) {
			return;
		}

		this.logTransaction({
			level: 'info',
			context: 'WebTransaction',
			type: 'web_transaction',
			service: observabilityConfig.serviceName,
			traceId: spanContext?.traceId,
			spanId: spanContext?.spanId,
			method,
			route,
			status,
			durationMs: Math.round(durationMs * 100) / 100,
			request: {
				body: sanitizePayload(request.body),
				query: sanitizePayload(request.query),
				params: sanitizePayload(request.params),
			},
		});
	}

	private logTransaction(payload: Record<string, unknown>): void {
		process.stdout.write(`${JSON.stringify(payload)}\n`);
	}
}
