import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TableStatus } from '../../../common/shared';

export class UpdateTableStatusDto {
  @ApiProperty({ enum: TableStatus, example: TableStatus.AVAILABLE })
  @IsEnum(TableStatus)
  @IsNotEmpty()
  status: TableStatus;
}
