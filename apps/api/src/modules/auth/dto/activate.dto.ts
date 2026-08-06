import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ActivateDto {
  @ApiProperty({
    example: 'waiter@restaurant.com',
    description: 'Waiter email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePass1!', description: 'Waiter password' })
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
