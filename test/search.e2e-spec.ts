import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { TransformInterceptor } from '../src/common/interceptor/transform.interceptor';

describe('SearchController (e2e)', () => {
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

  const tenantId = 'test';
  const conversationId = '123e4567-e89b-12d3-a456-426614174000';
  const searchTerm = 'world!';

  describe('/v1/api/conversations/:conversationId/messages/search (GET)', () => {
    it('should search for messages containing the search term', () => {
      return request(app.getHttpServer())
        .get(`/v1/api/conversations/${conversationId}/messages/search`)
        .set('X-Tenant-Id', tenantId)
        .set('Authorization', 'Bearer valid-token')
        .query({ q: searchTerm, page: 1, limit: 10 })
        .expect(200)
        .expect((response) => {
          const { data, pagination } = response.body.data;
          expect(data).toBeDefined();
          expect(pagination).toBeDefined();
          expect(Array.isArray(data)).toBe(true);

          // Verify pagination details
          expect(typeof pagination.totalItems).toBe('number');
          expect(typeof pagination.page).toBe('number');
          expect(typeof pagination.limit).toBe('number');
          expect(typeof pagination.totalPages).toBe('number');

          // Each result should contain the search term
          data.forEach((message: { content: string; conversationId: any }) => {
            expect(message.content.toLowerCase()).toContain(
              searchTerm.toLowerCase(),
            );
            expect(message.conversationId).toBe(conversationId);
          });
        });
    });

    it('should return empty results for non-matching search term', () => {
      const nonMatchingTerm = 'nonexistentterm';

      return request(app.getHttpServer())
        .get(`/v1/api/conversations/${conversationId}/messages/search`)
        .set('X-Tenant-Id', tenantId)
        .set('Authorization', 'Bearer valid-token')
        .query({ q: nonMatchingTerm, page: 1, limit: 10 })
        .expect(200)
        .expect((response) => {
          const { data, pagination } = response.body.data;

          expect(data).toBeDefined();
          expect(Array.isArray(data)).toBe(true);
          expect(data.length).toBe(0);
          expect(pagination.totalItems).toBe(0);
        });
    });

    it('should return 400 for missing search term', () => {
      return request(app.getHttpServer())
        .get(`/v1/api/conversations/${conversationId}/messages/search`)
        .set('X-Tenant-Id', tenantId)
        .set('Authorization', 'Bearer valid-token')
        .query({ page: 1, limit: 10 })
        .expect(400);
    });

    it('should return 400 when tenant ID is missing', () => {
      return request(app.getHttpServer())
        .get(`/v1/api/conversations/${conversationId}/messages/search`)
        .set('Authorization', 'Bearer valid-token')
        .query({ q: searchTerm, page: 1, limit: 10 })
        .expect(400);
    });

    it('should handle pagination correctly', async () => {
      // First create more messages to test pagination
      const additionalMessages = Array.from({ length: 15 }, (_, i) => ({
        conversationId,
        senderId: '123e4567-e89b-12d3-a456-426614174001',
        content: `${searchTerm} message number ${i + 1}`,
        metadata: { index: i },
      }));

      for (const messageDto of additionalMessages) {
        await request(app.getHttpServer())
          .post('/v1/api/messages')
          .set('X-Tenant-Id', tenantId)
          .set('Authorization', 'Bearer valid-token')
          .send(messageDto)
          .expect(201);
      }

      // Allow time for indexing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Get first page with 5 items
      const firstPageResponse = await request(app.getHttpServer())
        .get(`/v1/api/conversations/${conversationId}/messages/search`)
        .set('X-Tenant-Id', tenantId)
        .set('Authorization', 'Bearer valid-token')
        .query({ q: searchTerm, page: 1, limit: 5 })
        .expect(200);

      const firstPageData = firstPageResponse.body.data;
      expect(firstPageData.pagination.page).toBe(1);
      expect(firstPageData.pagination.limit).toBe(5);
      expect(firstPageData.data.length).toBe(5);

      // Get second page
      const secondPageResponse = await request(app.getHttpServer())
        .get(`/v1/api/conversations/${conversationId}/messages/search`)
        .set('X-Tenant-Id', tenantId)
        .set('Authorization', 'Bearer valid-token')
        .query({ q: searchTerm, page: 2, limit: 5 })
        .expect(200);

      const secondPageData = secondPageResponse.body.data;
      expect(secondPageData.pagination.page).toBe(2);
      expect(secondPageData.data.length).toBe(5);

      // Ensure different messages on different pages
      const firstPageIds = new Set(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        firstPageData.data.map((msg: { id: any }) => msg.id),
      );
      const secondPageIds = new Set(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        secondPageData.data.map((msg: { id: any }) => msg.id),
      );

      // No overlapping IDs between pages
      const overlap = [...firstPageIds].filter((id) => secondPageIds.has(id));
      expect(overlap.length).toBe(0);
    });
  });
});
