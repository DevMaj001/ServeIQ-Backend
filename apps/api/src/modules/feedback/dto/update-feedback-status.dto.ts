import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminFeedbackUpdateStatusDto {
  @ApiProperty({
    enum: ['open', 'in_review', 'resolved'],
    example: 'in_review',
  })
  @IsString()
  @IsEnum(['open', 'in_review', 'resolved'])
  status: string;

  @ApiPropertyOptional({
    example: 'Reviewed and responded',
  })
  @IsOptional()
  @IsString()
  admin_notes?: string;
}