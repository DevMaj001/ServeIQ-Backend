import { IsNotEmpty, IsString, IsNumber, IsOptional, IsArray, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { FulfillmentType } from '../../../common/shared';

export class ModifierSelectionDto {
  @ApiProperty({ example: 'modifier-option-uuid' })
  @IsNotEmpty()
  @IsString()
  id: string;

  @ApiProperty({ example: 'Extra Cheese' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 500, description: 'Price in kobo' })
  @IsNumber()
  price_kobo: number;

  @ApiProperty({ example: 1 })
  @IsNumber()
  qty: number;
}

export class CreateOrderItemDto {
  @ApiProperty({ example: 'menu-item-uuid-123', description: 'UUID of the menu item' })
  @IsNotEmpty()
  @IsString()
  menu_item_id: string;

  @ApiProperty({ example: 2, description: 'Quantity ordered' })
  @IsNotEmpty()
  @IsNumber()
  quantity: number;

  @ApiProperty({ example: 'No onions', description: 'Special instructions for this item', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [ModifierSelectionDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModifierSelectionDto)
  modifiers?: ModifierSelectionDto[];

  @ApiProperty({ example: 'pack', enum: FulfillmentType, required: false, description: 'Override fulfillment type per item. Defaults based on tab type (pack for takeaway, serve for dine-in).' })
  @IsOptional()
  @IsEnum(FulfillmentType)
  fulfillment_type?: FulfillmentType;
}
