import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EachMessagePayload } from 'kafkajs';
import { ElasticSearchService } from '../shared/elasticsearch/elasticsearch.service';
import { BaseKafkaConsumer } from '../shared/kafka/base.consumer';
import {
  MessageEventType,
  MessageEvent,
} from './interfaces/message.event.inerface';

/**
 * Kafka consumer service for processing message-related events
 *
 * This service consumes events from the message events topic and
 * updates the Elasticsearch index accordingly.
 */
@Injectable()
export class MessageConsumerService extends BaseKafkaConsumer {
  private readonly messageTopic: string;

  /**
   * Creates an instance of MessageConsumerService
   *
   * @param configService - The NestJS Config service for accessing application configuration
   * @param searchService - The Elasticsearch service for message indexing
   */
  constructor(
    configService: ConfigService,
    private readonly searchService: ElasticSearchService,
  ) {
    super(configService);
    this.messageTopic = this.configService.get<string>(
      'kafka.topics.messages',
      'message-events',
    );
    this.logger.log(`Initialized with message topic: ${this.messageTopic}`);
  }

  /**
   * Subscribes to the required Kafka topics
   *
   * @returns Promise that resolves when subscription is complete
   */
  protected async subscribeTopics(): Promise<void> {
    this.logger.log(`Subscribing to topic: ${this.messageTopic}`);
    await this.consumer.subscribe({
      topic: this.messageTopic,
      fromBeginning: false,
    });
    this.logger.log(`Successfully subscribed to topic: ${this.messageTopic}`);
  }

  /**
   * Handles incoming Kafka messages
   *
   * @param payload - The Kafka message payload
   * @returns Promise that resolves when message processing is complete
   */
  protected async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;
    const messageId = message.key?.toString() || 'unknown';
    const correlationId =
      message.headers?.['correlation-id']?.toString() || 'unknown';

    if (!message.value) {
      this.logger.warn(
        `Received message with empty value from topic ${topic}, partition ${partition}`,
        {
          messageId,
          correlationId,
        },
      );
      return;
    }

    try {
      const value = message.value.toString();
      const event = JSON.parse(value) as MessageEvent;

      this.logger.debug(
        `Processing ${event.type} event from topic ${topic}, partition ${partition}`,
        { messageId, correlationId },
      );

      switch (event.type) {
        case MessageEventType.CREATED:
          await this.searchService.indexMessage(event.payload);
          this.logger.log(`Indexed message with ID: ${event.payload.id}`, {
            correlationId,
          });
          break;

        case MessageEventType.UPDATED:
          await this.searchService.updateMessage(
            event.payload.id,
            event.payload,
          );
          this.logger.log(`Updated message with ID: ${event.payload.id}`, {
            correlationId,
          });
          break;

        case MessageEventType.DELETED:
          await this.searchService.deleteMessage(event.payload.id);
          this.logger.log(`Deleted message with ID: ${event.payload.id}`, {
            correlationId,
          });
          break;

        default:
          this.logger.warn(`Unknown event type: ${event.type}`, {
            messageId,
            correlationId,
          });
          break;
      }
    } catch (error) {
      this.logger.error(
        `Error processing message: ${error.message}`,
        error.stack,
        { messageId, correlationId },
      );
    }
  }
}
