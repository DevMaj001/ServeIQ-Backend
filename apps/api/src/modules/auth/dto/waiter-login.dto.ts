import { IsNotEmpty, IsString, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WaiterLoginDto {
  @ApiProperty({ example: '1234', description: '4-digit PIN assigned to the waiter by admin' })
  @IsNotEmpty()
  @IsString()
  pin: string;

  @ApiPropertyOptional({ example: 'uuid-of-branch', description: 'Branch ID the waiter belongs to (optional if businessId is provided)' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ example: 'uuid-of-business', description: 'Business ID (used when resolving from business code)' })
  @IsOptional()
  @IsUUID()
  businessId?: string;
}
