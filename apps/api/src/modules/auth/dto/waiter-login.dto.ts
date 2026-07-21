import { IsNotEmpty, IsString, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WaiterLoginDto {
  @ApiProperty({ example: '1234', description: '4-digit PIN assigned to the waiter by admin' })
  @IsNotEmpty()
  @IsString()
  pin: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ example: 'uuid-from-resolve-business', description: 'Business UUID (call POST /auth/resolve-business first to get this)' })
  @IsOptional()
  @IsUUID()
  businessId?: string;
}
