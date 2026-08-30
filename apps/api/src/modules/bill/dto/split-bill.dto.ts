import { IsInt, Min, Max, IsArray, ValidateNested, IsUUID, IsOptional, IsEnum, IsNumber, IsString } from 'class-validator';
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

export enum AllocationTypeDto {
  ITEM = 'item',
  REMAINING = 'remaining',
  PERCENTAGE = 'percentage',
  AMOUNT = 'amount',
}

export class PaymentPlanAllocationDto {
  @ApiProperty({
    enum: AllocationTypeDto,
    description: 'Type of allocation: specific items, remaining balance, percentage, or fixed amount',
  })
  @IsEnum(AllocationTypeDto)
  type: AllocationTypeDto;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Order UUIDs for type=item',
    example: ['uuid1', 'uuid2'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  order_ids?: string[];

  @ApiPropertyOptional({
    example: 'Host',
    description: 'Label for this allocation (e.g., person name)',
  })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({
    example: 50,
    description: 'Percentage value for type=percentage (0-100)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage?: number;

  @ApiPropertyOptional({
    example: 5000,
    description: 'Fixed amount in kobo for type=amount',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount_kobo?: number;
}

export class CreatePaymentPlanDto {
  @ApiProperty({
    type: [PaymentPlanAllocationDto],
    description: 'Ordered list of payment allocations. First entry pays first, remainder flows to next.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentPlanAllocationDto)
  allocations: PaymentPlanAllocationDto[];
}