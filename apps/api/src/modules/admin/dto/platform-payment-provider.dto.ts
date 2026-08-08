import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

const PAYMENT_TYPES = ['manual', 'webhook'] as const;
const VERIFICATION_METHODS = ['hmac-sha512', 'rsa', 'none'] as const;

export class CreatePlatformPaymentProviderDto {
  @ApiProperty({ example: 'stripe' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ example: 'Stripe' })
  @IsString()
  @MinLength(1)
  label: string;

  @ApiProperty({ enum: ['manual', 'webhook'], default: 'manual' })
  @IsIn(PAYMENT_TYPES)
  type: 'manual' | 'webhook';

  @ApiPropertyOptional({ enum: ['hmac-sha512', 'rsa', 'none'] })
  @IsOptional()
  @IsIn(VERIFICATION_METHODS)
  verification_method?: 'hmac-sha512' | 'rsa' | 'none';

  @ApiPropertyOptional({ type: Object, default: {} })
  @IsOptional()
  @IsObject()
  config?: Record<string, string>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdatePlatformPaymentProviderDto {
  @ApiPropertyOptional({ example: 'Stripe' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ enum: ['manual', 'webhook'] })
  @IsOptional()
  @IsIn(PAYMENT_TYPES)
  type?: 'manual' | 'webhook';

  @ApiPropertyOptional({ enum: ['hmac-sha512', 'rsa', 'none'] })
  @IsOptional()
  @IsIn(VERIFICATION_METHODS)
  verification_method?: 'hmac-sha512' | 'rsa' | 'none';

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  config?: Record<string, string>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
