import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TabType } from '../../../common/shared';

export class OpenTabDto {
  @ApiProperty({
    example: 'table-uuid-123',
    description: 'UUID of the table where the tab is opened',
  })
  @ValidateIf((o: OpenTabDto) => o.tab_type !== TabType.TAKEAWAY)
  @IsNotEmpty()
  @IsString()
  table_id: string;

  @ApiProperty({
    example: 'dine_in',
    enum: TabType,
    default: TabType.DINE_IN,
    required: false,
  })
  @IsOptional()
  @IsEnum(TabType)
  tab_type?: TabType;

  @ApiProperty({
    example: 'John Doe',
    description: 'Name of the customer (optional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  customer_name?: string;

  @ApiProperty({
    example: 4,
    description: 'Number of people in the party',
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  party_size?: number;

  @ApiProperty({
    example: 'Sitting near the window',
    description: 'Special notes for the tab',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
