import { IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PaymentVerificationDto {
  @ApiProperty({
    example: 'tab-uuid-here',
    description: 'Tab UUID',
  })
  @IsUUID()
  tab_id: string;

  @ApiProperty({
    example: 'SVQ-ABCD-123',
    description: 'Tracking code from the order',
  })
  @IsString()
  tracking_code: string;
}