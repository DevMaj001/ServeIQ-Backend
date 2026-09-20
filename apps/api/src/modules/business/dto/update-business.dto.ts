import {
  IsOptional,
  IsString,
  IsNumber,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBusinessDto {
  @ApiPropertyOptional({ example: 'ServeIQ Lounge', description: 'Business name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'hello@serveiq.io', description: 'Contact email' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: '+2348012345678', description: 'Contact phone' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: '14 Admiralty Way, Lekki', description: 'Business address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'NG', description: 'Country code' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 'NGN', description: 'Default currency' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 7.5, description: 'Tax rate percent (0-100)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  tax_rate?: number;

  @ApiPropertyOptional({ example: 15, description: 'VIP table surcharge percent (-100 to 400)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-100)
  @Max(400)
  vip_surcharge_percent?: number;

  @ApiPropertyOptional({ example: 10, description: 'Service charge percent (0-100)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  service_charge_percent?: number;

  @ApiPropertyOptional({ example: 5000, description: 'Minimum order amount to qualify for discounts (in minor units)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  discount_min_order_amount?: number;

  @ApiPropertyOptional({ example: 'Africa/Lagos', description: 'IANA timezone' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ description: 'Business logo URL' })
  @IsOptional()
  @IsString()
  logo_url?: string;

  @ApiPropertyOptional({ example: '#7C3AED', description: 'Brand primary color (hex)' })
  @IsOptional()
  @IsString()
  brand_primary_color?: string;

  @ApiPropertyOptional({ example: '#10B981', description: 'Brand accent color (hex)' })
  @IsOptional()
  @IsString()
  brand_accent_color?: string;
}