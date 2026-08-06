import { IsString, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTabDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  customer_name?: string;

  @ApiProperty({ example: 4, required: false, minimum: 1 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  party_size?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
