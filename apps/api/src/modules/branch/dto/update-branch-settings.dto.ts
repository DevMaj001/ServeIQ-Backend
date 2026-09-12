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

export class BranchReservationSettingsDto {
  @ApiProperty({ example: true, description: 'Enable table reservations', required: false })
  @IsOptional()
  enabled?: boolean;

  @ApiProperty({ example: true, description: 'Allow online booking on the public menu', required: false })
  @IsOptional()
  allow_online?: boolean;

  @ApiProperty({ example: true, description: 'Auto-confirm public bookings', required: false })
  @IsOptional()
  auto_confirm?: boolean;

  @ApiProperty({ example: false, description: 'Require confirmation before seating', required: false })
  @IsOptional()
  require_confirmation?: boolean;

  @ApiProperty({ example: '11:00', description: 'Opening time HH:mm', required: false })
  @IsOptional()
  @IsString()
  opening_time?: string;

  @ApiProperty({ example: '22:00', description: 'Closing time HH:mm', required: false })
  @IsOptional()
  @IsString()
  closing_time?: string;

  @ApiProperty({ example: 8, description: 'Maximum party size', required: false })
  @IsOptional()
  max_party_size?: number;

  @ApiProperty({ example: 30, description: 'Days in advance customers can book', required: false })
  @IsOptional()
  advance_days?: number;

  @ApiProperty({ example: 90, description: 'Default booking duration in minutes', required: false })
  @IsOptional()
  default_duration_minutes?: number;

  @ApiProperty({ example: 30, description: 'Availability slot interval in minutes', required: false })
  @IsOptional()
  slot_interval_minutes?: number;
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

  @ApiProperty({ type: BranchReservationSettingsDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => BranchReservationSettingsDto)
  reservation?: BranchReservationSettingsDto;
}
