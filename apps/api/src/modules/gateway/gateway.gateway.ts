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
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { JwtService } from '@nestjs/jwt';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { GATEWAY_SERVER } from './gateway.constants';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  branchId?: string;
  role?: string;
}

const connectedClients = new Map<string, Set<AuthenticatedSocket>>();

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || [
      'http://localhost:3000',
      'http://localhost:4200',
    ],
    credentials: true,
  },
  namespace: '/realtime',
})
@Injectable()
export class GatewayGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnGatewayInit,
    OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GatewayGateway.name);

  // Redis adapter clients (only created when REDIS_URL is set). They are raw
  // ioredis connections not tied to the HTTP server, so they must be closed
  // explicitly on shutdown or they leak and keep the process alive.
  private pubClient?: Redis;
  private subClient?: Redis;

  constructor(private readonly jwtService: JwtService) {}

  afterInit(server: Server) {
    if (server) {
      (
        globalThis as unknown as Record<
          typeof GATEWAY_SERVER,
          Server | undefined
        >
      )[GATEWAY_SERVER] = server;
    }

    // Horizontal scale-out: fan out events across instances via Redis.
    // Without REDIS_URL the gateway still works single-instance.
    const redisUrl = process.env.REDIS_URL;
    if (!server || !redisUrl) {
      this.logger.warn(
        'REDIS_URL not set — Socket.io running single-instance (no Redis adapter)',
      );
      return;
    }
    try {
      const pub = new Redis(redisUrl, { maxRetriesPerRequest: null });
      const sub = pub.duplicate();
      server.adapter(createAdapter(pub, sub));
      this.pubClient = pub;
      this.subClient = sub;
      pub.on('error', (e) =>
        this.logger.warn(`Redis adapter pub error: ${e.message}`),
      );
      sub.on('error', (e) =>
        this.logger.warn(`Redis adapter sub error: ${e.message}`),
      );
      this.logger.log('Socket.io Redis adapter attached');
    } catch (err) {
      this.logger.warn(
        `Failed to attach Redis adapter (continuing single-instance): ${err?.message ?? err}`,
      );
    }
  }

  onModuleInit() {
    if (this.server) {
      (
        globalThis as unknown as Record<
          typeof GATEWAY_SERVER,
          Server | undefined
        >
      )[GATEWAY_SERVER] = this.server;
    }
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1];
      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      client.userId = payload.sub;
      client.branchId = payload.branch_id;
      client.role = payload.role;

      const key = `${client.branchId}:${client.userId}`;
      if (!connectedClients.has(key)) {
        connectedClients.set(key, new Set());
      }
      connectedClients.get(key)!.add(client);

      client.join(`branch:${client.branchId}`);
      if (
        client.role === 'owner' ||
        client.role === 'manager' ||
        client.role === 'cashier'
      ) {
        client.join(`managers:${client.branchId}`);
      }

      this.logger.log(
        `Client ${client.id} (user: ${client.userId}, branch: ${client.branchId}) connected`,
      );
    } catch (err) {
      this.logger.warn(`Invalid token for client ${client.id}: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId && client.branchId) {
      const key = `${client.branchId}:${client.userId}`;
      const clients = connectedClients.get(key);
      if (clients) {
        clients.delete(client);
        if (clients.size === 0) {
          connectedClients.delete(key);
        }
      }
    }
    this.logger.log(`Client ${client.id} disconnected`);
  }

  async onModuleDestroy() {
    // Quit the Redis adapter clients first so a non-closable server never
    // blocks their cleanup.
    await Promise.allSettled([
      this.pubClient?.disconnect(),
      this.subClient?.disconnect(),
    ]);

    // Close the Socket.IO server if it exposes a close method. The injected
    // server instance's shape can vary by Nest/socket.io version, so guard the
    // call instead of assuming `.close` exists.
    const server = this.server as unknown as {
      close?: (cb?: (err?: Error) => void) => void;
    };
    if (server && typeof server.close === 'function') {
      const closeFn = server.close;
      await new Promise<void>((resolve) => {
        closeFn(() => resolve());
      });
    }

    delete (globalThis as unknown as Record<typeof GATEWAY_SERVER, Server | undefined>)[
      GATEWAY_SERVER
    ];
  }

  @SubscribeMessage('subscribe:tables')
  handleSubscribeTables(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { branchId: string },
  ) {
    if (data.branchId === client.branchId) {
      client.join(`tables:${data.branchId}`);
      return { success: true };
    }
    return { success: false, error: 'Unauthorized branch' };
  }

  @SubscribeMessage('subscribe:orders')
  handleSubscribeOrders(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { branchId: string; status?: string },
  ) {
    if (data.branchId === client.branchId) {
      client.join(`orders:${data.branchId}`);
      if (data.status) {
        client.join(`orders:${data.branchId}:${data.status}`);
      }
      return { success: true };
    }
    return { success: false, error: 'Unauthorized branch' };
  }

  @SubscribeMessage('subscribe:dashboard')
  handleSubscribeDashboard(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { branchId: string },
  ) {
    if (
      data.branchId === client.branchId &&
      (client.role === 'owner' || client.role === 'manager')
    ) {
      client.join(`dashboard:${data.branchId}`);
      return { success: true };
    }
    return { success: false, error: 'Unauthorized' };
  }
}

export function getConnectedClients() {
  return connectedClients;
}
