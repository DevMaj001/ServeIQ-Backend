import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CancelOrderDto {
  @ApiProperty({
    example: 'Customer changed their mind',
    description: 'Reason for cancelling the order item',
  })
  @IsNotEmpty()
  @IsString()
  cancel_reason: string;
}