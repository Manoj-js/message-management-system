# Architecture Overview

## System Architecture

This system follows a Domain-Driven Design (DDD) approach implemented as a modular monolith. The architecture separates concerns into well-defined modules while maintaining the deployment simplicity of a monolithic application.

```mermaid
flowchart TD
%% Client Side
Client[Client Applications]

%% API Layer
API[API - NestJS]

%% Service Layer
MessageService[Message Service]
SearchService[Search Service]

%% Cache Layer
Redis[(Redis Cache)]

%% Databases
MongoDB[(MongoDB)]
Elasticsearch[(Elasticsearch)]

%% Message Broker
Kafka[Kafka]

%% Flows
Client -->|HTTP/WS| API
API --> MessageService
API --> SearchService

%% Cache Flows
MessageService <-->|Read/Write| Redis
SearchService <-->|Read/Write| Redis

%% Database Flows
MessageService --> MongoDB
SearchService --> Elasticsearch

%% Event Flows
MessageService -->|Publish Events| Kafka
Kafka -->|Index Data| Elasticsearch


```

The architecture introduces Redis as a distributed caching layer that sits between the service layer and the databases. This provides significant performance improvements by reducing database load and serving frequently accessed data directly from memory.
