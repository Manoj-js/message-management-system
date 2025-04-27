import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * DTO for handling search queries with pagination
 */
export class SearchQueryDto {
  /**
   * Page number for pagination (1-based indexing).
   *
   * @default 1
   * @minimum 1
   */
  @ApiProperty({
    description: 'Page number for pagination (1-based indexing)',
    default: 1,
    required: false,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page: number = 1;

  /**
   * Number of items per page.
   *
   * @default 10
   * @minimum 1
   */
  @ApiProperty({
    description: 'Number of items to retrieve per page',
    default: 10,
    required: false,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit: number = 10;

  /**
   * Keyword or phrase to search for in the message content.
   *
   * @example "important"
   */
  @ApiProperty({
    description: 'Search term to look for in message content',
    example: 'important',
  })
  @IsString()
  @IsNotEmpty()
  q: string;
}
