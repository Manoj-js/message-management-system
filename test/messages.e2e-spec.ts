import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { CreateMessageDto } from '../src/message/dto/create-message.dto';
import { v4 as uuidv4 } from 'uuid';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { TransformInterceptor } from '../src/common/interceptor/transform.interceptor';

describe('MessageController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.enableVersioning({
      type: VersioningType.URI,
    });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const tenantId = 'test-tenant';

  describe('/v1/api/messages (POST)', () => {
    it('should create a new message', () => {
      const createMessageDto: CreateMessageDto = {
        conversationId: uuidv4(),
        senderId: uuidv4(),
        content: 'Test message content',
        metadata: { test: true },
      };

      return request(app.getHttpServer())
        .post('/v1/api/messages')
        .set('X-Tenant-Id', tenantId)
        .set('Authorization', 'Bearer valid-token')
        .send(createMessageDto)
        .expect(201)
        .expect((response) => {
          const { data } = response.body;
          expect(data).toBeDefined();
          expect(data.id).toBeDefined();
          expect(data.conversationId).toBe(createMessageDto.conversationId);
          expect(data.senderId).toBe(createMessageDto.senderId);
          expect(data.content).toBe(createMessageDto.content);
          expect(data.timestamp).toBeDefined();
          expect(data.metadata).toEqual(createMessageDto.metadata);
        });
    });

    it('should return 400 for invalid input', () => {
      const invalidDto = { metadata: { invalid: true } };

      return request(app.getHttpServer())
        .post('/v1/api/messages')
        .set('X-Tenant-Id', tenantId)
        .set('Authorization', 'Bearer valid-token')
        .send(invalidDto)
        .expect(400);
    });

    it('should return 400 when tenant ID is missing', () => {
      const createMessageDto: CreateMessageDto = {
        conversationId: uuidv4(),
        senderId: uuidv4(),
        content: 'Test message content',
        metadata: { test: true },
      };

      return request(app.getHttpServer())
        .post('/v1/api/messages')
        .set('Authorization', 'Bearer valid-token')
        .send(createMessageDto)
        .expect(400);
    });
  });

  describe('/v1/api/messages/conversations/:conversationId (GET)', () => {
    it('should retrieve messages for a conversation with pagination', async () => {
      const conversationId = '123e4567-e89b-12d3-a456-426614174000';

      const createMessageDto: CreateMessageDto = {
        conversationId,
        senderId: '123e4567-e89b-12d3-a456-426614174001',
        content: 'Message for conversation test',
        metadata: { key: 'value' },
      };

      await request(app.getHttpServer())
        .post('/v1/api/messages')
        .set('X-Tenant-Id', tenantId)
        .set('Authorization', 'Bearer valid-token')
        .send(createMessageDto)
        .expect(201);

      return request(app.getHttpServer())
        .get(`/v1/api/messages/conversations/${conversationId}`)
        .set('X-Tenant-Id', tenantId)
        .set('Authorization', 'Bearer valid-token')
        .query({ page: 1, limit: 10 })
        .expect(200)
        .expect((response) => {
          const { data, pagination } = response.body.data;
          expect(data).toBeDefined();
          expect(pagination).toBeDefined();

          expect(Array.isArray(data)).toBe(true);
          expect(typeof pagination.totalItems).toBe('number');
          expect(typeof pagination.page).toBe('number');
          expect(typeof pagination.limit).toBe('number');
          expect(typeof pagination.totalPages).toBe('number');

          if (data.length > 0) {
            const message = data[0];
            expect(message.conversationId).toBe(conversationId);
            expect(message.content).toBe(createMessageDto.content);
          }
        });
    });
  });
});
