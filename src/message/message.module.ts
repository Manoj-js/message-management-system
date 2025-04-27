import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MessageModel, MessageSchema } from './schemas/message.schema';
import { MessageRepository } from './repositories/mongodb-message.repository';
import { MessageController } from './controllers/message.controller';
import { MessageApplicationService } from './services/message-application.service';
import { MessageProducerService } from './services/message-producer.service';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MessageModel.name, schema: MessageSchema },
    ]),
    CacheModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisConfig = configService.get('redis');
        return {
          store: redisStore,
          host: redisConfig.host,
          port: redisConfig.port,
          password: redisConfig.password || undefined,
          ttl: redisConfig.ttl,
        };
      },
    }),
  ],
  controllers: [MessageController],
  providers: [
    MessageApplicationService,
    MessageRepository,
    MessageProducerService,
  ],
  exports: [],
})
export class MessageModule {}
