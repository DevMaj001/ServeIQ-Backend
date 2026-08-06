import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReportQueryDto {
  @ApiProperty({
    example: 'How did we perform this weekend compared to last week?',
    description: 'Natural language question about business performance',
  })
  @IsNotEmpty()
  @IsString()
  question: string;

  @ApiProperty({ example: '2026-07-01', required: false })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiProperty({ example: '2026-07-10', required: false })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
