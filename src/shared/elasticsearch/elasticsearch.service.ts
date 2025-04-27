import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { messageMapping, messageSettings } from './message.mapping';
import { IndicesCreateRequest } from '@elastic/elasticsearch/lib/api/types';
import { Message } from '../../message/entities/message.entity';
import { PaginatedResponseDto } from '../../common/dto/pagination-response.dto';

/**
 * Service responsible for handling Elasticsearch operations for messages
 *
 * This service manages the indexing, updating, deleting, and searching of
 * message documents in Elasticsearch.
 *
 * @remarks
 * Implements OnModuleInit to ensure the required index exists when the service starts
 */
@Injectable()
export class ElasticSearchService implements OnModuleInit {
  private readonly index = 'messages';
  private readonly logger = new Logger(ElasticSearchService.name);

  /**
   * Creates an instance of ElasticSearchService
   *
   * @param elasticsearchService - The NestJS Elasticsearch service for interacting with Elasticsearch
   * @param configService - The NestJS Config service for accessing application configuration
   */
  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Lifecycle hook that runs when the module is initialized
   *
   * Checks if the messages index exists and creates it if it doesn't
   *
   * @returns Promise that resolves when initialization is complete
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing ElasticSearch service');
    try {
      const indexExists = await this.elasticsearchService.indices.exists({
        index: this.index,
      });

      if (!indexExists) {
        this.logger.log(`Index '${this.index}' does not exist, creating...`);
        await this.createIndex();
        this.logger.log(`Successfully created index: ${this.index}`);
      } else {
        this.logger.log(`Index '${this.index}' already exists`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to initialize ElasticSearch service: ${error.message}`,
        error.stack,
      );
      throw new Error(`ElasticSearch initialization failed: ${error.message}`);
    }
  }

  /**
   * Creates the messages index with the specified mappings and settings
   *
   * @private
   * @returns Promise that resolves when the index is created
   */
  private async createIndex(): Promise<void> {
    this.logger.debug('Creating index with mappings and settings');
    const request: IndicesCreateRequest = {
      index: this.index,
      mappings: {
        properties: messageMapping.properties as any,
      },
      settings: {
        number_of_shards: 1,
        number_of_replicas: 1,
        analysis: messageSettings.analysis as any,
        index: messageSettings.index as any,
        'index.max_ngram_diff': 15,
      },
    };

    try {
      await this.elasticsearchService.indices.create(request);
      this.logger.debug(`Index configuration applied for '${this.index}'`);
    } catch (error) {
      this.logger.error(
        `Failed to create index: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Indexes a message document in Elasticsearch
   *
   * @param message - The message entity to be indexed
   * @returns Promise that resolves when indexing is complete
   * @throws Error if indexing fails
   */
  async indexMessage(message: Message): Promise<void> {
    this.logger.debug(
      `Indexing message: ${message.id} in conversation: ${message.conversationId}`,
    );
    try {
      await this.elasticsearchService.index({
        index: this.index,
        id: message.id,
        document: {
          id: message.id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          content: message.content,
          timestamp: message.timestamp,
          tenantId: message.tenantId,
          metadata: message.metadata,
        },
        refresh: true,
      });
      this.logger.log(`Successfully indexed message: ${message.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to index message ${message.id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Message indexing failed: ${error.message}`);
    }
  }

  /**
   * Updates an existing message document in Elasticsearch
   *
   * @param messageId - The ID of the message to update
   * @param partialUpdate - The fields to update in the message document
   * @returns Promise that resolves when the update is complete
   * @throws Error if the update fails
   */
  async updateMessage(
    messageId: string,
    partialUpdate: Partial<Message>,
  ): Promise<void> {
    this.logger.debug(
      `Updating message: ${messageId} with fields: ${Object.keys(partialUpdate).join(', ')}`,
    );
    try {
      await this.elasticsearchService.update({
        index: this.index,
        id: messageId,
        doc: partialUpdate,
        refresh: true,
      });
      this.logger.log(`Successfully updated message: ${messageId}`);
    } catch (error) {
      this.logger.error(
        `Failed to update message ${messageId}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Message update failed: ${error.message}`);
    }
  }

  /**
   * Deletes a message document from Elasticsearch
   *
   * @param messageId - The ID of the message to delete
   * @returns Promise that resolves when deletion is complete
   * @throws Error if deletion fails
   */
  async deleteMessage(messageId: string): Promise<void> {
    this.logger.debug(`Deleting message: ${messageId}`);
    try {
      await this.elasticsearchService.delete({
        index: this.index,
        id: messageId,
        refresh: true,
      });
      this.logger.log(`Successfully deleted message: ${messageId}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete message ${messageId}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Message deletion failed: ${error.message}`);
    }
  }

  /**
   * Searches for messages in a conversation matching the provided search term
   *
   * @param conversationId - The ID of the conversation to search within
   * @param tenantId - The ID of the tenant the conversation belongs to
   * @param searchTerm - The text to search for in message content
   * @param options - Pagination options (page number and limit)
   * @returns Promise that resolves to a paginated response containing matching messages
   * @throws Error if search fails
   */
  async searchMessages(
    conversationId: string,
    tenantId: string,
    searchTerm: string,
    options: { page: number; limit: number },
  ): Promise<PaginatedResponseDto<Message>> {
    const { page, limit } = options;
    const from = (page - 1) * limit;

    this.logger.debug(
      `Searching for "${searchTerm}" in conversation: ${conversationId}, tenant: ${tenantId} (page: ${page}, limit: ${limit})`,
    );

    try {
      const result = await this.elasticsearchService.search({
        index: this.index,
        query: {
          bool: {
            must: [
              { term: { conversationId } },
              { term: { tenantId } },
              {
                multi_match: {
                  query: searchTerm,
                  fields: ['content', 'content.ngram'],
                  fuzziness: 'AUTO',
                },
              },
            ],
          },
        },
        sort: [{ timestamp: { order: 'desc' } }],
        from,
        size: limit,
      });

      const hits = result.hits.hits;
      const totalItems =
        typeof result.hits.total === 'number'
          ? result.hits.total
          : result.hits.total?.value || 0;

      this.logger.debug(
        `Search returned ${hits.length} results out of ${totalItems} total matches`,
      );

      // Convert Elasticsearch results to Message entities
      const messages = hits.map((hit) => {
        const source: any = hit._source;
        return Message.fromDatabase({
          id: source.id,
          conversationId: source.conversationId,
          senderId: source.senderId,
          content: source.content,
          tenantId: source.tenantId,
          timestamp: source.timestamp,
          metadata: source.metadata,
        });
      });

      const totalPages = Math.ceil(totalItems / limit);

      this.logger.log(
        `Successfully completed search for "${searchTerm}" in conversation: ${conversationId} (found: ${totalItems})`,
      );

      return {
        data: messages,
        pagination: {
          page,
          limit,
          totalItems,
          totalPages,
        },
      };
    } catch (error) {
      this.logger.error(
        `Search failed for term "${searchTerm}" in conversation ${conversationId}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Message search failed: ${error.message}`);
    }
  }
}
