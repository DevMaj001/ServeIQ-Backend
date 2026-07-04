import { IsNotEmpty, IsUUID, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminGrantDto {
  @ApiProperty({ example: 'uuid-of-branch', description: 'Branch ID to grant subscription to' })
  @IsNotEmpty()
  @IsUUID()
  branch_id: string;

  @ApiProperty({ example: 'uuid-of-plan', description: 'Plan ID' })
  @IsNotEmpty()
  @IsUUID()
  plan_id: string;

  @ApiProperty({ example: '2026-08-01T00:00:00Z', description: 'Override current_period_end', required: false })
  @IsOptional()
  @IsDateString()
  current_period_end?: string;
}
