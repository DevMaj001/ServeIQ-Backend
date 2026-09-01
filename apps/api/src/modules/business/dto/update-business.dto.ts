import {
  IsOptional,
  IsString,
  IsNumber,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateBusinessDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  tax_rate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-100)
  @Max(400)
  vip_surcharge_percent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  service_charge_percent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  discount_min_order_amount?: number;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  logo_url?: string;

  @IsOptional()
  @IsString()
  brand_primary_color?: string;

  @IsOptional()
  @IsString()
  brand_accent_color?: string;
}
