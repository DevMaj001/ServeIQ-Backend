import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'owner@restaurant.com',
    description: 'Registered email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SuperSecret8!', description: 'Account password' })
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}
