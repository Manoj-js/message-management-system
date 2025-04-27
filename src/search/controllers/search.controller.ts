import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { SearchApplicationService } from '../services/search-application.service';
import { SearchQueryDto } from '../dto/search-query.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination-response.dto';
import { MessageResponseDto } from 'src/message/dto/message-response.dto';

/**
 * Controller handling conversation message search operations
 */
@ApiTags('Search')
@ApiBearerAuth('JWT-auth')
@ApiSecurity('tenant-id')
@Controller({ path: 'api/conversations', version: ['1'] })
export class SearchController {
  /**
   * Creates an instance of SearchController
   *
   * @param searchApplicationService - Service handling search business logic
   */
  constructor(
    private readonly searchApplicationService: SearchApplicationService,
  ) {}

  /**
   * Search for messages within a conversation
   *
   * @param conversationId - The ID of the conversation to search within
   * @param searchQueryDto - The search criteria and pagination options
   * @returns Paginated list of messages matching the search criteria
   */
  @Get(':conversationId/messages/search')
  @ApiOperation({ summary: 'Search messages in a conversation' })
  @ApiParam({
    name: 'conversationId',
    description: 'The ID of the conversation',
    type: String,
    required: true,
  })
  @ApiQuery({
    name: 'q',
    description: 'Search query string',
    type: String,
    required: true,
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number (1-based)',
    type: Number,
    required: false,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of results per page',
    type: Number,
    required: false,
    example: 10,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Messages found successfully',
    type: PaginatedResponseDto,
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
    description: 'Invalid request parameters',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Missing or invalid token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden - Missing or invalid tenant ID',
  })
  async searchMessages(
    @Param('conversationId') conversationId: string,
    @Query(new ValidationPipe({ transform: true }))
    searchQueryDto: SearchQueryDto,
  ): Promise<PaginatedResponseDto<MessageResponseDto>> {
    const { q, page, limit } = searchQueryDto;
    return this.searchApplicationService.searchMessages(conversationId, q, {
      page,
      limit,
    });
  }
}
