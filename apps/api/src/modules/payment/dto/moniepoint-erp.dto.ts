import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class EnrollMoniepointErpDto {
  @ApiProperty({
    example: 'api-client-19011590-xxxx',
    description: 'Moniepoint client ID from the ERP Integration console screen',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  clientId: string;

  @ApiProperty({
    example: 'your-moniepoint-client-secret',
    description:
      'Moniepoint client API key/secret (stored encrypted, never returned)',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  clientSecret: string;

  @ApiPropertyOptional({ enum: ['SANDBOX', 'PROD'], default: 'SANDBOX' })
  @IsOptional()
  @IsIn(['SANDBOX', 'PROD'])
  environment?: 'SANDBOX' | 'PROD';

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  isActive?: boolean;
}

export class UpdateMoniepointErpDto {
  @ApiPropertyOptional({
    description: 'Rotate the client secret (stored encrypted, never returned)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  clientSecret?: string;

  @ApiPropertyOptional({ enum: ['SANDBOX', 'PROD'] })
  @IsOptional()
  @IsIn(['SANDBOX', 'PROD'])
  environment?: 'SANDBOX' | 'PROD';

  @ApiPropertyOptional()
  @IsOptional()
  isActive?: boolean;
}

export class PushMoniepointPaymentDto {
  @ApiProperty({
    example: 'P260xyz',
    description:
      'Terminal serial as registered on this branch (must exist on a POS terminal of this branch)',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  terminalSerial: string;

  @ApiProperty({
    example: 11000,
    description:
      'Amount in minor units (e.g. kobo); the value is sent to Moniepoint verbatim',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({
    example: 'T20260917-00007',
    description:
      'Unique per-tenant merchant reference. Required unless `billId` is provided — when a bill is linked, this is derived from the bill payment reference so the existing Moniepoint webhook can settle it.',
  })
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  merchantReference?: string;

  @ApiPropertyOptional({
    example: 'd0f2f3b6-9c1a-4f2e-8a5a-123456789012',
    description:
      'Optional bill to link this push to. The merchant reference is then derived from the bill, the amount is expected to match the bill total, and the webhook settlement path marks the bill paid when the guest completes the transaction.',
  })
  @IsOptional()
  @IsUUID()
  billId?: string;

  @ApiPropertyOptional({ enum: ['CARD_PURCHASE', 'POS_TRANSFER', 'ANY'] })
  @IsOptional()
  @IsIn(['CARD_PURCHASE', 'POS_TRANSFER', 'ANY'])
  paymentMethod?: 'CARD_PURCHASE' | 'POS_TRANSFER' | 'ANY';
}
