import { IsNotEmpty, IsString, IsOptional, IsBoolean, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePrinterDto {
  @ApiProperty({ example: 'Kitchen Printer 1' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'network' })
  @IsOptional()
  @IsString()
  interface_type?: string;

  @ApiPropertyOptional({ example: '192.168.1.100' })
  @IsOptional()
  @IsString()
  ip_address?: string;

  @ApiPropertyOptional({ example: 9100 })
  @IsOptional()
  @IsInt()
  port?: number;

  @ApiPropertyOptional({ example: 80 })
  @IsOptional()
  @IsInt()
  character_per_line?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ example: 'receipt' })
  @IsOptional()
  @IsString()
  print_type?: string;
}
