import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status: number;
    let message: string;
    let code: number;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();
      message =
        typeof exResponse === 'string'
          ? exResponse
          : (exResponse as any).message || exception.message;

      // Map HTTP status to business error codes
      switch (status) {
        case HttpStatus.UNAUTHORIZED:
          code = 401;
          break;
        case HttpStatus.FORBIDDEN:
          code = 403;
          break;
        case HttpStatus.NOT_FOUND:
          code = 404;
          break;
        case HttpStatus.BAD_REQUEST:
          code = 400;
          break;
        case HttpStatus.CONFLICT:
          code = 409;
          break;
        default:
          code = status;
      }

      // Handle validation errors (array of messages)
      if (Array.isArray(message)) {
        message = message.join('; ');
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 500;
      message = 'Internal server error';
      this.logger.error('Unhandled exception', exception);
    }

    response.status(status).json({
      code,
      data: null,
      message,
    });
  }
}
