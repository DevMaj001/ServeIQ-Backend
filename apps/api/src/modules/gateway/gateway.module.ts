import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GatewayGateway } from './gateway.gateway';
import { RealtimeService } from './realtime.service';
import { GATEWAY_SERVER } from './gateway.constants';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '15m',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    GatewayGateway,
    RealtimeService,
    {
      provide: GATEWAY_SERVER,
      useFactory: () => (global as any)[GATEWAY_SERVER],
    },
  ],
  exports: [GatewayGateway, RealtimeService],
})
export class GatewayModule {}
