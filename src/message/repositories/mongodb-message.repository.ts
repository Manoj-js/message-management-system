import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message } from '../entities/message.entity';
import { IMessageRepository } from './message.repository.interface';
import { MessageModel, MessageDocument } from '../schemas/message.schema';

/**
 * MongoDB implementation of the Message Repository
 *
 * Handles persistence operations for messages in MongoDB,
 * implementing the IMessageRepository interface for domain consistency.
 */
@Injectable()
export class MessageRepository implements IMessageRepository {
  private readonly logger = new Logger(MessageRepository.name);

  constructor(
    @InjectModel(MessageModel.name)
    private messageModel: Model<MessageDocument>,
  ) {
    this.logger.log('MessageRepository initialized');
  }

  /**
   * Save a new message to the database
   *
   * @param message The message entity to save
   * @returns Promise resolving to the saved message entity
   */
  async save(message: Message): Promise<Message> {
    this.logger.debug(`Saving message with ID: ${message.id}`);
    try {
      const messageDocument = new this.messageModel(message.toDatabase());
      await messageDocument.save();
      this.logger.debug(`Message saved successfully: ${message.id}`);
      return message;
    } catch (error) {
      this.logger.error(
        `Failed to save message: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Find a message by its ID and tenant
   *
   * @param id The unique identifier of the message
   * @param tenantId The tenant identifier for multi-tenancy
   * @returns Promise resolving to the message entity or null if not found
   */
  async findById(id: string, tenantId: string): Promise<Message | null> {
    this.logger.debug(`Finding message with ID: ${id} for tenant: ${tenantId}`);
    try {
      const messageDocument = await this.messageModel
        .findOne({
          id,
          tenantId,
        })
        .exec();

      if (!messageDocument) {
        this.logger.debug(`Message not found: ${id}`);
        return null;
      }

      return Message.fromDatabase(messageDocument.toObject());
    } catch (error) {
      this.logger.error(`Error finding message: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update an existing message
   *
   * @param message The message entity with updated values
   * @returns Promise resolving to the updated message entity
   */
  async update(message: Message): Promise<Message> {
    this.logger.debug(`Updating message with ID: ${message.id}`);
    try {
      const result = await this.messageModel.updateOne(
        {
          id: message.id,
          tenantId: message.tenantId,
        },
        message.toDatabase(),
      );

      if (result.matchedCount === 0) {
        this.logger.warn(`No message found to update with ID: ${message.id}`);
      } else {
        this.logger.debug(`Message updated successfully: ${message.id}`);
      }

      return message;
    } catch (error) {
      this.logger.error(
        `Failed to update message: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Delete a message by its ID and tenant
   *
   * @param id The unique identifier of the message to delete
   * @param tenantId The tenant identifier for multi-tenancy
   */
  async delete(id: string, tenantId: string): Promise<void> {
    this.logger.debug(
      `Deleting message with ID: ${id} for tenant: ${tenantId}`,
    );
    try {
      const result = await this.messageModel.deleteOne({
        id,
        tenantId,
      });

      if (result.deletedCount === 0) {
        this.logger.warn(`No message found to delete with ID: ${id}`);
      } else {
        this.logger.debug(`Message deleted successfully: ${id}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to delete message: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Find messages by conversation ID with pagination and sorting
   *
   * @param conversationId The unique identifier of the conversation
   * @param tenantId The tenant identifier for multi-tenancy
   * @param options Pagination and sorting options
   * @returns Promise resolving to paginated message results
   */
  async findByConversationId(
    conversationId: string,
    tenantId: string,
    options: {
      page: number;
      limit: number;
      sort?: { field: string; direction: 'asc' | 'desc' };
    },
  ): Promise<{ messages: Message[]; total: number }> {
    this.logger.debug(
      `Finding messages for conversation: ${conversationId}, tenant: ${tenantId}, page: ${options.page}, limit: ${options.limit}`,
    );

    try {
      // Ensure page and limit are positive integers
      const page = Math.max(1, options.page);
      const limit = Math.max(1, options.limit);

      // Calculate skip value for pagination
      const skip = (page - 1) * limit;

      // Build sort options
      const sortOptions: Record<string, 1 | -1> = {};
      if (options.sort && options.sort.field) {
        sortOptions[options.sort.field] =
          options.sort.direction === 'asc' ? 1 : -1;
      } else {
        // Default sort by timestamp descending (newest first)
        sortOptions.timestamp = -1;
      }

      // Execute query with pagination and sorting
      const messageDocuments = await this.messageModel
        .find({
          conversationId,
          tenantId,
        })
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .exec();

      // Count total messages for pagination metadata
      const total = await this.messageModel
        .countDocuments({
          conversationId,
          tenantId,
        })
        .exec();

      // Map documents to domain entities
      const messages = messageDocuments.map((doc) =>
        Message.fromDatabase(doc.toObject()),
      );

      this.logger.debug(
        `Found ${messages.length} messages out of ${total} total`,
      );

      return { messages, total };
    } catch (error) {
      this.logger.error(
        `Error finding messages by conversation: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
