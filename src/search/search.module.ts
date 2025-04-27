import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { SearchApplicationService } from './services/search-application.service';
import { SearchController } from './controllers/search.controller';
import { ElasticSearchService } from '../shared/elasticsearch/elasticsearch.service';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';

/**
 * Search module that integrates Elasticsearch and Redis caching capabilities.
 *
 * @module SearchModule
 * @description
 * This module provides search functionality through Elasticsearch integration
 * with Redis-based caching to optimize performance. It exposes search capabilities
 * via REST endpoints and provides services for both application-specific searching
 * and generic Elasticsearch operations.
 */
@Module({
  imports: [
    /**
     * Elasticsearch client configuration using async factory pattern.
     * Retrieves connection details from application configuration.
     */
    ElasticsearchModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        node: configService.get('elasticsearch.node'),
      }),
      inject: [ConfigService],
    }),

    /**
     * Redis cache configuration using async factory pattern.
     * Sets up caching for search results to improve performance.
     */
    CacheModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisConfig = configService.get('redis');
        return {
          store: redisStore,
          host: redisConfig.host,
          port: redisConfig.port,
          password: redisConfig.password || undefined,
          ttl: redisConfig.ttl,
        };
      },
    }),
  ],

  /**
   * Controllers that expose search-related REST endpoints.
   */
  controllers: [SearchController],

  /**
   * Providers that handle search operations.
   * - ElasticSearchService: Generic Elasticsearch operations
   * - SearchApplicationService: Application-specific search functionality
   */
  providers: [ElasticSearchService, SearchApplicationService],

  /**
   * Services exported for use in other modules.
   * Makes ElasticSearchService available to other parts of the application.
   */
  exports: [ElasticSearchService],
})
export class SearchModule {}
