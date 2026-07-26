import { IsNotEmpty, IsString, IsOptional, IsBoolean, IsNumber, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateModifierOptionDto {
  @ApiProperty({ example: 'Large' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsNumber()
  price_kobo?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  max_qty?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  track_stock?: boolean;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  quantity_in_stock?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  sort_order?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_available?: boolean;
}
