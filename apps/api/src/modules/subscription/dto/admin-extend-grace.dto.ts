import { IsNotEmpty, IsUUID, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminExtendGraceDto {
  @ApiProperty({ example: 'uuid-of-branch', description: 'Branch ID to extend grace period for' })
  @IsNotEmpty()
  @IsUUID()
  branch_id: string;

  @ApiProperty({ example: 7, description: 'Number of days to extend the grace period' })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(365)
  days: number;
}
