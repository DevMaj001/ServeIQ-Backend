export enum UserRole {
  SUPERADMIN = 'superadmin',
  OWNER = 'owner',
  MANAGER = 'manager',
  WAITER = 'waiter',
  CHEF = 'chef',
  CASHIER = 'cashier',
  SUPERVISOR = 'supervisor',
}

export enum OrderStatus {
  PENDING_SUPERVISOR_APPROVAL = 'pending_supervisor_approval',
  APPROVED = 'approved',
  ASSIGNED_TO_DEPARTMENT = 'assigned_to_department',
  PREPARING = 'preparing',
  READY_FOR_PICKUP = 'ready_for_pickup',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  COMPLETED = 'completed',
  DECLINED = 'declined',
}

export enum TabStatus {
  OPEN = 'open',
  BILLED = 'billed',
  PAID = 'paid',
  VOIDED = 'voided',
}

export enum TableStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  RESERVED = 'reserved',
}

export enum PaymentMethod {
  CASH = 'cash',
  TRANSFER = 'transfer',
  POS = 'pos',
  CARD = 'card',
}

export enum StockMovementType {
  MANUAL_ADJUSTMENT = 'manual_adjustment',
  ORDER_CONSUMPTION = 'order_consumption',
  WASTE = 'waste',
  TRANSFER = 'transfer',
  PURCHASE = 'purchase',
  VOID_REVERSAL = 'void_reversal',
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: any;
}
