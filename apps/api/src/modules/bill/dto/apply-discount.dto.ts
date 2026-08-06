import { IsInt, Min, IsOptional, IsNumber, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ApplyDiscountDto {
  @ApiPropertyOptional({
    description: 'Discount amount in kobo (e.g. 5000 = ₦50)',
    example: 5000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  discount_kobo?: number;

  @ApiPropertyOptional({
    description: 'Discount as percentage of subtotal (e.g. 10 = 10%)',
    example: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discount_percent?: number;
}
