import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import configuration, { validationSchema } from './config/configuration';
import { CommonModule } from './common/common.module';
import { MessageModule } from './message/message.module';
import { ElasticConsumerModule } from './elastic-consumer/elastic-consumer.module';
import { SearchModule } from './search/search.module';
import { SharedModule } from './shared/shared.module';

import { TenantMiddleware } from './common/middlewares/tenant.middleware';
import { LoggerMiddleware } from './common/middlewares/logger.middleware';
import { AuthGuard } from './common/guards/auth.guard';

/**
 * Root Application Module
 *
 * Loads environment configurations, database connections, global middlewares,
 * guards, and core feature modules like messaging, search, etc.
 */
@Module({
  imports: [
    // Global Config Module
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: { abortEarly: false },
    }),

    // MongoDB connection
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('mongodb.uri'),
      }),
      inject: [ConfigService],
    }),

    // Throttling setup
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60, // 60 seconds
          limit: 1000,
        },
      ],
    }),

    // Feature modules
    CommonModule,
    MessageModule,
    ElasticConsumerModule,
    SearchModule,
    SharedModule,
  ],
  providers: [
    // Global Guards
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware, LoggerMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
