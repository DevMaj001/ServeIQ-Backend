import { Injectable, Inject } from '@nestjs/common';
import { Server } from 'socket.io';
import { GATEWAY_SERVER } from './gateway.constants';

@Injectable()
export class RealtimeService {
  constructor(@Inject(GATEWAY_SERVER) private readonly server: Server) {}

  emitTabUpdate(branchId: string, tabId: string, data: any) {
    this.server
      .to(`branch:${branchId}`)
      .emit('tab:updated', { tabId, ...data });
    this.server
      .to(`managers:${branchId}`)
      .emit('tab:updated', { tabId, ...data });
  }

  emitTabCreated(branchId: string, tab: any) {
    this.server.to(`branch:${branchId}`).emit('tab:created', tab);
    this.server.to(`tables:${branchId}`).emit('table:status', {
      tableId: tab.table_id,
      status: 'occupied',
    });
    this.server.to(`managers:${branchId}`).emit('tab:created', tab);
  }

  emitTabClosed(branchId: string, tabId: string, tableId: string) {
    this.server.to(`branch:${branchId}`).emit('tab:closed', { tabId });
    this.server.to(`tables:${branchId}`).emit('table:status', {
      tableId,
      status: 'available',
    });
    this.server.to(`managers:${branchId}`).emit('tab:closed', { tabId });
  }

  emitTableStatusChange(branchId: string, tableId: string, status: string) {
    this.server
      .to(`tables:${branchId}`)
      .emit('table:status', { tableId, status });
    this.server
      .to(`managers:${branchId}`)
      .emit('table:status', { tableId, status });
  }

  emitOrderCreated(branchId: string, order: any) {
    this.server.to(`orders:${branchId}`).emit('order:created', order);
    this.server.to(`orders:${branchId}:pending`).emit('order:created', order);
    this.server.to(`managers:${branchId}`).emit('order:created', order);
  }

  emitOrderUpdated(branchId: string, orderId: string, data: any) {
    this.server
      .to(`orders:${branchId}`)
      .emit('order:updated', { orderId, ...data });
    if (data.order_status) {
      this.server
        .to(`orders:${branchId}:${data.order_status}`)
        .emit('order:updated', { orderId, ...data });
    }
    this.server
      .to(`managers:${branchId}`)
      .emit('order:updated', { orderId, ...data });
  }

  emitOrderStatusChange(
    branchId: string,
    orderId: string,
    status: string,
    tabId?: string,
  ) {
    this.server
      .to(`orders:${branchId}`)
      .emit('order:status', { orderId, status, tabId });
    this.server
      .to(`orders:${branchId}:${status}`)
      .emit('order:status', { orderId, status, tabId });
    this.server
      .to(`managers:${branchId}`)
      .emit('order:status', { orderId, status, tabId });
  }

  emitDashboardUpdate(branchId: string, data: any) {
    this.server.to(`dashboard:${branchId}`).emit('dashboard:updated', data);
    this.server.to(`managers:${branchId}`).emit('dashboard:updated', data);
  }

  emitNotification(branchId: string, notification: any) {
    this.server.to(`branch:${branchId}`).emit('notification', notification);
  }

  emitShiftUpdate(branchId: string, data: any) {
    this.server.to(`managers:${branchId}`).emit('shift:updated', data);
  }

  emitBillUpdate(branchId: string, tabId: string, data: any) {
    this.server
      .to(`branch:${branchId}`)
      .emit('bill:updated', { tabId, ...data });
    this.server
      .to(`managers:${branchId}`)
      .emit('bill:updated', { tabId, ...data });
  }
}
