import { IsString, IsOptional, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({
    example: '123456',
    description: '6-digit OTP code sent to email',
  })
  @IsString()
  otp: string;
}

export class SetupSuperAdminDto {
  @ApiProperty({
    example: 'admin@example.com',
    description: 'Super admin email',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'securePassword123',
    description: 'Super admin password',
  })
  @IsString()
  password: string;

  @ApiPropertyOptional({
    example: 'Super Admin',
    description: 'Super admin full name',
  })
  @IsOptional()
  @IsString()
  full_name?: string;
}

export class ImpersonateDto {
  @ApiProperty({
    example: 'business-uuid-here',
    description: 'Business UUID to impersonate',
  })
  @IsString()
  businessId: string;

  @ApiPropertyOptional({
    example: 'branch-uuid-here',
    description: 'Optional branch UUID',
  })
  @IsOptional()
  @IsString()
  branchId?: string;
}