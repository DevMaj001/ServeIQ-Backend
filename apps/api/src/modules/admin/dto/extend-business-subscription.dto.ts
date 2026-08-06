import {
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExtendBusinessSubscriptionDto {
  @ApiProperty({
    example: 'uuid-of-business',
    description: 'Business ID to extend subscription for',
  })
  @IsNotEmpty()
  @IsUUID()
  business_id: string;

  @ApiProperty({
    example: 30,
    description: 'Number of days to add from now (default: 30)',
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  days?: number;
}
