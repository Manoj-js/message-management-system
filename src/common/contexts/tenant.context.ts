import { Injectable, Scope, Logger } from '@nestjs/common';

/**
 * Service responsible for managing tenant context within a request scope
 *
 * This service maintains the current tenant ID for the duration of a request
 * and provides methods to set and retrieve the tenant context.
 *
 * @remarks
 * This service uses REQUEST scope to ensure each HTTP request gets its own
 * instance, preventing tenant context leakage between concurrent requests
 */
@Injectable({ scope: Scope.REQUEST })
export class TenantContext {
  private readonly logger = new Logger(TenantContext.name);
  private tenantId: string | undefined;

  /**
   * Sets the current tenant ID for this request context
   *
   * @param tenantId - The ID of the tenant to set as current
   */
  setCurrentTenant(tenantId: string): void {
    this.logger.debug(`Setting current tenant ID to: ${tenantId}`);
    this.tenantId = tenantId;
    this.logger.log(`Current tenant context set to: ${tenantId}`);
  }

  /**
   * Retrieves the current tenant ID from the context
   *
   * @returns The current tenant ID
   * @throws Error if tenant ID has not been set in this context
   */
  getCurrentTenant(): string {
    if (!this.tenantId) {
      this.logger.error('Attempted to access tenant ID before it was set');
      throw new Error('Tenant ID not set in context');
    }
    this.logger.debug(`Retrieved current tenant ID: ${this.tenantId}`);
    return this.tenantId;
  }

  /**
   * Checks if a tenant ID is set in the current context
   *
   * @returns Boolean indicating whether a tenant ID is set
   */
  hasTenant(): boolean {
    const hasTenant = !!this.tenantId;
    this.logger.debug(
      `Tenant context check: ${hasTenant ? 'Tenant is set' : 'No tenant set'}`,
    );
    return hasTenant;
  }

  /**
   * Clears the current tenant ID from the context
   */
  clearTenant(): void {
    if (this.tenantId) {
      this.logger.debug(`Clearing tenant ID: ${this.tenantId}`);
      this.tenantId = undefined;
      this.logger.log('Tenant context cleared');
    }
  }
}
