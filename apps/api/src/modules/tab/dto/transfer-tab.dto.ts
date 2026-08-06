import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TransferTabDto {
  @ApiProperty({
    example: 'table-uuid-here',
    description: 'Target table UUID to move the tab to',
  })
  @IsNotEmpty()
  @IsUUID()
  target_table_id: string;
}
