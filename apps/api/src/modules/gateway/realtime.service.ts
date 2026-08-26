import { Injectable, Inject } from '@nestjs/common';
import { Server } from 'socket.io';
import { GATEWAY_SERVER } from './gateway.constants';

@Injectable()
export class RealtimeService {
  constructor(@Inject(GATEWAY_SERVER) private readonly server?: Server) {}

  private get io(): Server | undefined {
    const live: Server | undefined = (
      globalThis as unknown as Record<typeof GATEWAY_SERVER, Server | undefined>
    )[GATEWAY_SERVER];
    return this.server || live;
  }

  private emitTo(rooms: string[], event: string, payload: any) {
    const server = this.io;
    if (!server) return;
    for (const room of rooms) {
      server.to(room).emit(event, payload);
    }
  }

  emitTabUpdate(branchId: string, tabId: string, data: any) {
    this.emitTo([`branch:${branchId}`, `managers:${branchId}`], 'tab:updated', {
      tabId,
      ...data,
    });
  }

  emitTabCreated(branchId: string, tab: any) {
    this.emitTo(
      [`branch:${branchId}`, `managers:${branchId}`],
      'tab:created',
      tab,
    );
    this.emitTo([`tables:${branchId}`], 'table:status', {
      tableId: tab.table_id,
      status: 'occupied',
    });
  }

  emitTabClosed(branchId: string, tabId: string, tableId: string) {
    this.emitTo([`branch:${branchId}`, `managers:${branchId}`], 'tab:closed', {
      tabId,
    });
    this.emitTo([`tables:${branchId}`], 'table:status', {
      tableId,
      status: 'available',
    });
  }

  emitTableStatusChange(branchId: string, tableId: string, status: string) {
    this.emitTo(
      [`tables:${branchId}`, `managers:${branchId}`],
      'table:status',
      {
        tableId,
        status,
      },
    );
  }

  emitOrderCreated(branchId: string, order: any) {
    this.emitTo(
      [
        `orders:${branchId}`,
        `orders:${branchId}:pending`,
        `managers:${branchId}`,
      ],
      'order:created',
      order,
    );
  }

  emitOrderUpdated(branchId: string, orderId: string, data: any) {
    const rooms = [`orders:${branchId}`, `managers:${branchId}`];
    if (data.order_status) {
      rooms.push(`orders:${branchId}:${data.order_status}`);
    }
    this.emitTo(rooms, 'order:updated', { orderId, ...data });
  }

  emitOrderStatusChange(
    branchId: string,
    orderId: string,
    status: string,
    tabId?: string,
  ) {
    this.emitTo(
      [
        `orders:${branchId}`,
        `orders:${branchId}:${status}`,
        `managers:${branchId}`,
      ],
      'order:status',
      { orderId, status, tabId },
    );
  }

  emitDashboardUpdate(branchId: string, data: any) {
    this.emitTo(
      [`dashboard:${branchId}`, `managers:${branchId}`],
      'dashboard:updated',
      data,
    );
  }

  emitNotification(branchId: string, notification: any) {
    this.emitTo([`branch:${branchId}`], 'notification', notification);
  }

  emitShiftUpdate(branchId: string, data: any) {
    this.emitTo([`managers:${branchId}`], 'shift:updated', data);
  }

  emitBillUpdate(branchId: string, tabId: string, data: any) {
    this.emitTo(
      [`branch:${branchId}`, `managers:${branchId}`],
      'bill:updated',
      { tabId, ...data },
    );
  }

  emitWaiterCall(branchId: string, event: string, payload: any) {
    this.emitTo(
      [
        `branch:${branchId}`,
        `managers:${branchId}`,
        `tables:${branchId}`,
      ],
      event,
      payload,
    );
  }
}
