import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InitializeSubscriptionDto {
  @ApiProperty({ example: 'uuid-of-plan', description: 'Plan ID to subscribe to' })
  @IsNotEmpty()
  @IsUUID()
  plan_id: string;
}
