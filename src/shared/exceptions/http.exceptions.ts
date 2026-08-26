import { HttpException, HttpStatus } from '@nestjs/common';

export class CustomError extends HttpException {
	constructor(statusCode: number, code: string, message: string) {
		super({ code, message }, statusCode);
	}
}

export class RateLimitError extends HttpException {
	readonly retryAfterMs: number;

	constructor(message: string, retryAfterMs: number) {
		super({ code: 'RATE_LIMITED', message, retryAfterMs }, HttpStatus.TOO_MANY_REQUESTS);
		this.retryAfterMs = retryAfterMs;
	}
}
