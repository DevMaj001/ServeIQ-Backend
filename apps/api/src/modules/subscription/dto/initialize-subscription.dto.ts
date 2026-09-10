import { IsNotEmpty, IsString, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InitializeSubscriptionDto {
  @ApiProperty({
    example: 'uuid-of-plan',
    description:
      'Plan ID to subscribe to. Can be a UUID or a fallback identifier like "fallback-pro-NGN"',
  })
  @IsNotEmpty()
  @IsString()
  plan_id: string;

  @ApiProperty({
    example: 'https://app.example.com/payment-success',
    description: 'URL Paystack redirects to after successful payment',
    required: false,
  })
  @IsOptional()
  @IsString()
  callback_url?: string;
}
