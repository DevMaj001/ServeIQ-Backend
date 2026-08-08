import { IsNotEmpty, IsString } from 'class-validator';
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
}
