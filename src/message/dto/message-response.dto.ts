import { ApiProperty } from '@nestjs/swagger';
import { Message } from '../entities/message.entity';

/**
 * Data Transfer Object for message responses
 */
export class MessageResponseDto {
  @ApiProperty({
    description: 'The unique identifier of the message',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'The ID of the conversation this message belongs to',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  conversationId: string;

  @ApiProperty({
    description: 'The ID of the sender of this message',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  senderId: string;

  @ApiProperty({
    description: 'The content of the message',
    example: 'Hello, how are you?',
  })
  content: string;

  @ApiProperty({
    description: 'The timestamp when the message was created',
    example: '2023-08-15T10:30:00Z',
  })
  timestamp: Date;

  @ApiProperty({
    description: 'Additional metadata for the message',
    example: {
      key1: 'value1',
      key2: 'value2',
    },
    required: false,
  })
  metadata?: Record<string, any>;

  /**
   * Creates a MessageResponseDto from a Message entity
   */
  static fromEntity(message: Message): MessageResponseDto {
    const dto = new MessageResponseDto();
    dto.id = message.id;
    dto.conversationId = message.conversationId;
    dto.senderId = message.senderId;
    dto.content = message.content;
    dto.timestamp = message.timestamp;
    dto.metadata = message.metadata;

    return dto;
  }
}
