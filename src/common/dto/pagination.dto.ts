import { IsNumber, IsOptional, IsString, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object for handling pagination parameters.
 *
 * Includes options for paging, sorting field, and sorting direction.
 */
export class PaginationDto {
  /**
   * Page number for pagination (1-based indexing).
   *
   * @default 1
   * @minimum 1
   */
  @ApiProperty({
    description: 'Page number (1-based indexing)',
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
   * Number of items to retrieve per page.
   *
   * @default 10
   * @minimum 1
   */
  @ApiProperty({
    description: 'Number of items per page',
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
   * Field name to sort the results by.
   *
   * @default 'timestamp'
   */
  @ApiProperty({
    description: 'Field to sort by',
    default: 'timestamp',
    required: false,
  })
  @IsOptional()
  @IsString()
  sortField: string = 'timestamp';

  /**
   * Sort direction for results: ascending (`asc`) or descending (`desc`).
   *
   * @default 'desc'
   * @enum ['asc', 'desc']
   */
  @ApiProperty({
    description: 'Sort direction',
    enum: ['asc', 'desc'],
    default: 'desc',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  sortDirection: 'asc' | 'desc' = 'desc';
}
