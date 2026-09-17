import { IsNotEmpty, IsOptional, IsString, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNotificationDto {
  @ApiProperty({ example: 'b0dd20c5-2d3e-4aaa-b982-a16a4e564bff', description: 'Branch receiving the notification' })
  @IsNotEmpty()
  @IsString()
  branch_id: string;

  @ApiPropertyOptional({ description: 'Recipient user ID; omit for a branch-wide broadcast' })
  @IsOptional()
  @IsString()
  user_id?: string | null;

  @ApiProperty({ example: 'order_ready', description: 'Notification type' })
  @IsNotEmpty()
  @IsString()
  type: string;

  @ApiProperty({ example: 'Order ready', description: 'Notification title' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ example: 'Your order TRK-123 is ready', description: 'Notification message' })
  @IsNotEmpty()
  @IsString()
  message: string;

  @ApiPropertyOptional({ description: 'Arbitrary payload attached to the notification' })
  @IsOptional()
  @IsObject()
  data?: any;
}