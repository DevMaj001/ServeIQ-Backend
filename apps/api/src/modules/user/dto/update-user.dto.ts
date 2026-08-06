import { PartialType } from '@nestjs/swagger';
import { InviteUserDto } from './invite-user.dto';
import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateUserDto extends PartialType(InviteUserDto) {
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
