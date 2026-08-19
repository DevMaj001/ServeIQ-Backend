import {
  IsInt,
  Min,
  IsOptional,
  IsString,
  IsArray,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OpenShiftDto {
  @ApiProperty({ example: 50000, description: 'Starting cash in kobo' })
  @IsInt()
  @Min(0)
  starting_cash_kobo: number;

  @ApiPropertyOptional({ example: 'Morning shift' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'Optional shift template id' })
  @IsOptional()
  @IsUUID()
  template_id?: string;

  @ApiPropertyOptional({ example: '07:00', description: 'HH:mm format' })
  @IsOptional()
  @IsString()
  scheduled_start_time?: string;

  @ApiPropertyOptional({ example: '15:00', description: 'HH:mm format' })
  @IsOptional()
  @IsString()
  scheduled_end_time?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Staff user ids assigned to this shift',
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  assigned_staff_ids?: string[];
}