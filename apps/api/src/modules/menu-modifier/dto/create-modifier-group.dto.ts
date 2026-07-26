import { IsNotEmpty, IsString, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateModifierGroupDto {
  @ApiProperty({ example: 'Size' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  min_select?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  max_select?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  sort_order?: number;
}
