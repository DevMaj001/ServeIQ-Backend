import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEmail,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsIn,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ReservationStatus,
  ReservationSource,
} from '../entities/reservation.entity';

export class CreateReservationDto {
  @ApiProperty({ example: 'John Doe', description: 'Customer full name' })
  @IsNotEmpty()
  @IsString()
  customer_name: string;

  @ApiProperty({
    example: '+2348012345678',
    description: 'Customer phone number',
  })
  @IsNotEmpty()
  @IsString()
  customer_phone: string;

  @ApiPropertyOptional({
    example: 'john@example.com',
    description: 'Customer email (optional)',
  })
  @IsOptional()
  @IsEmail()
  customer_email?: string;

  @ApiProperty({ example: 4, description: 'Number of guests' })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(20)
  party_size: number;

  @ApiProperty({
    example: '2026-09-15T19:00:00Z',
    description: 'Reservation date/time (ISO 8601)',
  })
  @IsNotEmpty()
  @IsDateString()
  reservation_time: string;

  @ApiPropertyOptional({
    example: 90,
    description: 'Duration in minutes (default 90)',
  })
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(300)
  duration_minutes?: number;

  @ApiPropertyOptional({
    example: 'Window seat, birthday celebration',
    description: 'Special requests',
  })
  @IsOptional()
  @IsString()
  special_requests?: string;

  @ApiPropertyOptional({
    enum: ReservationSource,
    default: ReservationSource.PUBLIC,
    description: 'Booking source',
  })
  @IsOptional()
  @IsIn(Object.values(ReservationSource))
  source?: ReservationSource;
}

export class UpdateReservationDto {
  @ApiPropertyOptional({
    example: 'John Doe',
    description: 'Customer full name',
  })
  @IsOptional()
  @IsString()
  customer_name?: string;

  @ApiPropertyOptional({
    example: '+2348012345678',
    description: 'Customer phone number',
  })
  @IsOptional()
  @IsString()
  customer_phone?: string;

  @ApiPropertyOptional({
    example: 'john@example.com',
    description: 'Customer email',
  })
  @IsOptional()
  @IsEmail()
  customer_email?: string;

  @ApiPropertyOptional({ example: 4, description: 'Number of guests' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  party_size?: number;

  @ApiPropertyOptional({
    example: '2026-09-15T19:00:00Z',
    description: 'Reservation date/time (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  reservation_time?: string;

  @ApiPropertyOptional({ example: 90, description: 'Duration in minutes' })
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(300)
  duration_minutes?: number;

  @ApiPropertyOptional({
    enum: ReservationStatus,
    description: 'Reservation status',
  })
  @IsOptional()
  @IsIn(Object.values(ReservationStatus))
  status?: ReservationStatus;

  @ApiPropertyOptional({
    example: 'Window seat, birthday celebration',
    description: 'Special requests',
  })
  @IsOptional()
  @IsString()
  special_requests?: string;

  @ApiPropertyOptional({
    description: 'Cancellation reason (required when status=cancelled)',
  })
  @ValidateIf((o) => o.status === ReservationStatus.CANCELLED)
  @IsString()
  cancellation_reason?: string;
}

export class ReservationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by branch ID' })
  @IsOptional()
  @IsString()
  branch_id?: string;

  @ApiPropertyOptional({ description: 'Filter by table ID' })
  @IsOptional()
  @IsString()
  table_id?: string;

  @ApiPropertyOptional({
    enum: ReservationStatus,
    description: 'Filter by status',
  })
  @IsOptional()
  @IsIn(Object.values(ReservationStatus))
  status?: ReservationStatus;

  @ApiPropertyOptional({ description: 'Filter from date (inclusive)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Filter to date (inclusive)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: 'Search by customer name/phone/email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 50, description: 'Page size' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ default: 0, description: 'Offset for pagination' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class AvailabilityQueryDto {
  @ApiProperty({
    example: '2026-09-15',
    description: 'Date to check (YYYY-MM-DD)',
  })
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @ApiProperty({ example: 4, description: 'Party size' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  party_size: number;

  @ApiPropertyOptional({
    description: 'Branch ID (defaults to current branch)',
  })
  @IsOptional()
  @IsString()
  branch_id?: string;
}

export class WalkinReservationDto {
  @ApiProperty({ example: 'John Doe', description: 'Customer full name' })
  @IsNotEmpty()
  @IsString()
  customer_name: string;

  @ApiProperty({
    example: '+2348012345678',
    description: 'Customer phone number',
  })
  @IsNotEmpty()
  @IsString()
  customer_phone: string;

  @ApiPropertyOptional({
    example: 'john@example.com',
    description: 'Customer email',
  })
  @IsOptional()
  @IsEmail()
  customer_email?: string;

  @ApiProperty({ example: 4, description: 'Number of guests' })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(20)
  party_size: number;

  @ApiPropertyOptional({ example: 90, description: 'Duration in minutes' })
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(300)
  duration_minutes?: number;

  @ApiPropertyOptional({
    example: 'Table 5',
    description: 'Specific table to assign',
  })
  @IsOptional()
  @IsString()
  table_id?: string;

  @ApiPropertyOptional({
    example: 'Walk-in customer',
    description: 'Special requests',
  })
  @IsOptional()
  @IsString()
  special_requests?: string;
}

export class ConfirmReservationDto {
  @ApiProperty({ description: 'Reservation confirmation code' })
  @IsNotEmpty()
  @IsString()
  confirmation_code: string;
}

export class CancelReservationDto {
  @ApiProperty({
    example: 'Change of plans',
    description: 'Reason for cancellation (optional)',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
