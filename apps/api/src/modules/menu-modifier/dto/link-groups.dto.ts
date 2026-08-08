import { IsArray, IsUUID, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class MenuModifierLinkGroupsDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'Array of modifier group UUIDs to link to the menu item',
    example: ['uuid1', 'uuid2'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  group_ids: string[];
}