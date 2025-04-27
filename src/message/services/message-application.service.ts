import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { TenantContext } from '../../common/contexts/tenant.context';
import { CreateMessageDto } from '../dto/create-message.dto';
import { UpdateMessageDto } from '../dto/update-message.dto';
import { Message } from '../entities/message.entity';
import { MessageRepository } from '../repositories/mongodb-message.repository';
import { MessageProducerService } from './message-producer.service';

/**
 * Message Application Service
 *
 * Handles business logic for message operations including creating, reading,
 * updating, and deleting messages. Manages interactions between the API layer
 * and the data layer while enforcing tenant separation.
 * Implements caching for frequently accessed data.
 */
@Injectable()
export class MessageApplicationService {
  private readonly logger = new Logger(MessageApplicationService.name);

  // Cache key prefixes for different entity types
  private readonly MESSAGE_CACHE_KEY_PREFIX = 'message:';
  private readonly CONVERSATION_MESSAGES_CACHE_KEY_PREFIX =
    'conversation-messages:';

  // Cache TTL in seconds (override default from module when needed)
  private readonly MESSAGE_CACHE_TTL = 3600; // 1 hour
  private readonly CONVERSATION_MESSAGES_CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly tenantContext: TenantContext,
    private readonly kafkaProducer: MessageProducerService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.logger.log('MessageApplicationService initialized with cache manager');
  }

  /**
   * Generate a cache key for a single message
   *
   * @param id Message ID
   * @param tenantId Tenant ID
   * @returns Formatted cache key
   */
  private getMessageCacheKey(id: string, tenantId: string): string {
    return `${this.MESSAGE_CACHE_KEY_PREFIX}${tenantId}:${id}`;
  }

  /**
   * Generate a cache key for conversation messages with pagination
   *
   * @param conversationId Conversation ID
   * @param tenantId Tenant ID
   * @param page Page number
   * @param limit Items per page
   * @param sortField Field to sort by
   * @param sortDirection Sort direction
   * @returns Formatted cache key
   */
  private getConversationMessagesCacheKey(
    conversationId: string,
    tenantId: string,
    page: number,
    limit: number,
    sortField?: string,
    sortDirection?: 'asc' | 'desc',
  ): string {
    return `${this.CONVERSATION_MESSAGES_CACHE_KEY_PREFIX}${tenantId}:${conversationId}:${page}:${limit}:${sortField || 'timestamp'}:${sortDirection || 'desc'}`;
  }

  /**
   * Invalidate cache entries related to a message
   *
   * @param id Message ID
   * @param tenantId Tenant ID
   * @param conversationId Conversation ID for related cache
   */
  private async invalidateMessageCache(
    id: string,
    tenantId: string,
    conversationId: string,
  ): Promise<void> {
    try {
      // Invalidate single message cache
      const messageCacheKey = this.getMessageCacheKey(id, tenantId);
      await this.cacheManager.del(messageCacheKey);
      this.logger.debug(`Invalidated cache for message: ${messageCacheKey}`);

      // Since Nest's Cache Manager doesn't support pattern deletion directly,
      // we'll invalidate specific conversation keys we know might be affected
      // For a production system, consider using Redis directly for pattern operations
      const conversationCacheKey = this.getConversationMessagesCacheKey(
        conversationId,
        tenantId,
        1, // Most commonly accessed first page
        10, // Default page size
      );
      await this.cacheManager.del(conversationCacheKey);
      this.logger.debug(`Invalidated cache key: ${conversationCacheKey}`);
    } catch (error) {
      this.logger.warn(
        `Cache invalidation error: ${error.message}`,
        error.stack,
      );
      // Continue execution even if cache operations fail
    }
  }

  /**
   * Create a new message
   *
   * @param createMessageDto DTO containing message creation data
   * @returns Promise resolving to the created Message entity
   */
  async createMessage(createMessageDto: CreateMessageDto): Promise<Message> {
    const tenantId = this.tenantContext.getCurrentTenant();
    this.logger.debug(`Creating message for tenant: ${tenantId}`);

    // Create a new message entity
    const message = Message.create({
      id: uuidv4(),
      conversationId: createMessageDto.conversationId,
      senderId: createMessageDto.senderId,
      content: createMessageDto.content,
      tenantId,
      metadata: createMessageDto.metadata,
    });

    // Save to repository
    const savedMessage = await this.messageRepository.save(message);

    try {
      // Cache the new message
      const messageCacheKey = this.getMessageCacheKey(
        savedMessage.id,
        tenantId,
      );
      await this.cacheManager.set(
        messageCacheKey,
        savedMessage,
        this.MESSAGE_CACHE_TTL * 1000, // NestJS Cache Manager expects milliseconds
      );
      this.logger.debug(`Cached message: ${messageCacheKey}`);

      // Invalidate conversation cache since we've added a new message
      const conversationCacheKey = this.getConversationMessagesCacheKey(
        message.conversationId,
        tenantId,
        1, // First page is most commonly accessed
        10, // Default page size
      );
      await this.cacheManager.del(conversationCacheKey);
      this.logger.debug(
        `Invalidated conversation cache: ${conversationCacheKey}`,
      );
    } catch (error) {
      this.logger.warn(`Cache operation error: ${error.message}`, error.stack);
      // Continue execution even if cache operations fail
    }

    // Publish event to Kafka
    try {
      await this.kafkaProducer.publishMessageCreated(savedMessage);
      this.logger.debug(
        `Published message.created event for message ID: ${savedMessage.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish message.created event: ${error.message}`,
        error.stack,
      );
      // We continue execution as the message is already saved to the database
    }

    this.logger.log(`Created message with ID: ${savedMessage.id}`);
    return savedMessage;
  }

  /**
   * Get a message by its ID
   *
   * @param id The unique identifier of the message
   * @returns Promise resolving to the Message entity or null if not found
   */
  async getMessageById(id: string): Promise<Message | null> {
    const tenantId = this.tenantContext.getCurrentTenant();
    this.logger.debug(`Retrieving message ID: ${id} for tenant: ${tenantId}`);

    try {
      // Try to get from cache first
      const cacheKey = this.getMessageCacheKey(id, tenantId);
      const cachedMessage = await this.cacheManager.get<Message>(cacheKey);

      if (cachedMessage) {
        this.logger.debug(`Cache hit for message ID: ${id}`);
        return cachedMessage;
      }

      this.logger.debug(
        `Cache miss for message ID: ${id}, fetching from repository`,
      );
    } catch (error) {
      this.logger.warn(`Cache read error: ${error.message}`, error.stack);
      // Continue to repository on cache error
    }

    // Not in cache, get from repository
    const message = await this.messageRepository.findById(id, tenantId);

    if (!message) {
      this.logger.warn(
        `Message with ID: ${id} not found for tenant: ${tenantId}`,
      );
      return null;
    }

    try {
      // Cache the message for future requests
      const cacheKey = this.getMessageCacheKey(id, tenantId);
      await this.cacheManager.set(
        cacheKey,
        message,
        this.MESSAGE_CACHE_TTL * 1000, // NestJS Cache Manager expects milliseconds
      );
      this.logger.debug(`Cached message ID: ${id}`);
    } catch (error) {
      this.logger.warn(`Cache write error: ${error.message}`, error.stack);
      // Continue execution even if cache operations fail
    }

    this.logger.log(`Retrieved message with ID: ${id}`);
    return message;
  }

  /**
   * Update an existing message
   *
   * @param id The unique identifier of the message to update
   * @param updateMessageDto DTO containing message update data
   * @returns Promise resolving to the updated Message entity or null if not found
   */
  async updateMessage(
    id: string,
    updateMessageDto: UpdateMessageDto,
  ): Promise<Message | null> {
    const tenantId = this.tenantContext.getCurrentTenant();
    this.logger.debug(`Updating message ID: ${id} for tenant: ${tenantId}`);

    // First check if message exists
    const existingMessage = await this.messageRepository.findById(id, tenantId);
    if (!existingMessage) {
      this.logger.warn(
        `Message with ID: ${id} not found for tenant: ${tenantId}`,
      );
      return null;
    }

    // Update message properties
    if (updateMessageDto.content) {
      existingMessage.updateContent(updateMessageDto.content);
    }

    if (updateMessageDto.metadata) {
      existingMessage.updateMetadata(updateMessageDto.metadata);
    }

    // Save updated message
    const updatedMessage = await this.messageRepository.update(existingMessage);

    try {
      // Invalidate caches
      await this.invalidateMessageCache(
        id,
        tenantId,
        updatedMessage.conversationId,
      );

      // Update cache with new data
      const messageCacheKey = this.getMessageCacheKey(id, tenantId);
      await this.cacheManager.set(
        messageCacheKey,
        updatedMessage,
        this.MESSAGE_CACHE_TTL * 1000, // NestJS Cache Manager expects milliseconds
      );
      this.logger.debug(`Updated cache for message ID: ${id}`);
    } catch (error) {
      this.logger.warn(`Cache operation error: ${error.message}`, error.stack);
      // Continue execution even if cache operations fail
    }

    // Publish event to Kafka
    try {
      await this.kafkaProducer.publishMessageUpdated(updatedMessage);
      this.logger.debug(
        `Published message.updated event for message ID: ${id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish message.updated event: ${error.message}`,
        error.stack,
      );
      // We continue execution as the message is already updated in the database
    }

    this.logger.log(`Updated message with ID: ${id}`);
    return updatedMessage;
  }

  /**
   * Delete a message by its ID
   *
   * @param id The unique identifier of the message to delete
   * @returns Promise resolving to a boolean indicating success
   */
  async deleteMessage(id: string): Promise<boolean> {
    const tenantId = this.tenantContext.getCurrentTenant();
    this.logger.debug(`Deleting message ID: ${id} for tenant: ${tenantId}`);

    // First check if message exists
    const existingMessage = await this.messageRepository.findById(id, tenantId);
    if (!existingMessage) {
      this.logger.warn(
        `Message with ID: ${id} not found for tenant: ${tenantId}`,
      );
      return false;
    }

    // Get conversation ID for cache invalidation
    const conversationId = existingMessage.conversationId;

    // Delete message
    await this.messageRepository.delete(id, tenantId);

    try {
      // Invalidate caches
      await this.invalidateMessageCache(id, tenantId, conversationId);
    } catch (error) {
      this.logger.warn(
        `Cache invalidation error: ${error.message}`,
        error.stack,
      );
      // Continue execution even if cache operations fail
    }

    // Publish event to Kafka
    try {
      await this.kafkaProducer.publishMessageDeleted({
        id,
        conversationId,
        tenantId,
      });
      this.logger.debug(
        `Published message.deleted event for message ID: ${id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish message.deleted event: ${error.message}`,
        error.stack,
      );
      // We continue execution as the message is already deleted from the database
    }

    this.logger.log(`Deleted message with ID: ${id}`);
    return true;
  }

  /**
   * Get messages for a specific conversation with pagination
   *
   * @param conversationId The unique identifier of the conversation
   * @param options Pagination and sorting options
   * @returns Promise resolving to paginated message results
   */
  async getMessagesByConversation(
    conversationId: string,
    options: {
      page: number;
      limit: number;
      sort?: { field: string; direction: 'asc' | 'desc' };
    },
  ): Promise<{ messages: Message[]; total: number }> {
    const tenantId = this.tenantContext.getCurrentTenant();

    this.logger.debug(
      `Finding messages for conversation: ${conversationId}, tenant: ${tenantId}, page: ${options.page}, limit: ${options.limit}`,
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
      const cacheKey = this.getConversationMessagesCacheKey(
        conversationId,
        tenantId,
        options.page,
        options.limit,
        options.sort?.field,
        options.sort?.direction,
      );

      const cachedResult = await this.cacheManager.get<{
        messages: Message[];
        total: number;
      }>(cacheKey);

      if (cachedResult) {
        this.logger.debug(`Cache hit for conversation messages: ${cacheKey}`);
        return cachedResult;
      }

      this.logger.debug(
        `Cache miss for conversation messages: ${cacheKey}, fetching from repository`,
      );
    } catch (error) {
      this.logger.warn(`Cache read error: ${error.message}`, error.stack);
      // Continue to repository on cache error
    }

    // Get messages from repository with pagination
    const result = await this.messageRepository.findByConversationId(
      conversationId,
      tenantId,
      options,
    );

    try {
      // Cache the result
      const cacheKey = this.getConversationMessagesCacheKey(
        conversationId,
        tenantId,
        options.page,
        options.limit,
        options.sort?.field,
        options.sort?.direction,
      );

      await this.cacheManager.set(
        cacheKey,
        result,
        this.CONVERSATION_MESSAGES_CACHE_TTL * 1000, // NestJS Cache Manager expects milliseconds
      );
      this.logger.debug(`Cached conversation messages: ${cacheKey}`);
    } catch (error) {
      this.logger.warn(`Cache write error: ${error.message}`, error.stack);
      // Continue execution even if cache operations fail
    }

    this.logger.log(
      `Retrieved ${result.messages.length} messages for conversation: ${conversationId} (total: ${result.total})`,
    );

    return result;
  }
}
