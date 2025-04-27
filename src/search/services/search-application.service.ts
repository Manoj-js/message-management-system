import { Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { TenantContext } from '../../common/contexts/tenant.context';
import { ElasticSearchService } from '../../shared/elasticsearch/elasticsearch.service';
import { PaginatedResponseDto } from '../../common/dto/pagination-response.dto';
import { Message } from '../../message/entities/message.entity';

/**
 * Search Application Service
 *
 * Handles business logic for search operations including message search
 * with proper caching for improved performance.
 */
@Injectable()
export class SearchApplicationService {
  private readonly logger = new Logger(SearchApplicationService.name);

  // Cache key prefix for search results
  private readonly SEARCH_CACHE_KEY_PREFIX = 'search:messages:';

  // Cache TTL in seconds (override default from module when needed)
  private readonly SEARCH_CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly searchService: ElasticSearchService,
    private readonly tenantContext: TenantContext,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.logger.log('SearchApplicationService initialized with cache manager');
  }

  /**
   * Generate a cache key for search results
   *
   * @param conversationId Conversation ID
   * @param tenantId Tenant ID
   * @param searchTerm Search term
   * @param page Page number
   * @param limit Items per page
   * @returns Formatted cache key
   */
  private getSearchCacheKey(
    conversationId: string,
    tenantId: string,
    searchTerm: string,
    page: number,
    limit: number,
  ): string {
    // Normalize the search term by trimming, lowercase, and removing extra spaces
    const normalizedSearchTerm = searchTerm
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');

    return `${this.SEARCH_CACHE_KEY_PREFIX}${tenantId}:${conversationId}:${normalizedSearchTerm}:${page}:${limit}`;
  }

  /**
   * Invalidate search cache for a specific conversation
   *
   * @param conversationId Conversation ID
   * @param tenantId Tenant ID
   */
  async invalidateSearchCache(
    conversationId: string,
    tenantId: string,
  ): Promise<void> {
    try {
      // Invalidate empty search (list all) which is common
      const emptySearchKey = this.getSearchCacheKey(
        conversationId,
        tenantId,
        '',
        1,
        10,
      );
      await this.cacheManager.del(emptySearchKey);
      this.logger.debug(`Invalidated empty search cache: ${emptySearchKey}`);
    } catch (error) {
      this.logger.warn(
        `Cache invalidation error: ${error.message}`,
        error.stack,
      );
      // Continue execution even if cache operations fail
    }
  }

  /**
   * Search messages in a conversation
   *
   * @param conversationId The conversation to search within
   * @param searchTerm The search query
   * @param options Pagination options
   * @returns Promise resolving to paginated search results
   */
  async searchMessages(
    conversationId: string,
    searchTerm: string,
    options: { page: number; limit: number },
  ): Promise<PaginatedResponseDto<Message>> {
    const tenantId = this.tenantContext.getCurrentTenant();

    this.logger.debug(
      `Searching for "${searchTerm}" in conversation: ${conversationId}, tenant: ${tenantId}, page: ${options.page}, limit: ${options.limit}`,
    );

    // Input validation
    if (options.page < 1) {
      this.logger.warn(
        `Invalid page number: ${options.page}, using default page 1`,
      );
      options.page = 1;
    }

    if (options.limit < 1) {
      this.logger.warn(
        `Invalid limit: ${options.limit}, using default limit 10`,
      );
      options.limit = 10;
    }

    try {
      // Try to get from cache first
      const cacheKey = this.getSearchCacheKey(
        conversationId,
        tenantId,
        searchTerm,
        options.page,
        options.limit,
      );

      const cachedResult =
        await this.cacheManager.get<PaginatedResponseDto<Message>>(cacheKey);

      if (cachedResult) {
        this.logger.debug(`Cache hit for search: ${cacheKey}`);
        return cachedResult;
      }

      this.logger.debug(
        `Cache miss for search: ${cacheKey}, fetching from Elasticsearch`,
      );
    } catch (error) {
      this.logger.warn(`Cache read error: ${error.message}`, error.stack);
      // Continue to search service on cache error
    }

    // Perform the search in Elasticsearch
    const result = await this.searchService.searchMessages(
      conversationId,
      tenantId,
      searchTerm,
      options,
    );

    try {
      // Cache the search results
      const cacheKey = this.getSearchCacheKey(
        conversationId,
        tenantId,
        searchTerm,
        options.page,
        options.limit,
      );

      await this.cacheManager.set(
        cacheKey,
        result,
        this.SEARCH_CACHE_TTL * 1000, // NestJS Cache Manager expects milliseconds
      );
      this.logger.debug(`Cached search results: ${cacheKey}`);
    } catch (error) {
      this.logger.warn(`Cache write error: ${error.message}`, error.stack);
      // Continue execution even if cache operations fail
    }

    this.logger.log(
      `Search for "${searchTerm}" found ${result.data.length} messages in conversation: ${conversationId} (total: ${result.pagination.totalItems})`,
    );

    return result;
  }

  /**
   * Notify the search service about content changes
   * This should be called when messages are created, updated, or deleted
   * to invalidate relevant cache entries
   *
   * @param conversationId The conversation ID where changes occurred
   */
  async notifyContentChanged(conversationId: string): Promise<void> {
    const tenantId = this.tenantContext.getCurrentTenant();
    this.logger.debug(
      `Content changed notification for conversation: ${conversationId}, tenant: ${tenantId}`,
    );

    // Invalidate search cache for this conversation
    await this.invalidateSearchCache(conversationId, tenantId);
  }
}
