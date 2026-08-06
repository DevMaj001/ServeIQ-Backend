import { IsNumber, IsOptional, Min, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ModifierSelectionDto } from './create-order-item.dto';

export class UpdateOrderDto {
  @ApiProperty({ example: 5, minimum: 1 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ type: [ModifierSelectionDto], required: false })
  @IsOptional()
  modifiers?: ModifierSelectionDto[];
}
