import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GatewayGateway } from './gateway.gateway';
import { PublicGateway } from './public.gateway';
import { RealtimeService } from './realtime.service';
import { GATEWAY_SERVER } from './gateway.constants';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET')!,
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRES_IN') || '15m') as any,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    GatewayGateway,
    PublicGateway,
    RealtimeService,
    {
      provide: GATEWAY_SERVER,
      useFactory: () => (global as any)[GATEWAY_SERVER],
    },
  ],
  exports: [GatewayGateway, PublicGateway, RealtimeService],
})
export class GatewayModule {}
