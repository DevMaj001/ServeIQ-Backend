import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDepartmentDto {
  @ApiProperty({
    example: 'Kitchen',
    description: 'Department name',
  })
  @IsString()
  name: string;
}

export class UpdateDepartmentDto {
  @ApiPropertyOptional({
    example: 'Kitchen',
    description: 'Department name',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the department is active',
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}