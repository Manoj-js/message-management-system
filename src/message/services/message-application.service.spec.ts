import { Test, TestingModule } from '@nestjs/testing';
import { MessageApplicationService } from './message-application.service';
import { MessageRepository } from '../repositories/mongodb-message.repository';
import { MessageProducerService } from './message-producer.service';
import { TenantContext } from '../../common/contexts/tenant.context';
import { CreateMessageDto } from '../dto/create-message.dto';
import { UpdateMessageDto } from '../dto/update-message.dto';
import { Message } from '../entities/message.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

jest.mock('../repositories/mongodb-message.repository');
jest.mock('./message-producer.service');
jest.mock('../../common/contexts/tenant.context');

describe('MessageApplicationService', () => {
  let service: MessageApplicationService;
  let messageRepository: jest.Mocked<MessageRepository>;
  let kafkaProducer: jest.Mocked<MessageProducerService>;
  let tenantContext: jest.Mocked<TenantContext>;
  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageApplicationService,
        MessageRepository,
        MessageProducerService,
        TenantContext,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<MessageApplicationService>(MessageApplicationService);
    messageRepository = module.get(MessageRepository);
    kafkaProducer = module.get(MessageProducerService);
    tenantContext = module.get(TenantContext);

    tenantContext.getCurrentTenant.mockReturnValue('tenant123');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createMessage', () => {
    it('should create, save, and publish a new message', async () => {
      const createDto: CreateMessageDto = {
        conversationId: 'conv1',
        senderId: 'user1',
        content: 'Hello world',
        metadata: { important: true },
      };

      const savedMessage = Message.create({
        id: 'msg1',
        conversationId: createDto.conversationId,
        senderId: createDto.senderId,
        content: createDto.content,
        tenantId: 'tenant123',
        metadata: createDto.metadata,
      });

      messageRepository.save.mockResolvedValue(savedMessage);

      const result = await service.createMessage(createDto);

      expect(messageRepository.save).toHaveBeenCalled();
      expect(kafkaProducer.publishMessageCreated).toHaveBeenCalledWith(
        savedMessage,
      );
      expect(result).toEqual(savedMessage);
    });
  });

  describe('getMessageById', () => {
    it('should return a message if found', async () => {
      const message = Message.create({
        id: 'msg1',
        conversationId: 'conv1',
        senderId: 'user1',
        content: 'Hello',
        tenantId: 'tenant123',
        metadata: {},
      });

      mockCacheManager.get.mockResolvedValue(null);
      messageRepository.findById.mockResolvedValue(message);

      const result = await service.getMessageById('msg1');

      expect(messageRepository.findById).toHaveBeenCalledWith(
        'msg1',
        'tenant123',
      );
      expect(result).toEqual(message);
    });

    it('should return cached message if available', async () => {
      const cachedMessage = Message.create({
        id: 'msg1',
        conversationId: 'conv1',
        senderId: 'user1',
        content: 'Hello',
        tenantId: 'tenant123',
        metadata: {},
      });

      mockCacheManager.get.mockResolvedValue(cachedMessage);

      const result = await service.getMessageById('msg1');

      expect(messageRepository.findById).not.toHaveBeenCalled();
      expect(result).toEqual(cachedMessage);
    });

    it('should return null if message not found', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      messageRepository.findById.mockResolvedValue(null);

      const result = await service.getMessageById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateMessage', () => {
    it('should update content and metadata', async () => {
      const existingMessage = Message.create({
        id: 'msg1',
        conversationId: 'conv1',
        senderId: 'user1',
        content: 'Old content',
        tenantId: 'tenant123',
        metadata: {},
      });

      const updateDto: UpdateMessageDto = {
        content: 'New content',
        metadata: { updated: true },
      };

      messageRepository.findById.mockResolvedValue(existingMessage);
      messageRepository.update.mockResolvedValue(existingMessage);

      const result = await service.updateMessage('msg1', updateDto);

      expect(existingMessage.content).toBe('New content');
      expect(existingMessage.metadata).toEqual({ updated: true });
      expect(messageRepository.update).toHaveBeenCalledWith(existingMessage);
      expect(kafkaProducer.publishMessageUpdated).toHaveBeenCalledWith(
        existingMessage,
      );
      expect(result).toEqual(existingMessage);
    });

    it('should return null if message does not exist', async () => {
      messageRepository.findById.mockResolvedValue(null);

      const result = await service.updateMessage('msg1', {
        content: 'New content',
      });

      expect(result).toBeNull();
    });
  });

  describe('deleteMessage', () => {
    it('should delete a message and publish event', async () => {
      const message = Message.create({
        id: 'msg1',
        conversationId: 'conv1',
        senderId: 'user1',
        content: 'Hello',
        tenantId: 'tenant123',
        metadata: {},
      });

      messageRepository.findById.mockResolvedValue(message);

      const result = await service.deleteMessage('msg1');

      expect(messageRepository.delete).toHaveBeenCalledWith(
        'msg1',
        'tenant123',
      );
      expect(kafkaProducer.publishMessageDeleted).toHaveBeenCalledWith({
        id: 'msg1',
        conversationId: 'conv1',
        tenantId: 'tenant123',
      });
      expect(result).toBe(true);
    });

    it('should return false if message not found', async () => {
      messageRepository.findById.mockResolvedValue(null);

      const result = await service.deleteMessage('notfound');

      expect(result).toBe(false);
    });
  });

  describe('getMessagesByConversation', () => {
    it('should return messages for a conversation', async () => {
      const messages = [
        Message.create({
          id: 'msg1',
          conversationId: 'conv1',
          senderId: 'user1',
          content: 'First message',
          tenantId: 'tenant123',
          metadata: {},
        }),
      ];

      mockCacheManager.get.mockResolvedValue(null);
      messageRepository.findByConversationId.mockResolvedValue({
        messages,
        total: 1,
      });

      const result = await service.getMessagesByConversation('conv1', {
        page: 1,
        limit: 10,
      });

      expect(messageRepository.findByConversationId).toHaveBeenCalledWith(
        'conv1',
        'tenant123',
        {
          page: 1,
          limit: 10,
        },
      );
      expect(result).toEqual({ messages, total: 1 });
    });

    it('should return cached results when available', async () => {
      const cachedResult = {
        messages: [
          Message.create({
            id: 'msg1',
            conversationId: 'conv1',
            senderId: 'user1',
            content: 'First message',
            tenantId: 'tenant123',
            metadata: {},
          }),
        ],
        total: 1,
      };

      mockCacheManager.get.mockResolvedValue(cachedResult);

      const result = await service.getMessagesByConversation('conv1', {
        page: 1,
        limit: 10,
      });

      expect(messageRepository.findByConversationId).not.toHaveBeenCalled();
      expect(result).toEqual(cachedResult);
    });

    it('should use default page and limit values if invalid ones are provided', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      messageRepository.findByConversationId.mockResolvedValue({
        messages: [],
        total: 0,
      });

      await service.getMessagesByConversation('conv1', {
        page: -1,
        limit: 0,
      });

      expect(messageRepository.findByConversationId).toHaveBeenCalledWith(
        'conv1',
        'tenant123',
        {
          page: 1,
          limit: 10,
        },
      );
    });
  });

  describe('error handling', () => {
    it('should handle cache errors gracefully when creating a message', async () => {
      const createDto: CreateMessageDto = {
        conversationId: 'conv1',
        senderId: 'user1',
        content: 'Hello world',
        metadata: { important: true },
      };

      const savedMessage = Message.create({
        id: 'msg1',
        conversationId: createDto.conversationId,
        senderId: createDto.senderId,
        content: createDto.content,
        tenantId: 'tenant123',
        metadata: createDto.metadata,
      });

      messageRepository.save.mockResolvedValue(savedMessage);
      mockCacheManager.set.mockRejectedValue(new Error('Cache error'));

      const result = await service.createMessage(createDto);

      // Should still complete the operation even if cache fails
      expect(result).toEqual(savedMessage);
      expect(kafkaProducer.publishMessageCreated).toHaveBeenCalledWith(
        savedMessage,
      );
    });

    it('should handle Kafka errors gracefully when creating a message', async () => {
      const createDto: CreateMessageDto = {
        conversationId: 'conv1',
        senderId: 'user1',
        content: 'Hello world',
        metadata: { important: true },
      };

      const savedMessage = Message.create({
        id: 'msg1',
        conversationId: createDto.conversationId,
        senderId: createDto.senderId,
        content: createDto.content,
        tenantId: 'tenant123',
        metadata: createDto.metadata,
      });

      messageRepository.save.mockResolvedValue(savedMessage);
      kafkaProducer.publishMessageCreated.mockRejectedValue(
        new Error('Kafka error'),
      );

      const result = await service.createMessage(createDto);

      // Should still complete the operation even if Kafka fails
      expect(result).toEqual(savedMessage);
    });
  });
});
