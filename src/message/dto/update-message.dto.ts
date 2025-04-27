import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsObject } from 'class-validator';

/**
 * Data Transfer Object for updating a message
 */
export class UpdateMessageDto {
  @ApiProperty({
    description: 'The content of the message',
    example: 'Updated message text',
    required: false,
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({
    description: 'Additional metadata for the message',
    example: { edited: true, editedAt: '2023-08-15T11:30:00Z' },
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
