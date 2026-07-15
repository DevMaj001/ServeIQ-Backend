import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApproveOrderDto {
  @ApiProperty({ example: 'Kitchen', description: 'Department to assign the order to' })
  @IsNotEmpty()
  @IsString()
  department: string;

  @ApiProperty({ example: 600, description: 'Estimated preparation time in seconds' })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  estimated_preparation_time_seconds: number;
}
