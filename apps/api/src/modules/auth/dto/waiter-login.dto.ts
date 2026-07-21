import { IsNotEmpty, IsString, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class WaiterLoginDto {
  @ApiProperty({ example: '1234', description: '4-digit PIN assigned to the waiter by admin' })
  @IsNotEmpty()
  @IsString()
  pin: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  businessId?: string;
}
