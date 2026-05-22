import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

// Minimal request/response surface — keeping the framework's express types
// loose so the lib doesn't depend on @types/express directly.
interface RequestLike {
  id?: string;
  url: string;
}
interface ResponseLike {
  status(code: number): ResponseLike;
  json(body: unknown): ResponseLike;
}

interface NormalizedError {
  statusCode: number;
  error: string;
  message: string | string[];
  requestId?: string;
  path: string;
  timestamp: string;
}

// Global filter that normalizes every error response to the same JSON shape:
//
//   { statusCode, error, message, requestId, path, timestamp }
//
// Frontends can rely on `body.message` for display and `body.statusCode` for
// branching. `requestId` is the X-Request-Id set by nestjs-pino's genReqId.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<RequestLike>();
    const response = ctx.getResponse<ResponseLike>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'InternalServerError';
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
        error = exception.name;
      } else if (body && typeof body === 'object') {
        const obj = body as { message?: string | string[]; error?: string };
        message = obj.message ?? exception.message;
        error = obj.error ?? exception.name;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name;
    }

    const payload: NormalizedError = {
      statusCode,
      error,
      message,
      requestId: request.id,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    if (statusCode >= 500) {
      this.logger.error(
        { requestId: request.id, path: request.url, exception },
        `${statusCode} ${error}: ${typeof message === 'string' ? message : message.join(', ')}`,
      );
    }

    response.status(statusCode).json(payload);
  }
}
