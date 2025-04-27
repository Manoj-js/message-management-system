import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * HTTP request-response logging middleware
 *
 * Logs incoming HTTP requests and their corresponding responses
 * with relevant details for monitoring and debugging purposes.
 *
 * @remarks
 * This middleware captures request information when it begins processing
 * and response details when the response is sent to the client.
 */
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  /**
   * Logger instance for HTTP-related logs
   * @private
   */
  private logger = new Logger('HTTP');

  /**
   * Processes the HTTP request/response and logs relevant information
   *
   * @param request - The Express request object
   * @param response - The Express response object
   * @param next - Function to pass control to the next middleware
   */
  use(request: Request, response: Response, next: NextFunction): void {
    const startTime = Date.now();
    const { ip, method, originalUrl } = request;
    const userAgent = request.get('user-agent') || 'unknown';
    const correlationId =
      request.headers['x-correlation-id'] ||
      request.headers['x-request-id'] ||
      uuidv4();

    // Log request information
    this.logger.debug(
      `Request: ${method} ${originalUrl} - ${userAgent} ${ip} correlationId : ${correlationId}`,
    );

    // Only log request body in debug level and only if it exists and isn't empty
    if (request.body && Object.keys(request.body).length > 0) {
      // Avoid logging sensitive information
      const sanitizedBody = this.sanitizeRequestBody(request.body);
      this.logger.debug(
        `Request body: ${JSON.stringify(sanitizedBody)} correlationId : ${correlationId}`,
      );
    }

    // Listen for the response finish event
    response.on('finish', () => {
      const { statusCode } = response;
      const contentLength = response.get('content-length') || '0';
      const responseTime = Date.now() - startTime;

      // Log based on status code
      const logMessage = `Response: ${method} ${originalUrl} ${statusCode} ${contentLength}B ${responseTime}ms - ${userAgent} ${ip} correlationId : ${correlationId}`;

      if (statusCode >= 500) {
        this.logger.error(logMessage);
      } else if (statusCode >= 400) {
        this.logger.warn(logMessage);
      } else {
        this.logger.log(logMessage);
      }
    });

    // Pass control to the next middleware
    next();
  }

  /**
   * Sanitizes request body to prevent logging sensitive information
   *
   * @param body - The request body object
   * @returns Sanitized copy of the request body
   * @private
   */
  private sanitizeRequestBody(body: any): any {
    // Create a shallow copy to avoid modifying the original request
    const sanitized = { ...body };

    // List of sensitive fields to redact
    const sensitiveFields = [
      'password',
      'token',
      'apiKey',
      'api_key',
      'secret',
      'authorization',
      'credential',
      'userPassword',
      'user_password',
    ];

    // Redact sensitive fields
    sensitiveFields.forEach((field) => {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }
}
