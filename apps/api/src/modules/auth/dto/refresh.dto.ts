import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshDto {
  @ApiProperty({
    example: 'refresh-token-string',
    description: 'Refresh token issued during login',
  })
  @IsNotEmpty()
  @IsString()
  refresh_token: string;
}
