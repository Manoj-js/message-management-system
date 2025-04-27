import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * User information extracted from the authentication token
 */
interface AuthUser {
  /** Unique identifier for the authenticated user */
  id: string;
  /** List of roles assigned to the user */
  roles: string[];
}

/**
 * Authentication guard that validates bearer tokens in request headers
 *
 * This guard checks for the presence of a valid Bearer token in the Authorization
 * header and attaches user information to the request object when authenticated.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  /**
   * Validates the authentication token from the request header
   *
   * @param context - The execution context provided by NestJS
   * @returns True if authentication is successful, throws UnauthorizedException otherwise
   */
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    const requestPath = `${request.method} ${request.url}`;

    this.logger.debug(`Authenticating request to: ${requestPath}`);

    // Check if Authorization header exists and has Bearer scheme
    if (!authHeader) {
      this.logger.warn(
        `Authentication failed: Missing authorization header for ${requestPath}`,
      );
      throw new UnauthorizedException('Missing authentication token');
    }

    if (!authHeader.startsWith('Bearer ')) {
      this.logger.warn(
        `Authentication failed: Invalid token format for ${requestPath}`,
      );
      throw new UnauthorizedException('Invalid authentication token format');
    }

    const token = authHeader.split(' ')[1];

    // Validate the token
    if (!token) {
      this.logger.warn(`Authentication failed: Empty token for ${requestPath}`);
      throw new UnauthorizedException('Empty authentication token');
    }

    if (token === 'invalid') {
      this.logger.warn(
        `Authentication failed: Invalid token provided for ${requestPath}`,
      );
      throw new UnauthorizedException('Invalid token');
    }

    // In a real application, you would validate the token here
    // For example, verify JWT signature, check expiration, etc.

    // Create user object from token claims
    const user: AuthUser = {
      id: 'user-id-from-token',
      roles: ['user'],
    };

    // Attach the user info to the request for use in controllers
    request.user = user;

    this.logger.log(
      `User ${user.id} successfully authenticated for ${requestPath}`,
    );
    this.logger.debug(`User roles: ${user.roles.join(', ')}`);

    return true;
  }
}
