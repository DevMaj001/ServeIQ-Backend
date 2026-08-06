// Refresh token is handled via HTTP-only cookie, no DTO body needed
// But we'll define it for Swagger
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token (sent via HTTP-only cookie)' })
  refresh_token?: string;
}
