import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Standard API response structure
 *
 * @template T Type of the data payload
 */
export interface Response<T> {
  /**
   * HTTP status code of the response
   */
  status: number;

  /**
   * Response data payload
   */
  data: T;
}

/**
 * Interceptor that transforms response data into a standardized format
 *
 * This interceptor wraps the response data in a standard structure with status code
 * and data fields, providing consistent API responses across the application.
 *
 * @template T Type of the data being intercepted and transformed
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T> | T>
{
  private readonly logger = new Logger(TransformInterceptor.name);

  /**
   * Intercepts the response and transforms it into the standard format
   *
   * @param context - The execution context provided by NestJS
   * @param next - The next handler in the interceptor chain
   * @returns An observable of the transformed response or the original data
   */
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T> | T> {
    const request = context.switchToHttp().getRequest();
    const { method, originalUrl } = request;

    this.logger.debug(
      `Applying standard response transformation for ${originalUrl}`,
    );
    return next.handle().pipe(
      map((data) => {
        const response = context.switchToHttp().getResponse();
        const statusCode = response.statusCode;

        const transformedResponse = {
          status: statusCode,
          data,
        };

        this.logger.debug(
          `Response transformed with status ${statusCode} for ${method} ${originalUrl}`,
        );

        return transformedResponse;
      }),
    );
  }
}
