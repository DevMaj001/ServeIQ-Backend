import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEmail,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRiderDto {
  @ApiProperty({ example: 'James Okafor', description: 'Rider full name' })
  @IsNotEmpty()
  @IsString()
  full_name: string;

  @ApiProperty({ example: 'james@example.com', description: 'Rider email (used for the rider user account)' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'topsecret', description: 'Password for the rider user account' })
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiPropertyOptional({ example: '+2348012345678', description: 'Rider phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Honda A6', description: 'Vehicle description' })
  @IsOptional()
  @IsString()
  vehicle?: string;

  @ApiProperty({ example: 'b0dd20c5-2d3e-4aaa-b982-a16a4e564bff', description: 'Branch the rider works from' })
  @IsNotEmpty()
  @IsString()
  branch_id: string;
}

export class UpdateRiderDto {
  @ApiPropertyOptional({ example: 'b0dd20c5-2d3e-4aaa-b982-a16a4e564bff', description: 'Branch the rider works from' })
  @IsOptional()
  @IsString()
  branch_id?: string;

  @ApiPropertyOptional({ example: true, description: 'Whether the rider is currently online/available' })
  @IsOptional()
  @IsBoolean()
  is_online?: boolean;

  @ApiPropertyOptional({ example: 'Honda A6', description: 'Vehicle description' })
  @IsOptional()
  @IsString()
  vehicle?: string;

  @ApiPropertyOptional({ example: true, description: 'Whether the rider account is active' })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}