import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HandoffShiftDto {
  @ApiProperty({
    example: 'd486d141-4b28-488d-9829-501432f2a5bf',
    description: 'ID of the staff member receiving the open tabs',
  })
  @IsNotEmpty()
  @IsUUID()
  to_staff_id: string;

  @ApiPropertyOptional({
    example: 'd486d141-4b28-488d-9829-501432f2a5bf',
    description:
      'Restrict handoff to tabs currently assigned to this staff member. Omit to transfer all open tabs for the branch.',
  })
  @IsOptional()
  @IsUUID()
  from_staff_id?: string;
}