import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateLogicDto {
  @ApiProperty({
    example:
      'How to automatically calculate service charge based on party size',
    description: 'The prompt for generating business logic',
  })
  @IsNotEmpty()
  @IsString()
  prompt: string;
}
