import {
  IsString,
  IsOptional,
  IsArray,
  IsInt,
  IsIn,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const SHIFT_TYPES = ['morning', 'evening', 'night', 'split', 'custom'] as const;

export class CreateShiftTemplateDto {
  @ApiProperty({ example: 'Morning Shift' })
  @IsString()
  @MaxLength(80)
  name: string;

  @ApiProperty({ enum: SHIFT_TYPES, example: 'morning' })
  @IsIn(SHIFT_TYPES)
  type: string;

  @ApiProperty({ example: '07:00', description: 'HH:mm format' })
  @IsString()
  scheduled_start_time: string;

  @ApiProperty({ example: '15:00', description: 'HH:mm format' })
  @IsString()
  scheduled_end_time: string;

  @ApiProperty({
    type: [Number],
    example: [1, 2, 3, 4, 5],
    description: '0=Sun, 1=Mon ... 6=Sat',
  })
  @IsArray()
  @IsInt({ each: true })
  days_of_week: number[];

  @ApiPropertyOptional({ example: '#22c55e', description: 'Hex color' })
  @IsOptional()
  @IsString()
  color?: string;
}

export class UpdateShiftTemplateDto {
  @ApiPropertyOptional({ example: 'Morning Shift' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ enum: SHIFT_TYPES, example: 'morning' })
  @IsOptional()
  @IsIn(SHIFT_TYPES)
  type?: string;

  @ApiPropertyOptional({ example: '07:00', description: 'HH:mm format' })
  @IsOptional()
  @IsString()
  scheduled_start_time?: string;

  @ApiPropertyOptional({ example: '15:00', description: 'HH:mm format' })
  @IsOptional()
  @IsString()
  scheduled_end_time?: string;

  @ApiPropertyOptional({
    type: [Number],
    example: [1, 2, 3, 4, 5],
    description: '0=Sun, 1=Mon ... 6=Sat',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  days_of_week?: number[];

  @ApiPropertyOptional({ example: '#22c55e', description: 'Hex color' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsInt()
  is_active?: number;
}