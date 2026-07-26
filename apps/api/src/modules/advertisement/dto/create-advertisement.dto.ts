import { IsNotEmpty, IsString, IsOptional, IsBoolean, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAdvertisementDto {
  @ApiProperty({ example: 'https://example.com/ad-banner.jpg' })
  @IsNotEmpty()
  @IsString()
  image_url: string;

  @ApiPropertyOptional({ example: 'https://example.com/promo' })
  @IsOptional()
  @IsString()
  link_url?: string;

  @ApiPropertyOptional({ example: 'Summer Sale' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  sort_order?: number;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsString()
  branch_id?: string;
}
