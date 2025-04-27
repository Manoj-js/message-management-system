import { Module, Global } from '@nestjs/common';
import { TenantContext } from './contexts/tenant.context';

/**
 * Global module providing common services and contexts across the application
 *
 * This module is marked as @Global() so its exported providers are available
 * throughout the application without needing to import the CommonModule in each feature module.
 *
 * @remarks
 * Currently provides the TenantContext for multi-tenancy support. Additional common
 * services, providers, and utilities can be added here as the application grows.
 */
@Global()
@Module({
  providers: [TenantContext],
  exports: [TenantContext],
})
export class CommonModule {}
