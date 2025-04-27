import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { SearchApplicationService } from './search-application.service';
import { ElasticSearchService } from '../../shared/elasticsearch/elasticsearch.service';
import { TenantContext } from '../../common/contexts/tenant.context';
import { Cache } from 'cache-manager';
import { Logger } from '@nestjs/common';
import { PaginatedResponseDto } from '../../common/dto/pagination-response.dto';
import { Message } from '../../message/entities/message.entity';

describe('SearchApplicationService', () => {
  let service: SearchApplicationService;
  let elasticSearchService: jest.Mocked<ElasticSearchService>;
  let tenantContext: jest.Mocked<TenantContext>;
  let cacheManager: jest.Mocked<Cache>;

  // Mock data
  const mockTenantId = 'tenant-123';
  const mockConversationId = 'conversation-456';
  const mockSearchTerm = 'test query';
  const mockPaginationOptions = { page: 1, limit: 10 };

  const mockMessageResults: any[] = [
    {
      id: 'msg-1',
      conversationId: mockConversationId,
      senderId: 'user-1',
      content: 'This is a test message',
      timestamp: new Date(),
      tenantId: mockTenantId,
      metadata: { important: true },
    },
    {
      id: 'msg-2',
      conversationId: mockConversationId,
      senderId: 'user-2',
      content: 'Another test message',
      timestamp: new Date(),
      tenantId: mockTenantId,
      metadata: { important: false },
    },
  ];

  const mockPaginatedResponse: PaginatedResponseDto<Message> = {
    data: mockMessageResults,
    pagination: {
      totalItems: 2,
      page: 1,
      limit: 10,
      totalPages: 1,
    },
  };

  beforeEach(async () => {
    // Create mocks
    const elasticSearchServiceMock = {
      searchMessages: jest.fn(),
    };

    const tenantContextMock = {
      getCurrentTenant: jest.fn(),
    };

    const cacheManagerMock = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    // Setup testing module
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchApplicationService,
        {
          provide: ElasticSearchService,
          useValue: elasticSearchServiceMock,
        },
        {
          provide: TenantContext,
          useValue: tenantContextMock,
        },
        {
          provide: CACHE_MANAGER,
          useValue: cacheManagerMock,
        },
      ],
    }).compile();

    // Silence the logger during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    // Get service and mocked dependencies
    service = module.get<SearchApplicationService>(SearchApplicationService);
    elasticSearchService = module.get(ElasticSearchService);
    tenantContext = module.get(TenantContext);
    cacheManager = module.get(CACHE_MANAGER);

    // Setup common mock returns
    tenantContext.getCurrentTenant.mockReturnValue(mockTenantId);
    elasticSearchService.searchMessages.mockResolvedValue(
      mockPaginatedResponse,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchMessages', () => {
    it('should return cached results when available', async () => {
      // Arrange
      const cachedResponse = { ...mockPaginatedResponse };
      cacheManager.get.mockResolvedValueOnce(cachedResponse);

      // Act
      const result = await service.searchMessages(
        mockConversationId,
        mockSearchTerm,
        mockPaginationOptions,
      );

      // Assert
      expect(result).toBe(cachedResponse);
      expect(cacheManager.get).toHaveBeenCalledTimes(1);
      expect(elasticSearchService.searchMessages).not.toHaveBeenCalled();
      expect(cacheManager.set).not.toHaveBeenCalled();
    });

    it('should query Elasticsearch and cache results when cache miss', async () => {
      // Arrange
      cacheManager.get.mockResolvedValueOnce(null);

      // Act
      const result = await service.searchMessages(
        mockConversationId,
        mockSearchTerm,
        mockPaginationOptions,
      );

      // Assert
      expect(result).toEqual(mockPaginatedResponse);
      expect(cacheManager.get).toHaveBeenCalledTimes(1);
      expect(elasticSearchService.searchMessages).toHaveBeenCalledWith(
        mockConversationId,
        mockTenantId,
        mockSearchTerm,
        mockPaginationOptions,
      );
      expect(cacheManager.set).toHaveBeenCalledTimes(1);
    });

    it('should handle cache get errors gracefully', async () => {
      // Arrange
      const cacheError = new Error('Cache connection error');
      cacheManager.get.mockRejectedValueOnce(cacheError);

      // Act
      const result = await service.searchMessages(
        mockConversationId,
        mockSearchTerm,
        mockPaginationOptions,
      );

      // Assert
      expect(result).toEqual(mockPaginatedResponse);
      expect(elasticSearchService.searchMessages).toHaveBeenCalledTimes(1);
    });

    it('should handle cache set errors gracefully', async () => {
      // Arrange
      cacheManager.get.mockResolvedValueOnce(null);
      const cacheError = new Error('Cache write error');
      cacheManager.set.mockRejectedValueOnce(cacheError);

      // Act
      const result = await service.searchMessages(
        mockConversationId,
        mockSearchTerm,
        mockPaginationOptions,
      );

      // Assert
      expect(result).toEqual(mockPaginatedResponse);
      expect(elasticSearchService.searchMessages).toHaveBeenCalledTimes(1);
      // Service should continue despite cache error
    });

    it('should normalize search terms for cache keys', async () => {
      // Arrange
      cacheManager.get.mockResolvedValueOnce(null);
      const messySearchTerm = '  Test   QUERY  ';

      // Act
      await service.searchMessages(
        mockConversationId,
        messySearchTerm,
        mockPaginationOptions,
      );

      // Assert - check that the cache key creation normalizes the search term
      expect(cacheManager.get).toHaveBeenCalledWith(
        expect.stringContaining('test query'),
      );
      expect(cacheManager.get).not.toHaveBeenCalledWith(
        expect.stringContaining('  Test   QUERY  '),
      );
    });

    it('should handle invalid pagination values', async () => {
      // Arrange
      cacheManager.get.mockResolvedValueOnce(null);
      const invalidOptions = { page: -1, limit: 0 };

      // Act
      await service.searchMessages(
        mockConversationId,
        mockSearchTerm,
        invalidOptions,
      );

      // Assert - check that values were corrected before passing to search service
      expect(elasticSearchService.searchMessages).toHaveBeenCalledWith(
        mockConversationId,
        mockTenantId,
        mockSearchTerm,
        { page: 1, limit: 10 },
      );
    });
  });

  describe('notifyContentChanged', () => {
    it('should invalidate cache for the conversation', async () => {
      // Act
      await service.notifyContentChanged(mockConversationId);

      // Assert
      expect(tenantContext.getCurrentTenant).toHaveBeenCalled();
      expect(cacheManager.del).toHaveBeenCalled();
    });

    it('should handle cache invalidation errors gracefully', async () => {
      // Arrange
      const cacheError = new Error('Cache delete error');
      cacheManager.del.mockRejectedValueOnce(cacheError);

      // Act & Assert - should not throw
      await expect(
        service.notifyContentChanged(mockConversationId),
      ).resolves.not.toThrow();
    });
  });

  describe('invalidateSearchCache', () => {
    it('should delete the empty search cache key', async () => {
      // Act
      await service['invalidateSearchCache'](mockConversationId, mockTenantId);

      // Assert - check that at least the empty search is invalidated
      expect(cacheManager.del).toHaveBeenCalledWith(
        expect.stringContaining(`${mockTenantId}:${mockConversationId}::1:10`),
      );
    });
  });

  describe('getSearchCacheKey', () => {
    it('should create consistent cache keys', () => {
      // Act
      const key1 = service['getSearchCacheKey'](
        mockConversationId,
        mockTenantId,
        'test query',
        1,
        10,
      );

      const key2 = service['getSearchCacheKey'](
        mockConversationId,
        mockTenantId,
        '  test    query  ',
        1,
        10,
      );

      // Assert - both should normalize to the same key
      expect(key1).toEqual(key2);
    });
  });
});
