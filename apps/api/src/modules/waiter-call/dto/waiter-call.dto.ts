import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsUUID, IsNumber, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateWaiterCallDto {
  @ApiProperty({ example: 'table-uuid-here' })
  @IsNotEmpty()
  @IsUUID()
  tableId: string;

  @ApiProperty({ required: false, example: 'customer-session-id' })
  @IsOptional()
  @IsString()
  customerSessionId?: string;
}

export class WaiterCallStatusDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  tableId: string;

  @ApiProperty()
  tableNumber: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ required: false })
  assignedWaiterName?: string;

  @ApiProperty({ required: false })
  message?: string;

  @ApiProperty()
  createdAt: Date;
}

export class WaiterCallListDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  tableId: string;

  @ApiProperty()
  tableNumber: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ required: false })
  assignedWaiterId?: string;

  @ApiProperty({ required: false })
  assignedWaiterName?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ required: false })
  acceptedAt?: Date;

  @ApiProperty({ required: false })
  arrivedAt?: Date;
}

export class WaiterWorkloadDto {
  @ApiProperty()
  waiterId: string;

  @ApiProperty()
  waiterName: string;

  @ApiProperty()
  activeTables: number;

  @ApiProperty()
  maxTables: number;

  @ApiProperty()
  isAvailable: boolean;
}

export class UpdateWaiterCallStatusDto {
  @ApiProperty({ enum: ['accepted', 'arrived', 'resolved', 'cancelled'] })
  @IsNotEmpty()
  @IsString()
  status: 'accepted' | 'arrived' | 'resolved' | 'cancelled';
}

export class BranchWaiterSettingsDto {
  @ApiProperty({ default: 5 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(20)
  maxTablesPerWaiter?: number = 5;
}