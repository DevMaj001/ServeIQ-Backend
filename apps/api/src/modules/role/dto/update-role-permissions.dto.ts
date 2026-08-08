import { IsArray, IsUUID, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateRolePermissionsDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'Array of permission UUIDs to assign to the role',
    example: ['uuid1', 'uuid2'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  permission_ids: string[];
}