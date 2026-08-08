import { Module, Global } from '@nestjs/common';
import { GatewayGateway } from './gateway.gateway';
import { RealtimeService } from './realtime.service';
import { GATEWAY_SERVER } from './gateway.constants';

@Global()
@Module({
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
