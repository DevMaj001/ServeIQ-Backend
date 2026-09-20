import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PayoutProvider } from '../entities/rider-payout.entity';

export class ProcessRiderPayoutDto {
  @ApiPropertyOptional({
    enum: PayoutProvider,
    default: PayoutProvider.MANUAL,
    description: 'Payout provider (manual, paystack or flutterwave)',
  })
  @IsOptional()
  @IsIn(Object.values(PayoutProvider))
  provider?: PayoutProvider;

  @ApiPropertyOptional({
    example: 'pay_batch_abc123',
    description:
      'Provider batch reference (required when provider is not manual)',
  })
  @IsOptional()
  @IsString()
  providerBatchId?: string;
}

export class CompletePayoutBatchDto {
  @ApiProperty({
    example: 'pay_batch_abc123',
    description:
      'Reference returned by the payout provider after the transfer succeeds',
  })
  @IsString()
  providerBatchId: string;
}

export class FailPayoutBatchDto {
  @ApiProperty({
    example: 'Insufficient balance',
    description: 'Reason the payout batch failed',
  })
  @IsString()
  reason: string;
}
