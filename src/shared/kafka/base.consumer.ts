import {
  Injectable,
  OnModuleInit,
  OnApplicationShutdown,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';

/**
 * Abstract base class for Kafka consumers in NestJS applications.
 * Provides common functionality for connecting to Kafka and consuming messages.
 *
 * @remarks
 * This class handles the lifecycle of a Kafka consumer, including connection
 * management, topic subscription, and message processing during application
 * startup and shutdown.
 */
@Injectable()
export abstract class BaseKafkaConsumer
  implements OnModuleInit, OnApplicationShutdown
{
  /** Logger instance for this class */
  protected readonly logger = new Logger(this.constructor.name);

  /** Kafka client instance */
  protected readonly kafka: Kafka;

  /** Kafka consumer instance */
  protected consumer: Consumer;

  /**
   * Creates an instance of BaseKafkaConsumer.
   *
   * @param configService - NestJS ConfigService for retrieving Kafka configuration
   */
  constructor(protected readonly configService: ConfigService) {
    const brokers = this.configService.get<string[]>('kafka.brokers') || [];
    const clientId = this.configService.get<string>('kafka.clientId') || '';
    const groupId = this.configService.get<string>('kafka.groupId') || '';

    this.logger.log(
      `Initializing Kafka consumer with clientId: ${clientId}, groupId: ${groupId}, brokers: ${brokers.join(',')}`,
    );

    this.kafka = new Kafka({ clientId, brokers });
    this.consumer = this.kafka.consumer({ groupId });
  }

  /**
   * Lifecycle hook that connects the Kafka consumer when the module initializes.
   * It connects to Kafka, subscribes to topics, and starts consuming messages.
   *
   * @throws {Error} If connection to Kafka fails or topic subscription fails
   */
  async onModuleInit() {
    try {
      this.logger.log('Connecting Kafka consumer...');
      await this.consumer.connect();
      this.logger.log('Kafka consumer connected successfully');

      this.logger.log('Subscribing to topics...');
      await this.subscribeTopics();
      this.logger.log('Topics subscribed successfully');

      this.logger.log('Starting message consumption...');
      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          try {
            const { topic, partition, message } = payload;
            const timestamp = message.timestamp
              ? new Date(parseInt(message.timestamp)).toISOString()
              : 'unknown';
            const key = message.key ? message.key.toString() : undefined;

            this.logger.debug(`Received message from topic ${topic}`, {
              topic,
              partition,
              offset: message.offset,
              key,
              timestamp,
              headers: message.headers,
            });

            await this.handleMessage(payload);

            this.logger.debug(
              `Successfully processed message from topic ${topic}`,
              {
                topic,
                partition,
                offset: message.offset,
              },
            );
          } catch (error) {
            this.logger.error(
              `Error processing message: ${error.message}`,
              error.stack,
            );

            // - Send to a dead letter queue
          }
        },
      });
      this.logger.log('Kafka consumer running');
    } catch (error) {
      this.logger.error(
        `Failed to initialize Kafka consumer: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Lifecycle hook that disconnects the Kafka consumer when the application shuts down.
   */
  async onApplicationShutdown() {
    try {
      this.logger.log('Disconnecting Kafka consumer...');
      await this.consumer.disconnect();
      this.logger.log('Kafka consumer disconnected successfully');
    } catch (error) {
      this.logger.error(
        `Error during Kafka consumer disconnection: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Subscribes to Kafka topics.
   * This method should be implemented by derived classes to subscribe to specific topics.
   *
   * @returns A promise that resolves when subscription is complete
   */
  protected abstract subscribeTopics(): Promise<void>;

  /**
   * Handles incoming Kafka messages.
   * This method should be implemented by derived classes to process messages from subscribed topics.
   *
   * @param payload - The message payload from Kafka
   * @returns A promise that resolves when message processing is complete
   */
  protected abstract handleMessage(payload: EachMessagePayload): Promise<void>;
}
