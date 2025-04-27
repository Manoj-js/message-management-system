import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Delete,
  Query,
  ValidationPipe,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiSecurity,
  ApiQuery,
} from '@nestjs/swagger';
import { CreateMessageDto } from '../dto/create-message.dto';
import { MessageResponseDto } from '../dto/message-response.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { MessageApplicationService } from '../services/message-application.service';
import { UpdateMessageDto } from '../dto/update-message.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination-response.dto';

/**
 * Message Controller
 *
 * Implements API endpoints for message management as specified in the API Design Document.
 * Provides functionality for creating, reading, updating and deleting messages.
 */
@ApiTags('Messages')
@ApiBearerAuth('JWT-auth')
@ApiSecurity('tenant-id')
@Controller({ path: 'api', version: ['1'] })
export class MessageController {
  private readonly logger = new Logger(MessageController.name);

  constructor(
    private readonly messageApplicationService: MessageApplicationService,
  ) {
    this.logger.log('MessageController initialized');
  }

  /**
   * Create a new message
   *
   * Creates a new message and stores it in the database, then publishes a message event to Kafka.
   * Requires tenant ID header (x-tenant-id).
   */
  @Post('messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new message',
    description:
      'Creates a new message and stores it in the database, then publishes a message event to Kafka. Requires tenant ID header (x-tenant-id).',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The message has been successfully created.',
    type: MessageResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden - Missing or invalid tenant ID',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Server error.',
  })
  async createMessage(
    @Body() createMessageDto: CreateMessageDto,
  ): Promise<MessageResponseDto> {
    this.logger.debug(`Creating message: ${JSON.stringify(createMessageDto)}`);

    const message =
      await this.messageApplicationService.createMessage(createMessageDto);

    this.logger.log(`Message created with ID: ${message.id}`);
    return MessageResponseDto.fromEntity(message);
  }

  /**
   * Get a specific message by ID
   *
   * Retrieves a single message by its ID.
   * Requires tenant ID header (x-tenant-id).
   */
  @Get('messages/:id')
  @ApiOperation({
    summary: 'Get a message by ID',
    description:
      'Retrieves a specific message by its ID. Requires tenant ID header (x-tenant-id).',
  })
  @ApiParam({
    name: 'id',
    description: 'The ID of the message',
    type: String,
    required: true,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Message retrieved successfully.',
    type: MessageResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Message not found.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Server error.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden - Missing or invalid tenant ID',
  })
  async getMessageById(@Param('id') id: string): Promise<MessageResponseDto> {
    this.logger.debug(`Retrieving message with ID: ${id}`);

    const message = await this.messageApplicationService.getMessageById(id);

    if (!message) {
      this.logger.warn(`Message with ID: ${id} not found`);
      throw new NotFoundException(`Message with ID "${id}" not found`);
    }

    this.logger.log(`Retrieved message with ID: ${id}`);
    return MessageResponseDto.fromEntity(message);
  }

  /**
   * Update a message
   *
   * Updates an existing message by its ID.
   * Requires tenant ID header (x-tenant-id).
   */
  @Put('messages/:id')
  @ApiOperation({
    summary: 'Update a message',
    description:
      'Updates an existing message by its ID. Requires tenant ID header (x-tenant-id).',
  })
  @ApiParam({
    name: 'id',
    description: 'The ID of the message to update',
    type: String,
    required: true,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The message has been successfully updated.',
    type: MessageResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Message not found.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Server error.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden - Missing or invalid tenant ID',
  })
  async updateMessage(
    @Param('id') id: string,
    @Body() updateMessageDto: UpdateMessageDto,
  ): Promise<MessageResponseDto> {
    this.logger.debug(`Updating message with ID: ${id}`);

    const message = await this.messageApplicationService.updateMessage(
      id,
      updateMessageDto,
    );

    if (!message) {
      this.logger.warn(`Message with ID: ${id} not found`);
      throw new NotFoundException(`Message with ID "${id}" not found`);
    }

    this.logger.log(`Updated message with ID: ${id}`);
    return MessageResponseDto.fromEntity(message);
  }

  /**
   * Delete a message
   *
   * Deletes a message by its ID.
   * Requires tenant ID header (x-tenant-id).
   */
  @Delete('messages/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a message',
    description:
      'Deletes a message by its ID. Requires tenant ID header (x-tenant-id).',
  })
  @ApiParam({
    name: 'id',
    description: 'The ID of the message to delete',
    type: String,
    required: true,
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'The message has been successfully deleted.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Message not found.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Server error.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden - Missing or invalid tenant ID',
  })
  async deleteMessage(@Param('id') id: string): Promise<void> {
    this.logger.debug(`Deleting message with ID: ${id}`);

    const result = await this.messageApplicationService.deleteMessage(id);

    if (!result) {
      this.logger.warn(`Message with ID: ${id} not found`);
      throw new NotFoundException(`Message with ID "${id}" not found`);
    }

    this.logger.log(`Deleted message with ID: ${id}`);
  }

  /**
   * Get messages for a conversation
   *
   * Retrieves messages for a specific conversation with pagination and sorting.
   * Requires tenant ID header (x-tenant-id).
   */
  @Get('conversations/:conversationId/messages')
  @ApiOperation({
    summary: 'Get messages for a conversation',
    description:
      'Retrieves messages for a specific conversation with pagination and sorting. Requires tenant ID header (x-tenant-id).',
  })
  @ApiParam({
    name: 'conversationId',
    description: 'The ID of the conversation',
    type: String,
    required: true,
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number for pagination',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of items per page',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'sortField',
    description: 'Field to sort by',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'sortDirection',
    description: 'Direction to sort (asc or desc)',
    required: false,
    enum: ['asc', 'desc'],
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Messages retrieved successfully.',
    type: PaginatedResponseDto<MessageResponseDto>,
    schema: {
      example: {
        data: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            conversationId: '550e8400-e29b-41d4-a716-446655440001',
            senderId: '550e8400-e29b-41d4-a716-446655440002',
            content: 'Hello, how are you?',
            timestamp: '2023-08-15T10:30:00Z',
            metadata: {
              key1: 'value1',
              key2: 'value2',
            },
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440003',
            conversationId: '550e8400-e29b-41d4-a716-446655440001',
            senderId: '550e8400-e29b-41d4-a716-446655440004',
            content: 'I am doing well, thank you for asking!',
            timestamp: '2023-08-15T10:31:00Z',
            metadata: {
              key1: 'value3',
              key2: 'value4',
            },
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          totalItems: 42,
          totalPages: 5,
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request parameters.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Conversation not found.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Server error.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden - Missing or invalid tenant ID',
  })
  async getMessagesByConversation(
    @Param('conversationId') conversationId: string,
    @Query(new ValidationPipe({ transform: true }))
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<MessageResponseDto>> {
    this.logger.debug(
      `Getting messages for conversation: ${conversationId} with pagination: ${JSON.stringify(paginationDto)}`,
    );

    const { page = 1, limit = 10, sortField, sortDirection } = paginationDto;

    const result =
      await this.messageApplicationService.getMessagesByConversation(
        conversationId,
        {
          page,
          limit,
          sort:
            sortField && sortDirection
              ? { field: sortField, direction: sortDirection }
              : undefined,
        },
      );

    // Calculate total pages
    const totalPages = Math.ceil(result.total / limit);

    this.logger.log(
      `Retrieved ${result.messages.length} messages for conversation: ${conversationId} (total: ${result.total})`,
    );

    // Transform to response DTO
    return {
      data: result.messages.map((message) =>
        MessageResponseDto.fromEntity(message),
      ),
      pagination: {
        totalItems: result.total,
        page,
        limit,
        totalPages,
      },
    };
  }
}
