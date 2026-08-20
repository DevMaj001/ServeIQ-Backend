import { IsNotEmpty, IsString, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WaiterLoginDto {
  @ApiProperty({
    example: '1234',
    description: '4-digit PIN assigned to the waiter by admin',
  })
  @IsNotEmpty()
  @IsString()
  pin: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    example: 'uuid-from-resolve-business',
    description:
      'Business UUID (call POST /auth/resolve-business first to get this)',
  })
  @IsOptional()
  @IsUUID()
  businessId?: string;

  @ApiPropertyOptional({
    example: 'tablet-7f3a',
    description: 'Unique identifier of the device performing the login',
  })
  @IsOptional()
  @IsString()
  device_id?: string;

  @ApiPropertyOptional({
    example: 'Waiter Tablet 1',
    description: 'Human-friendly device name',
  })
  @IsOptional()
  @IsString()
  device_name?: string;

  @ApiPropertyOptional({
    example: 'android',
    description: 'Device platform (android, ios, web)',
  })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional({
    example: '1.2.0',
    description: 'App version of the calling client',
  })
  @IsOptional()
  @IsString()
  app_version?: string;
}
