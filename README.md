# Message Management System

A domain-driven, event-based message management service built with NestJS, MongoDB, Kafka, and Elasticsearch.

## Overview

This system provides RESTful APIs for message management with full-text search capabilities. The architecture follows Domain-Driven Design (DDD) principles implemented as a modular monolith, with event-driven communication between components and Redis-based caching for performance.

### Key Features

- Message CRUD operations with multi-tenant support
- Conversation-based message grouping
- Full-text search with Elasticsearch
- Event-driven architecture using Kafka
- Distributed caching with Redis
- Comprehensive API documentation with Swagger

## Technology Stack

- **Backend**: NestJS with TypeScript
- **Database**: MongoDB
- **Message Broker**: Kafka
- **Search Engine**: Elasticsearch
- **Cache**: Redis
- **Documentation**: Swagger/OpenAPI

## Quick Start

```bash
# Clone the repository
git clone [repository-url]

# Install dependencies
npm install

# Start infrastructure
docker-compose up -d

# Run the application
npm run start:dev

# Access API documentation
# Open http://localhost:3000/api/docs in your browser
```

## API Documentation

The system provides the following API endpoints:

- `POST /v1/api/messages` - Create a new message
- `GET /v1/api/messages/:id` - Get a message by ID
- `PUT /v1/api/messages/:id` - Update a message
- `DELETE /v1/api/messages/:id` - Delete a message
- `GET /v1/api/conversations/:conversationId/messages` - Get messages for a conversation with pagination
- `GET /v1/api/conversations/:conversationId/messages/search?q=term` - Search messages in a conversation

Full API documentation is available at `/api/docs` when the application is running.

## Architecture Documentation

Detailed documentation about the system architecture and design:

- [Architecture Overview](docs/architecture.md) - System architecture and component interactions
- [Domain Model](docs/domain-model.md) - Core domain concepts and business rules
- [API Design](docs/api-design.md) - API endpoints, request/response formats
- [Event Flow](docs/event-flow.md) - Event-driven architecture and message flows
- [Data Models](docs/data-models.md) - Database schemas and Elasticsearch mappings
- [Multi-tenant Implementation](docs/multi-tenancy.md) - Multi-tenancy approach
- [Security Considerations](docs/security.md) - Authentication, authorization, and data protection
- [Performance Optimizations](docs/performance.md) - Database, caching, and query optimizations

## Development

### Project Structure

```
message-management-system/
├── docs/
│   ├── api-design.md
│   ├── architecture.md
│   ├── data-models.md
│   ├── domain-model.md
│   ├── event-flow.md
│   ├── multi-tenancy.md
│   ├── performance.md
│   ├── security.md
├── src/
│   ├── common/
│   │   ├── common.module.ts
│   │   ├── contexts/
│   │   │   └── tenant.context.ts
│   │   ├── dto/
│   │   │   ├── pagination-response.dto.ts
│   │   │   └── pagination.dto.ts
│   │   ├── filters/
│   │   │   └── global-exception.filter.ts
│   │   ├── guards/
│   │   │   └── auth.guard.ts
│   │   ├── interceptor/
│   │   │   └── transform.interceptor.ts
│   │   └── middlewares/
│   │       ├── logger.middleware.ts
│   │       └── tenant.middleware.ts
│   ├── config/
│   │   └── configuration.ts
│   ├── elastic-consumer/
│   │   ├── elastic-consumer.module.ts
│   │   └── message.consumer.ts
│   ├── message/
│   │   ├── controllers/
│   │   │   └── message.controller.ts
│   │   ├── dto/
│   │   │   ├── create-message.dto.ts
│   │   │   ├── message-response.dto.ts
│   │   │   └── update-message.dto.ts
│   │   ├── entities/
│   │   │   ├── message.entity.spec.ts
│   │   │   └── message.entity.ts
│   │   ├── message.module.ts
│   │   ├── repositories/
│   │   │   ├── message.repository.interface.ts
│   │   │   └── mongodb-message.repository.ts
│   │   ├── schemas/
│   │   │   └── message.schema.ts
│   │   └── services/
│   │       ├── message-application.service.spec.ts
│   │       ├── message-application.service.ts
│   │       └── message-producer.service.ts
│   ├── search/
│   │   ├── controllers/
│   │   │   └── search.controller.ts
│   │   ├── dto/
│   │   │   └── search-query.dto.ts
│   │   ├── search.module.ts
│   │   └── services/
│   │       ├── search-application.service.spec.ts
│   │       └── search-application.service.ts
│   ├── shared/
│   │   ├── elasticsearch/
│   │   │   ├── elasticsearch.service.ts
│   │   │   └── message.mapping.ts
│   │   ├── kafka/
│   │   │   ├── base.consumer.ts
│   │   │   └── base.producer.ts
│   │   ├── redis/
│   │   │   ├── redis.module.ts
│   │   │   └── redis.service.ts
│   │   └── shared.module.ts
│   ├── app.module.ts
│   └── main.ts
├── test/
│   ├── jest-e2e.json
│   ├── load-test.yaml
│   ├── messages.e2e-spec.ts
│   └── search.e2e-spec.ts
├── .env
├── .gitignore
├── .prettierrc
├── docker-compose.yml
├── eslint.config.mjs
├── nest-cli.json
├── package-lock.json
├── package.json
├── README.md
├── tsconfig.build.json
└── tsconfig.json
```

### Testing

```bash
# Run unit tests
npm run test

# Run e2e tests
npm run test:e2e

# Run load tests
cd test && artillery run load-test.yaml
```

## Deployment

The application can be deployed using Docker Compose for development environments or Kubernetes for production.

### Environment Variables

Key environment variables:

- `PORT` - Application port (default: 3000)
- `MONGODB_URI` - MongoDB connection string
- `KAFKA_BROKERS` - Comma-separated list of Kafka brokers
- `ELASTICSEARCH_NODE` - Elasticsearch node URL
- `REDIS_HOST` - Redis host for caching
- `REDIS_PORT` - Redis port (default: 6379)
- `REDIS_PASSWORD` - Redis password (if applicable)
- `REDIS_TTL` - Default cache TTL in seconds

For a complete list, see the configuration file.

## License

[MIT License](LICENSE)
