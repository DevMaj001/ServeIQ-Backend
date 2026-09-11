import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export interface PaymentProviderConfig {
  name: string;
  type: 'manual' | 'webhook';
  label: string;
  verification_method?: 'hmac-sha512' | 'rsa' | 'none';
  config: Record<string, string>;
}

export class BranchPaymentSettingsDto {
  @ApiProperty({ type: String, example: 'manual', required: false })
  @IsOptional()
  @IsString()
  payment_provider?: string;

  @ApiProperty({ type: [String], example: ['manual'], required: false })
  @IsOptional()
  enabled_providers?: string[];

  @ApiProperty({ type: [Object], required: false })
  @IsOptional()
  payment_providers?: PaymentProviderConfig[];

  @ApiProperty({
    example: 'prepay',
    description: 'Takeaway payment policy: prepay | pay_on_pickup',
    required: false,
  })
  @IsOptional()
  @IsString()
  takeaway_payment_policy?: string;
}

export class BranchDeliverySettingsDto {
  @ApiProperty({
    example: true,
    description: 'Enable dispatch delivery',
    required: false,
  })
  @IsOptional()
  enabled?: boolean;

  @ApiProperty({
    example: 120000,
    description: 'Flat fee charged to the customer in kobo',
    required: false,
  })
  @IsOptional()
  fee_kobo?: number;

  @ApiProperty({
    example: 100000,
    description: 'Flat payout per drop to the rider in kobo',
    required: false,
  })
  @IsOptional()
  rider_payout_kobo?: number;
}

export class UpdateBranchSettingsDto {
  @ApiProperty({ type: BranchPaymentSettingsDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => BranchPaymentSettingsDto)
  settings?: BranchPaymentSettingsDto;

  @ApiProperty({ type: BranchDeliverySettingsDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => BranchDeliverySettingsDto)
  delivery?: BranchDeliverySettingsDto;
}
