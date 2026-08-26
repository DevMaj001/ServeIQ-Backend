import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { randomUUID } from 'crypto';
import { OptimisticLockVersionMismatchError } from 'typeorm';

interface ExceptionResponseBody {
  message?: string | string[];
  error?: string;
  statusCode?: number;
  code?: string;
}

interface ErrorMetadata {
  status: number;
  code: string;
  clientMessage: string;
}

/**
 * Maps well-known database driver violations to safe, specific responses so
 * clients get an actionable message instead of a blanket 500. Schema-drift
 * errors (missing table/column) stay 500 but are logged loudly.
 */
const DB_ERROR_META: Record<string, ErrorMetadata> = {
  '23505': {
    status: 409,
    code: 'DUPLICATE_RESOURCE',
    clientMessage: 'A record with the same unique value already exists',
  },
  '23503': {
    status: 409,
    code: 'CONFLICT',
    clientMessage: 'This operation conflicts with existing related data',
  },
  '23502': {
    status: 400,
    code: 'VALIDATION_ERROR',
    clientMessage: 'A required field is missing',
  },
  '22P02': {
    status: 400,
    code: 'INVALID_INPUT',
    clientMessage: 'Input has an invalid format',
  },
  '42P01': {
    status: 500,
    code: 'INTERNAL_ERROR',
    clientMessage: 'A server data error occurred',
  },
  '42703': {
    status: 500,
    code: 'INTERNAL_ERROR',
    clientMessage: 'Server query references unavailable data',
  },
};

const isProduction = () => process.env.NODE_ENV === 'production';

function extractDbCode(exception: unknown): string | undefined {
  if (!exception || typeof exception !== 'object') return undefined;
  const e = exception as Record<string, unknown>;
  const direct = e.code;
  if (typeof direct === 'string' && /^[0-9A-Z]{5}$/.test(direct)) {
    return direct;
  }
  const driverError = e.driverError ?? e.original;
  if (
    driverError &&
    typeof driverError === 'object' &&
    typeof (driverError as Record<string, unknown>).code === 'string'
  ) {
    return (driverError as Record<string, unknown>).code as string;
  }
  return undefined;
}

function isHttpExceptionWithBody(
  exception: unknown,
): exception is HttpException {
  return (
    exception instanceof HttpException &&
    typeof exception.getResponse() === 'object' &&
    exception.getResponse() !== null
  );
}

function normalizeMessages(message: unknown): string[] {
  if (Array.isArray(message)) {
    return message.map((m) => String(m));
  }
  if (typeof message === 'string') {
    return [message];
  }
  if (typeof message === 'object' && message !== null) {
    const body = message as ExceptionResponseBody;
    if (Array.isArray(body.message)) {
      return body.message.map((m) => String(m));
    }
    if (typeof body.message === 'string') {
      return [body.message];
    }
    if (typeof body.error === 'string') {
      return [body.error];
    }
  }
  return [];
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { method?: string; url?: string }>();

    const requestId = randomUUID();
    const path = request.url ?? 'unknown';
    const method = request.method ?? 'GET';

    let status: number;
    let code = 'INTERNAL_ERROR';
    let message: string[] = [];

    if (isHttpExceptionWithBody(exception)) {
      const body = exception.getResponse() as ExceptionResponseBody;
      status = exception.getStatus();
      code = typeof body.code === 'string' ? body.code : defaultCode(status);
      message = normalizeMessages(body.message).length
        ? normalizeMessages(body.message)
        : [defaultMessage(status)];
    } else if (exception instanceof OptimisticLockVersionMismatchError) {
      status = HttpStatus.CONFLICT;
      code = 'VERSION_CONFLICT';
      message = ['This record was modified by another request. Please reload and try again.'];
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = [defaultMessage(status)];
    } else {
      const dbCode = extractDbCode(exception);
      const meta = dbCode ? DB_ERROR_META[dbCode] : undefined;
      if (meta) {
        status = meta.status;
        code = meta.code;
        message = [meta.clientMessage];
      } else {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        code = 'INTERNAL_ERROR';
        message = ['Internal server error'];
      }
    }

    const errorInfo =
      exception instanceof Error
        ? {
            name: exception.name,
            message: exception.message,
            ...(isProduction()
              ? {}
              : { stack: this.sanitizeStack(exception.stack) }),
            ...(status >= 500 ? { code, status, path, method } : {}),
          }
        : { value: exception };

    if (status >= 500) {
      this.logger.error(
        `[${code}] ${status} ${method} ${path} - ${isProduction() ? 'see stack' : 'see above'}`,
        errorInfo,
      );
    } else if (status === 401 || status === 403 || status >= 422) {
      this.logger.warn(`[${code}] ${status} ${method} ${path}`, errorInfo);
    }

    response.status(status).json({
      success: false,
      data: null,
      meta: {
        statusCode: status,
        code,
        message,
        timestamp: new Date().toISOString(),
        path,
        method,
        requestId,
      },
    });
  }

  private sanitizeStack(stack?: string): string | undefined {
    if (!stack) return undefined;
    if (isProduction()) return undefined;
    return stack.split('\n').slice(0, 12).join('\n');
  }
}

function defaultCode(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'VALIDATION_ERROR';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'RATE_LIMITED';
    default:
      return 'INTERNAL_ERROR';
  }
}

function defaultMessage(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'Invalid request';
    case HttpStatus.UNAUTHORIZED:
      return 'Unauthorized';
    case HttpStatus.FORBIDDEN:
      return 'Forbidden';
    case HttpStatus.NOT_FOUND:
      return 'Resource not found';
    case HttpStatus.CONFLICT:
      return 'Conflict';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'Too many requests';
    default:
      return 'Internal server error';
  }
}