import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MessageConsumerService } from './message.consumer';
import { SearchModule } from '../search/search.module';

/**
 * Module responsible for Elasticsearch data synchronization via Kafka consumers
 *
 * This module sets up Kafka consumers that listen for message events and
 * synchronize them with the Elasticsearch index to maintain search functionality.
 *
 * @remarks
 * Depends on ConfigModule for configuration access and SearchModule for
 * Elasticsearch operations. The MessageConsumerService handles the Kafka message
 * consumption and processing logic.
 */
@Module({
  imports: [ConfigModule, SearchModule],
  providers: [MessageConsumerService],
})
export class ElasticConsumerModule {}
