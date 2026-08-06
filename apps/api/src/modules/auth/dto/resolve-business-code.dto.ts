import { IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResolveBusinessCodeDto {
  @ApiProperty({
    example: 'ABC123XY',
    description: 'Business code assigned to the business',
  })
  @IsNotEmpty()
  @IsString()
  @Length(6, 12)
  business_code: string;
}
