import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  Min,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { TableStatus } from '../entities/table.entity';

export class CreateTableDto {
  @ApiProperty({ example: 'T1' })
  @IsString()
  @IsNotEmpty()
  table_number: string;

  @ApiProperty({ example: 'VIP Table 1', required: false })
  @IsString()
  @IsOptional()
  label?: string;

  @ApiProperty({ example: 4, minimum: 1 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @ApiProperty({ enum: TableStatus, default: TableStatus.AVAILABLE })
  @IsEnum(TableStatus)
  @IsOptional()
  status?: TableStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  branch_id?: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsBoolean()
  @IsOptional()
  is_vip?: boolean;
}

export class UpdateTableDto extends PartialType(CreateTableDto) {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  branch_id?: string;
}
