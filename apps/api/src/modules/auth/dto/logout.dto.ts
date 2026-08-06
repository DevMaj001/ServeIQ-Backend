import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LogoutDto {
  @ApiProperty({
    example: 'refresh-token-string',
    description: 'Refresh token to invalidate',
  })
  @IsNotEmpty()
  @IsString()
  refresh_token: string;
}
