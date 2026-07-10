
import { IsNotEmpty, IsString, IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMenuItemDto {
  @ApiProperty({ example: 'Heineken' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Drinks' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ example: 5000, description: 'Price in kobo (1 NGN = 100 kobo)', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price_kobo?: number;

  @ApiProperty({ example: 50, description: 'Price in Naira', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiProperty({ example: 'bottle', required: false })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiProperty({ example: 'SKU123', required: false })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiProperty({ example: 'BAR123', required: false })
  @IsString()
  @IsOptional()
  barcode?: string;

  @ApiProperty({ example: 'https://example.com/image.jpg', required: false })
  @IsString()
  @IsOptional()
  image_url?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  is_available?: boolean;

  @ApiProperty({ example: 50, description: 'Current stock quantity', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  quantity_in_stock?: number;

  @ApiProperty({ example: 10, description: 'Reorder level threshold', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  reorder_level?: number;

  @ApiProperty({ example: 2000, description: 'Cost price in kobo', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  cost_price_kobo?: number;

  @ApiProperty({ example: true, description: 'Whether to track stock for this item', required: false })
  @IsBoolean()
  @IsOptional()
  track_stock?: boolean;

  @ApiProperty({ example: 'uuid-of-supplier', required: false })
  @IsString()
  @IsOptional()
  supplier_id?: string;
}
