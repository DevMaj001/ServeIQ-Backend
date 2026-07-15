import { IsNotEmpty, IsString, IsOptional, IsEmail, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../common/shared';

const CREATABLE_ROLES = [UserRole.WAITER, UserRole.SUPERVISOR] as const;

export class CreateWaiterDto {
  @ApiProperty({ example: 'Jane Waiter', description: 'Full name of the waiter' })
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @ApiPropertyOptional({ example: 'jane@bistro.com', description: 'Waiter email (optional)' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+2348012345678', description: 'Waiter phone number (optional)' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'uuid-of-branch', description: 'Branch the waiter belongs to' })
  @IsNotEmpty()
  @IsString()
  branchId: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg', description: 'URL of the waiter avatar image' })
  @IsOptional()
  @IsString()
  avatar_url?: string;

  @ApiPropertyOptional({ example: 'supervisor', description: 'Role to assign (waiter or supervisor). Defaults to waiter if omitted.' })
  @IsOptional()
  @IsIn(CREATABLE_ROLES, { message: 'Role must be either "waiter" or "supervisor"' })
  role?: string;
}
