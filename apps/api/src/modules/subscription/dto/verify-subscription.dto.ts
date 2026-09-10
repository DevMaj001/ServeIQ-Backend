import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifySubscriptionDto {
  @ApiProperty({
    example: '9ps0x1jmtk7wf02',
    description: 'Paystack transaction reference returned from initialize',
  })
  @IsNotEmpty()
  @IsString()
  reference: string;
}