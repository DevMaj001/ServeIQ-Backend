import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MergeTabDto {
  @ApiProperty({
    example: 'tab-uuid-here',
    description:
      'Target tab UUID to merge this tab into (orders move onto the target)',
  })
  @IsNotEmpty()
  @IsUUID()
  target_tab_id: string;
}