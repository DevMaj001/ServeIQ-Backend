import { IsInt, Min, Max, IsArray, ValidateNested, IsUUID, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BillSplitEvenlyDto {
  @ApiProperty({
    example: 3,
    description: 'Number of ways to split the bill evenly',
  })
  @IsInt()
  @Min(2)
  @Max(20)
  splits: number;
}

export class BillSplitAllocationDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'Array of order UUIDs to assign to this split',
    example: ['uuid1', 'uuid2'],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  order_ids: string[];

  @ApiPropertyOptional({
    example: 'Person A',
    description: 'Optional label for this split',
  })
  label?: string;
}

export class BillSplitByItemDto {
  @ApiProperty({
    type: [BillSplitAllocationDto],
    description: 'Array of item allocations for each split',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillSplitAllocationDto)
  allocations: BillSplitAllocationDto[];
}