import { Message } from '../entities/message.entity';

/**
 * Message Repository Interface
 *
 * Defines the contract for message repositories, allowing for different
 * implementations (MongoDB, PostgreSQL, etc.) while maintaining consistent
 * behavior across the application.
 */
export interface IMessageRepository {
  /**
   * Save a new message
   *
   * @param message The message entity to save
   * @returns Promise resolving to the saved message entity
   */
  save(message: Message): Promise<Message>;

  /**
   * Find a message by its ID and tenant
   *
   * @param id The unique identifier of the message
   * @param tenantId The tenant identifier for multi-tenancy
   * @returns Promise resolving to the message entity or null if not found
   */
  findById(id: string, tenantId: string): Promise<Message | null>;

  /**
   * Update an existing message
   *
   * @param message The message entity with updated values
   * @returns Promise resolving to the updated message entity
   */
  update(message: Message): Promise<Message>;

  /**
   * Delete a message by its ID and tenant
   *
   * @param id The unique identifier of the message to delete
   * @param tenantId The tenant identifier for multi-tenancy
   * @returns Promise resolving when the message is deleted
   */
  delete(id: string, tenantId: string): Promise<void>;

  /**
   * Find messages by conversation ID with pagination and sorting
   *
   * @param conversationId The unique identifier of the conversation
   * @param tenantId The tenant identifier for multi-tenancy
   * @param options Pagination and sorting options
   * @returns Promise resolving to paginated message results
   */
  findByConversationId(
    conversationId: string,
    tenantId: string,
    options: {
      page: number;
      limit: number;
      sort?: { field: string; direction: 'asc' | 'desc' };
    },
  ): Promise<{ messages: Message[]; total: number }>;
}
