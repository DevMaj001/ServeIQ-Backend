import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeclineOrderDto {
  @ApiProperty({ example: 'Out of stock', description: 'Reason for declining the order' })
  @IsNotEmpty()
  @IsString()
  decline_reason: string;
}
