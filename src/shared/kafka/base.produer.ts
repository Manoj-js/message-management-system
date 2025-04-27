import {
  Injectable,
  OnModuleInit,
  OnApplicationShutdown,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, ProducerRecord } from 'kafkajs';

/**
 * Abstract base class for Kafka producers in NestJS applications.
 * Provides common functionality for connecting to Kafka and sending messages.
 *
 * @remarks
 * This class handles the lifecycle of a Kafka producer, including connection
 * management during application startup and shutdown.
 */
@Injectable()
export abstract class BaseKafkaProducer
  implements OnModuleInit, OnApplicationShutdown
{
  /** Logger instance for this class */
  public readonly logger = new Logger(this.constructor.name);

  /** Kafka client instance */
  protected readonly kafka: Kafka;

  /** Kafka producer instance */
  protected producer: Producer;

  /**
   * Creates an instance of BaseKafkaProducer.
   *
   * @param configService - NestJS ConfigService for retrieving Kafka configuration
   */
  constructor(protected readonly configService: ConfigService) {
    const brokers = this.configService.get<string[]>('kafka.brokers') || [];
    const clientId = this.configService.get<string>('kafka.clientId') || '';

    this.logger.log(
      `Initializing Kafka producer with clientId: ${clientId}, brokers: ${brokers.join(',')}`,
    );

    this.kafka = new Kafka({ clientId, brokers });
    this.producer = this.kafka.producer();
  }

  /**
   * Lifecycle hook that connects the Kafka producer when the module initializes.
   *
   * @throws {Error} If connection to Kafka fails
   */
  async onModuleInit() {
    try {
      this.logger.log('Connecting Kafka producer...');
      await this.producer.connect();
      this.logger.log('Kafka producer connected successfully');
    } catch (error) {
      this.logger.error(
        `Failed to connect Kafka producer: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Lifecycle hook that disconnects the Kafka producer when the application shuts down.
   */
  async onApplicationShutdown() {
    try {
      this.logger.log('Disconnecting Kafka producer...');
      await this.producer.disconnect();
      this.logger.log('Kafka producer disconnected successfully');
    } catch (error) {
      this.logger.error(
        `Error during Kafka producer disconnection: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Sends a message to a specified Kafka topic.
   *
   * @param topic - The Kafka topic to send the message to
   * @param message - The message payload to be sent (will be JSON stringified)
   * @param key - Optional message key for partitioning
   * @returns A promise that resolves when the message is sent
   * @throws {Error} If sending the message fails
   */
  async produce(topic: string, message: any, key?: string): Promise<void> {
    if (!topic) {
      throw new Error('Topic is required');
    }

    this.logger.debug(
      `Preparing to send message to topic ${topic}${key ? ` with key ${key}` : ''}`,
    );

    const record: ProducerRecord = {
      topic,
      messages: [
        {
          key: key || undefined,
          value: JSON.stringify(message),
          headers: {
            timestamp: Date.now().toString(),
          },
        },
      ],
    };

    try {
      this.logger.debug(`Sending message to topic ${topic}`, {
        topic,
        messageSize: JSON.stringify(message).length,
        hasKey: !!key,
      });

      const result = await this.producer.send(record);

      this.logger.debug(`Message sent successfully to topic ${topic}`, {
        topic,
        partitions: JSON.stringify(result),
      });
    } catch (error) {
      this.logger.error(
        `Failed to send message to topic ${topic}: ${error.message}`,
        { topic, error: error.stack },
      );
      throw error;
    }
  }
}
