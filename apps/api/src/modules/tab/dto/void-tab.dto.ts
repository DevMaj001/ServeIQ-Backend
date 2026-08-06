import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VoidTabDto {
  @ApiProperty({
    example: 'Customer walked out',
    description: 'Reason for voiding the tab',
  })
  @IsNotEmpty()
  @IsString()
  reason: string;
}
