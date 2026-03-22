import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { ApiErrorException } from './api-error.exception';
import { getRequestId } from './request-id';
import type { StructuredLoggerService } from '../observability/structured-logger.service';

type ErrorEnvelope = {
  error: {
    code: string;
    message: string;
    details: unknown;
    request_id: string;
  };
};

function defaultErrorCode(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'bad_request';
    case HttpStatus.FORBIDDEN:
      return 'forbidden';
    case HttpStatus.NOT_FOUND:
      return 'not_found';
    case HttpStatus.CONFLICT:
      return 'conflict';
    default:
      return 'internal_error';
  }
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger?: StructuredLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<{ status(code: number): { json(payload: ErrorEnvelope): void } }>();
    const request = ctx.getRequest<{
      method?: string;
      originalUrl?: string;
      url?: string;
      requestId?: string;
      headers?: Record<string, string | string[] | undefined>;
    }>();
    const requestId = getRequestId(request);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'internal_error';
    let message = 'Internal server error';
    let details: unknown = null;

    if (exception instanceof ApiErrorException) {
      status = exception.getStatus();
      code = exception.code;
      message = (exception.getResponse() as { message?: string }).message ?? exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'string') {
        message = payload;
      } else if (payload && typeof payload === 'object') {
        const objectPayload = payload as {
          code?: string;
          message?: string | string[];
          details?: unknown;
          error?: string;
        };

        code = objectPayload.code ?? defaultErrorCode(status);
        message = Array.isArray(objectPayload.message)
          ? objectPayload.message.join('; ')
          : (objectPayload.message ?? objectPayload.error ?? message);
        details = objectPayload.details ?? null;
      } else {
        message = exception.message;
      }

      if (code === 'internal_error') {
        code = defaultErrorCode(status);
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR && this.logger) {
      this.logger.error('http_request_exception', {
        request_id: requestId,
        method: request.method ?? 'UNKNOWN',
        path: request.originalUrl ?? request.url ?? 'unknown',
        status_code: status,
        error_name: exception instanceof Error ? exception.name : 'UnknownError',
        error_message: message,
        ...(process.env.NODE_ENV !== 'production' && exception instanceof Error && exception.stack
          ? { error_stack: exception.stack }
          : {}),
      });
    }

    response.status(status).json({
      error: {
        code,
        message,
        details,
        request_id: requestId,
      },
    });
  }
}
