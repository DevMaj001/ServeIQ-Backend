import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsEnum,
  IsString,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    example: 'John Doe',
    description: 'Full name of the business owner',
  })
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @ApiProperty({
    example: 'owner@restaurant.com',
    description: 'Owner email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'SuperSecret8!',
    description: 'Password (min 8 characters)',
  })
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiProperty({
    example: 'The Golden Fork',
    description: 'Name of the business',
  })
  @IsNotEmpty()
  @IsString()
  businessName: string;

  @ApiProperty({
    example: 'restaurant',
    description: 'Type of hospitality business',
    enum: ['bar', 'lounge', 'restaurant', 'club', 'cafe'],
  })
  @IsNotEmpty()
  @IsEnum(['bar', 'lounge', 'restaurant', 'club', 'cafe'])
  businessType: string;

  @ApiPropertyOptional({
    example: 'https://...',
    description: 'Business logo URL (from /api/upload)',
  })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({
    example: 'https://...',
    description: 'CAC document URL (from /api/upload) — optional',
  })
  @IsOptional()
  @IsString()
  cacDocumentUrl?: string;
}
