import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PaymentVerificationDto {
  @ApiProperty({
    example: 'tab-uuid-here or tracking code',
    description: 'Tab UUID or tracking code for standalone groups',
  })
  @IsString()
  tab_id: string;

  @ApiProperty({
    example: 'SVQ-ABCD-123',
    description: 'Tracking code from the order',
  })
  @IsString()
  tracking_code: string;
}
