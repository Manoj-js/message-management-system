import {
  Injectable,
  NestMiddleware,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantContext } from '../contexts/tenant.context';

/**
 * Middleware for handling multi-tenancy in the application
 *
 * Extracts the tenant ID from request headers and sets it in the tenant context
 * for use throughout the request lifecycle.
 *
 * @remarks
 * This middleware requires the 'x-tenant-id' header to be present in all requests.
 * Requests without this header will be rejected with a BadRequestException.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  /**
   * Creates an instance of TenantMiddleware
   *
   * @param tenantContext - The request-scoped tenant context service
   */
  constructor(private readonly tenantContext: TenantContext) {}

  /**
   * Processes the HTTP request and extracts tenant information
   *
   * @param req - The Express request object
   * @param res - The Express response object
   * @param next - Function to pass control to the next middleware
   * @throws BadRequestException if tenant ID is missing from headers
   */
  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl } = req;
    const tenantId = req.headers['x-tenant-id'] as string;
    const correlationId = (req.headers['x-correlation-id'] as string) || '-';

    this.logger.debug(
      `Processing tenant context for ${method} ${originalUrl}`,
      // { correlationId }, For Future Tracing
    );

    // Validate tenant ID presence
    if (!tenantId) {
      this.logger.warn(
        `Missing tenant ID in request to ${method} ${originalUrl}`,
        { correlationId },
      );
      throw new ForbiddenException(
        'Tenant ID is required in x-tenant-id header',
      );
    }

    // Set tenant ID in the request-scoped context
    try {
      this.tenantContext.setCurrentTenant(tenantId);
      this.logger.debug(
        `Tenant context set to '${tenantId}' for ${method} ${originalUrl}`,
        // { correlationId }, For Future Tracing
      );

      // Add a response hook to log when the request completes
      res.on('finish', () => {
        this.logger.debug(
          `Completed request for tenant '${tenantId}': ${method} ${originalUrl} (${res.statusCode})`,
          // { correlationId }, For Future Tracing
        );
      });

      next();
    } catch (error) {
      this.logger.error(
        `Error setting tenant context: ${error.message}`,
        error.stack,
        // { correlationId }, For Future Tracing
      );
      throw error;
    }
  }
}
