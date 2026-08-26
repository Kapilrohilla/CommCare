import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { ZodError } from 'zod';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const payload = this.toErrorResponse(exception);
    response.status(payload.statusCode).json(payload);
  }

  private normalizeBody(res: object): Record<string, unknown> {
    const body = res as Record<string, unknown>;

    const message = Array.isArray(body.message)
      ? body.message.join(', ')
      : typeof body.message === 'string'
        ? body.message
        : 'An error occurred';

    const code =
      typeof body.code === 'string'
        ? body.code
        : typeof body.error === 'string'
          ? body.error.toUpperCase().replace(/\s+/g, '_')
          : 'HTTP_ERROR';

    const normalized: Record<string, unknown> = { code, message };

    if (typeof body.retryAfterMs === 'number') {
      normalized.retryAfterMs = body.retryAfterMs;
    }

    if (body.details !== undefined) {
      normalized.details = body.details;
    }

    return normalized;
  }

  private toErrorResponse(exception: unknown) {
    const timestamp = new Date().toISOString();

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'object' && res !== null) {
        return { statusCode, timestamp, ...this.normalizeBody(res) };
      }

      return {
        statusCode,
        code: HttpStatus[statusCode] ?? 'HTTP_ERROR',
        message: String(res),
        timestamp,
      };
    }

    if (exception instanceof ZodError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: exception.flatten(),
        timestamp,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      timestamp,
    };
  }
}
