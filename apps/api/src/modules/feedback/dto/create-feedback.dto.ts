import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFeedbackDto {
  @ApiProperty({
    example: 'bug',
    enum: ['bug', 'feature', 'ux', 'performance', 'other'],
  })
  @IsIn(['bug', 'feature', 'ux', 'performance', 'other'])
  @IsNotEmpty()
  category: string;

  @ApiProperty({ example: 'Unable to print receipt on Android tablet' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message: string;

  @ApiProperty({ required: false, example: 'data:image/png;base64,...' })
  @IsString()
  @IsOptional()
  screenshot?: string;

  @ApiProperty({ required: false, example: '/pos/order/123' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  url?: string;

  @ApiProperty({ required: false, example: 'Mozilla/5.0 ...' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  userAgent?: string;
}
