import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBranchDto {
  @ApiProperty({
    example: 'Abuja Central Branch',
    description: 'Name of the branch',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    example: '123 Gwarinpa Estate, Abuja',
    description: 'Address of the branch',
  })
  @IsNotEmpty()
  @IsString()
  address: string;

  @ApiProperty({
    example: '+234 801 234 5678',
    description: 'Contact phone number',
  })
  @IsNotEmpty()
  @IsString()
  phone_number: string;

  @ApiProperty({
    example: 'Downtown Abuja',
    description: 'Location details',
    required: false,
  })
  @IsOptional()
  @IsString()
  location?: string;
}
