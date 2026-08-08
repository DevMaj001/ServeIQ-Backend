import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { BillingInterval } from '../entities/plan.entity';

const BILLING_INTERVALS = ['monthly', 'yearly'] as const;

export class CreatePlanDto {
  @ApiProperty({ example: 'Pro' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ example: 3500000, description: 'Price in kobo/cents' })
  @IsInt()
  @Min(0)
  price: number;

  @ApiProperty({ example: 'NGN' })
  @IsString()
  @MinLength(3)
  @IsIn(['NGN', 'USD', 'GBP', 'EUR'])
  currency: string;

  @ApiProperty({ enum: BILLING_INTERVALS })
  @IsIn(BILLING_INTERVALS)
  billing_interval: BillingInterval;

  @ApiPropertyOptional({
    example: { max_tables: 20, max_waiters: 15, reporting_enabled: true },
  })
  @IsOptional()
  features?: Record<string, any>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ example: 'PLN_abc123' })
  @IsOptional()
  @IsString()
  paystack_plan_code?: string;
}

export class UpdatePlanDto {
  @ApiPropertyOptional({ example: 'Pro' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ example: 3500000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 'NGN' })
  @IsOptional()
  @IsString()
  @IsIn(['NGN', 'USD', 'GBP', 'EUR'])
  currency?: string;

  @ApiPropertyOptional({ enum: BILLING_INTERVALS })
  @IsOptional()
  @IsIn(BILLING_INTERVALS)
  billing_interval?: BillingInterval;

  @ApiPropertyOptional({
    example: { max_tables: 20, max_waiters: 15, reporting_enabled: true },
  })
  @IsOptional()
  features?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ example: 'PLN_abc123' })
  @IsOptional()
  @IsString()
  paystack_plan_code?: string;
}
