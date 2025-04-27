import * as Joi from 'joi';

/**
 * Application configuration interface
 *
 * Defines the structure of the application's configuration
 */
export interface AppConfiguration {
  port: number;
  mongodb: {
    uri: string;
  };
  kafka: {
    brokers: string[];
    clientId: string;
    groupId: string;
    topics: {
      messages: string;
    };
  };
  elasticsearch: {
    node: string;
  };
  redis: {
    host: string;
    port: number;
    password: string | null;
    ttl: number;
  };
}

/**
 * Loads application configuration from environment variables
 *
 * @returns The application configuration object
 */
export default (): AppConfiguration => ({
  port: parseInt(process.env.PORT || '3000', 10),
  mongodb: {
    uri:
      process.env.MONGODB_URI ||
      'mongodb://root:example@localhost:27017/message-db?authSource=admin',
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'message-app',
    groupId: process.env.KAFKA_GROUP_ID || 'message-consumer',
    topics: {
      messages: process.env.KAFKA_TOPIC_MESSAGES || 'message-events',
    },
  },
  elasticsearch: {
    node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || null,
    ttl: parseInt(process.env.REDIS_TTL || '3600', 10), // Default TTL of 1 hour in seconds
  },
});

/**
 * Joi validation schema for environment variables
 *
 * Used by NestJS ConfigModule for configuration validation
 */
export const validationSchema = Joi.object({
  // Server configuration
  PORT: Joi.number().default(3000),

  // MongoDB configuration
  MONGODB_URI: Joi.string().default(
    'mongodb://root:example@localhost:27017/message-db?authSource=admin',
  ),

  // Kafka configuration
  KAFKA_BROKERS: Joi.string().default('localhost:9092'),
  KAFKA_CLIENT_ID: Joi.string().default('message-app'),
  KAFKA_GROUP_ID: Joi.string().default('message-consumer'),
  KAFKA_TOPIC_MESSAGES: Joi.string().default('message-events'),

  // Elasticsearch configuration
  ELASTICSEARCH_NODE: Joi.string().default('http://localhost:9200'),

  // Redis configuration
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow(null, '').default(null),
  REDIS_TTL: Joi.number().default(3600),
});
