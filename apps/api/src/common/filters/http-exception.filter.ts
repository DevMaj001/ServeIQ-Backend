import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

interface ExceptionResponseBody {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const message =
      exceptionResponse && typeof exceptionResponse === 'object'
        ? (exceptionResponse as ExceptionResponseBody).message ||
          (exceptionResponse as ExceptionResponseBody).error ||
          'Internal server error'
        : 'Internal server error';
    const messageList = Array.isArray(message) ? message : [message];

    response.status(status).json({
      success: false,
      data: null,
      meta: {
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        message: messageList,
      },
    });
  }
}
