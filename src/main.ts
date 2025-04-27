import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformInterceptor } from './common/interceptor/transform.interceptor';
import { json, urlencoded } from 'express';

/**
 * Bootstraps the NestJS application.
 *
 * Sets up global middleware, validation pipes, exception filters, Swagger documentation,
 * CORS configuration, and starts the HTTP server.
 *
 * Key Features:
 * - Global error handling with custom exception filters
 * - Response transformation interceptor
 * - Validation and request sanitization
 * - API Versioning via URI
 * - Swagger documentation with JWT and Tenant-ID integration
 * - Configurable payload size limits for JSON and URL-encoded bodies
 * - CORS enabled
 */
async function bootstrap() {
  // Create the application instance
  const app = await NestFactory.create(AppModule);

  // Load application configuration
  const configService = app.get(ConfigService);

  /**
   * GLOBAL MIDDLEWARES & SETTINGS
   */

  // Global error handling
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global response interceptor
  app.useGlobalInterceptors(new TransformInterceptor());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // Auto-transform payloads to DTO instances
      whitelist: true, // Strip unknown properties
      forbidNonWhitelisted: true, // Throw error if unknown properties exist
    }),
  );

  // API Versioning (URI based, e.g., /v1/endpoint)
  app.enableVersioning({
    type: VersioningType.URI,
  });

  // Increase payload size limits
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '2mb' }));

  /**
   * SWAGGER DOCUMENTATION
   */
  const options = new DocumentBuilder()
    .setTitle('Message Management API')
    .setDescription('RESTful APIs for message management')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-tenant-id',
        in: 'header',
        description: 'Tenant identifier - REQUIRED for all API calls',
      },
      'tenant-id',
    )
    .build();

  const document = SwaggerModule.createDocument(app, options);

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Persist JWT/tenant token between requests
      tagsSorter: 'alpha', // Sort tags alphabetically
      operationsSorter: 'alpha', // Sort operations alphabetically
      docExpansion: 'list', // Collapse all routes initially
      filter: true, // Allow filtering of routes
      displayRequestDuration: true, // Show request durations
      tryItOutEnabled: true, // Enable 'Try it out' button by default
      defaultModelsExpandDepth: -1, // Hide models section by default
      defaultModelExpandDepth: 3, // Expand model properties up to depth 3
    },
  });

  /**
   * CORS SETUP
   */
  app.enableCors();

  /**
   * SERVER STARTUP
   */
  const port = configService.get<number>('port', 3000);
  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 Swagger documentation: http://localhost:${port}/api/docs`);
}

bootstrap();
