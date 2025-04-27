import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseKafkaProducer } from '../../shared/kafka/base.produer';
import { v4 as uuidv4 } from 'uuid';

/**
 * Enum defining the types of message events
 * Used to ensure consistency between producer and consumer
 */
export enum MessageEventType {
  CREATED = 'message.created',
  UPDATED = 'message.updated',
  DELETED = 'message.deleted',
}

/**
 * Interface defining the structure of message events
 * Aligns with the consumer's expected format
 */
export interface MessageEvent<T = any> {
  /** Type of the message event */
  type: MessageEventType;
  /** Payload containing message data */
  payload: T;
  /** Timestamp when the event was created */
  timestamp: string;
  /** Version of the event schema */
  version: string;
}

/**
 * Service responsible for producing message-related events to Kafka.
 *
 * This service extends the BaseKafkaProducer to provide message-specific
 * event production capabilities, ensuring consistent format between
 * producers and consumers. Uses conversationId as the partition key
 * to ensure all messages from the same conversation go to the same partition.
 * Automatically generates correlation IDs for message tracing.
 *
 * @example
 * ```typescript
 * // Publish a message created event
 * await messageProducer.publishMessageCreated(message);
 * ```
 */
@Injectable()
export class MessageProducerService extends BaseKafkaProducer {
  logger = new Logger(MessageProducerService.name);
  private readonly messageTopic: string;
  private readonly currentSchemaVersion = '1.0';

  /**
   * Creates an instance of MessageProducerService.
   *
   * @param configService - The NestJS ConfigService for accessing configuration values
   */
  constructor(protected readonly configService: ConfigService) {
    super(configService);
    this.messageTopic = this.configService.get<string>(
      'kafka.topics.messages',
      'message-events',
    );
    this.logger.log(`Initialized with message topic: ${this.messageTopic}`);
  }

  /**
   * Publishes a message created event to Kafka
   *
   * @param payload - The message entity that was created
   * @returns Promise that resolves when the event is published
   */
  async publishMessageCreated<T extends { id: string; conversationId: string }>(
    payload: T,
  ): Promise<void> {
    const correlationId = uuidv4();

    await this.publishMessageEvent(
      MessageEventType.CREATED,
      payload,
      payload.conversationId, // Use conversationId as the partition key
      correlationId,
    );

    this.logger.debug(
      `Published message.created event for message ID: ${payload.id}, conversation: ${payload.conversationId}, correlationId: ${correlationId}`,
    );
  }

  /**
   * Publishes a message updated event to Kafka
   *
   * @param payload - The message entity that was updated
   * @returns Promise that resolves when the event is published
   */
  async publishMessageUpdated<T extends { id: string; conversationId: string }>(
    payload: T,
  ): Promise<void> {
    const correlationId = uuidv4();

    await this.publishMessageEvent(
      MessageEventType.UPDATED,
      payload,
      payload.conversationId, // Use conversationId as the partition key
      correlationId,
    );

    this.logger.debug(
      `Published message.updated event for message ID: ${payload.id}, conversation: ${payload.conversationId}, correlationId: ${correlationId}`,
    );
  }

  /**
   * Publishes a message deleted event to Kafka
   *
   * @param payload - Object containing id, conversationId, and tenantId of the deleted message
   * @returns Promise that resolves when the event is published
   */
  async publishMessageDeleted(payload: {
    id: string;
    conversationId: string;
    tenantId: string;
  }): Promise<void> {
    const correlationId = uuidv4();

    await this.publishMessageEvent(
      MessageEventType.DELETED,
      payload,
      payload.conversationId, // Use conversationId as the partition key
      correlationId,
    );

    this.logger.debug(
      `Published message.deleted event for message ID: ${payload.id}, conversation: ${payload.conversationId}, correlationId: ${correlationId}`,
    );
  }

  /**
   * Generic method to publish any message event
   *
   * @param type - Type of the message event
   * @param payload - Payload of the event
   * @param partitionKey - Key used for partition routing (conversationId)
   * @param correlationId - Correlation ID for tracing
   * @returns Promise that resolves when the event is published
   * @private
   */
  private async publishMessageEvent<T>(
    type: MessageEventType,
    payload: T,
    partitionKey: string,
    correlationId: string,
  ): Promise<void> {
    const event: MessageEvent<T> = {
      type,
      payload,
      timestamp: new Date().toISOString(),
      version: this.currentSchemaVersion,
    };

    try {
      await this.produce(
        this.messageTopic,
        event,
        partitionKey, // Use conversationId as the key for partitioning
        {
          'message-id': (payload as any).id || 'unknown',
          'correlation-id': correlationId,
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish ${type} event: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Enhanced produce method that supports custom headers
   *
   * @param topic - Kafka topic to publish to
   * @param message - Message payload
   * @param key - Key for partition routing (conversationId)
   * @param headers - Optional custom headers
   * @returns Promise that resolves when the message is sent
   */
  async produce(
    topic: string,
    message: any,
    key?: string,
    headers?: Record<string, string>,
  ): Promise<void> {
    const record = {
      topic,
      messages: [
        {
          key: key || undefined,
          value: JSON.stringify(message),
          headers: {
            timestamp: Date.now().toString(),
            source: this.configService.get<string>(
              'APP_NAME',
              'message-service',
            ),
            ...(headers || {}),
          },
        },
      ],
    };

    try {
      await this.producer.send(record);
      this.logger.debug(
        `Message sent to topic ${topic} with key ${key || 'undefined'}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send message to topic ${topic}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Sends a batch of message events to Kafka
   *
   * @param events - Array of events to publish
   * @returns Promise that resolves when all events are published
   */
  async publishBatchEvents<T extends { id: string; conversationId: string }>(
    events: Array<{
      type: MessageEventType;
      payload: T;
    }>,
  ): Promise<void> {
    if (!events || events.length === 0) {
      return;
    }

    const messages = events.map((event) => {
      const correlationId = uuidv4();

      return {
        key: event.payload.conversationId, // Use conversationId as partition key
        value: JSON.stringify({
          type: event.type,
          payload: event.payload,
          timestamp: new Date().toISOString(),
          version: this.currentSchemaVersion,
        }),
        headers: {
          timestamp: Date.now().toString(),
          source: this.configService.get<string>('APP_NAME', 'message-service'),
          'message-id': event.payload.id,
          'correlation-id': correlationId,
          batch: 'true',
        },
      };
    });

    try {
      await this.producer.send({
        topic: this.messageTopic,
        messages,
      });

      this.logger.debug(
        `Batch of ${events.length} events sent to topic ${this.messageTopic}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send batch events to topic ${this.messageTopic}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
