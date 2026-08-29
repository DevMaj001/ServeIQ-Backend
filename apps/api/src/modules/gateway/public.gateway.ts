import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Tab } from '../tab/entities/tab.entity';
import { PUBLIC_GATEWAY_SERVER } from './gateway.constants';

/**
 * Public, unauthenticated realtime channel for customers tracking their order
 * (the public-menu status page). Unlike the staff `/realtime` gateway, no JWT is
 * required — a client proves ownership of a tab by supplying its `tracking_code`
 * when subscribing. This lets the cash/payment-confirmation flow be push-based
 * (poll-free) for the customer.
 */
@WebSocketGateway({
  namespace: '/public',
  // Public, unauthenticated channel for customers tracking their order. We accept
  // any origin (reflecting the request Origin) so the customer socket works from
  // whatever frontend host serves the menu, without depending on CORS_ORIGIN.
  cors: {
    origin: true,
    credentials: true,
  },
})
@Injectable()
export class PublicGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PublicGateway.name);

  constructor(private readonly dataSource: DataSource) {}

  afterInit(server: Server) {
    if (server) {
      (globalThis as unknown as Record<string, any>)[PUBLIC_GATEWAY_SERVER] = server;
    }
  }

  onModuleInit() {
    if (this.server) {
      (globalThis as unknown as Record<string, any>)[PUBLIC_GATEWAY_SERVER] = this.server;
    }
  }

  // Anonymous customers are allowed (they only ever join their own tab room).
  handleConnection(client: Socket) {
    this.logger.log(`Public client ${client.id} connected`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Public client ${client.id} disconnected`);
  }

  @SubscribeMessage('subscribe:tab')
  async handleSubscribeTab(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tabId: string; trackingCode: string },
  ) {
    const tabId = data?.tabId;
    const code = data?.trackingCode;
    if (!tabId || !code) {
      return { success: false, error: 'tabId and trackingCode required' };
    }
    try {
      const tab = await this.dataSource
        .getRepository(Tab)
        .findOne({ where: { id: tabId, tracking_code: code } });
      if (!tab) return { success: false, error: 'Invalid tracking code' };
      client.join(`tab:${tabId}`);
      return { success: true };
    } catch (err) {
      this.logger.warn(`subscribe:tab failed: ${err?.message ?? String(err)}`);
      return { success: false, error: 'join failed' };
    }
  }
}
