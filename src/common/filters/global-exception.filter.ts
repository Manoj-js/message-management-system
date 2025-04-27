import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Standard error response structure returned by the API
 */
interface ErrorResponse {
  /** HTTP status code */
  status: number;
  /** Error message or messages */
  message: string | string[];
  /** Error type */
  error: string;
  /** Timestamp when the error occurred */
  timestamp: string;
  /** Request URL path */
  path: string;
  /** Optional correlation ID for request tracing */
  correlationId?: string;
}

/**
 * Global exception filter that catches all unhandled exceptions in the application
 *
 * This filter normalizes different exception types into a consistent error response
 * format and ensures proper logging of all exceptions.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  /**
   * Catches and processes all exceptions thrown within the application
   *
   * @param exception - The caught exception object
   * @param host - ArgumentsHost object provided by NestJS
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = request.headers['x-correlation-id'] as string;

    let status: number;
    let message: string | string[];
    let error: string;

    this.logger.debug(
      `Processing exception for request to ${request.method} ${request.url}`,
    );

    // Handle different exception types
    if (exception instanceof HttpException) {
      // Known HTTP exceptions thrown by NestJS or the application
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || exception.message;
        error = (exceptionResponse as any).error || 'Error';
      } else {
        message = exception.message;
        error = 'Error';
      }

      // Only log 5xx errors as errors, 4xx as warnings/info
      if (status >= 500) {
        this.logger.error(
          `HTTP exception ${status}: ${message}`,
          exception.stack,
        );
      } else if (status >= 400) {
        this.logger.warn(
          `HTTP exception ${status}: ${message} at ${request.method} ${request.url}`,
        );
      }
    } else if (exception instanceof Error) {
      // Unhandled JavaScript errors
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = exception.message;
      error = exception.name;

      this.logger.error(
        `Unhandled exception: ${exception.message} at ${request.method} ${request.url}`,
        exception.stack,
        { correlationId },
      );
    } else {
      // Unknown exception types (not Error objects)
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      error = 'Error';

      this.logger.error(
        `Unknown exception at ${request.method} ${request.url}: ${JSON.stringify(exception)}`,
        null,
        { correlationId },
      );
    }

    // Construct and send the error response
    const errorResponse: ErrorResponse = {
      status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (correlationId) {
      errorResponse.correlationId = correlationId;
      this.logger.debug(
        `Adding correlation ID to error response: ${correlationId}`,
      );
    }

    this.logger.debug(
      `Sending error response: ${JSON.stringify(errorResponse)}`,
    );
    response.status(status).json(errorResponse);
  }
}
