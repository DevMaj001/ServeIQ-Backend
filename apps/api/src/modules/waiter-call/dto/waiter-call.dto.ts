import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateWaiterCallDto {
  @ApiProperty({ example: 'table-uuid-here' })
  @IsNotEmpty()
  @IsUUID()
  tableId: string;

  @ApiPropertyOptional({ example: 'customer-session-id' })
  @IsOptional()
  @IsString()
  customerSessionId?: string;
}

export class UpdateWaiterCallStatusDto {
  @ApiProperty({ enum: ['accepted', 'arrived', 'resolved', 'cancelled'] })
  @IsNotEmpty()
  @IsString()
  status: 'accepted' | 'arrived' | 'resolved' | 'cancelled';
}

export class ReassignWaiterCallDto {
  @ApiProperty({ example: 'waiter-uuid-here' })
  @IsNotEmpty()
  @IsUUID()
  waiterId: string;
}

export class BranchWaiterSettingsDto {
  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  @Min(1)
  @Max(20)
  maxTablesPerWaiter?: number;
}
