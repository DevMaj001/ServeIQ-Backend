import { IsEmail, IsNotEmpty, MinLength, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'owner@restaurant.com',
    description: 'Registered email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SuperSecret8!', description: 'Account password' })
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({
    example: 'office-desktop-1',
    description: 'Unique identifier of the device performing the login',
  })
  @IsOptional()
  @IsString()
  device_id?: string;

  @ApiPropertyOptional({
    example: 'Admin Desktop',
    description: 'Human-friendly device name',
  })
  @IsOptional()
  @IsString()
  device_name?: string;

  @ApiPropertyOptional({
    example: 'web',
    description: 'Device platform (android, ios, web)',
  })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional({
    example: '2.1.0',
    description: 'App version of the calling client',
  })
  @IsOptional()
  @IsString()
  app_version?: string;
}