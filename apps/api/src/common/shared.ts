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
  PENDING_PAYMENT_APPROVAL = 'pending_payment_approval',
  PENDING_SUPERVISOR_APPROVAL = 'pending_supervisor_approval',
  APPROVED = 'approved',
  ASSIGNED_TO_DEPARTMENT = 'assigned_to_department',
  PREPARING = 'preparing',
  READY_FOR_PICKUP = 'ready_for_pickup',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  COMPLETED = 'completed',
  DECLINED = 'declined',
  CANCELLED = 'cancelled',
}

/**
 * Single source of truth for billing-eligibility rules shared across tab totals,
 * bill generation, and the payment gate. A billable order item contributes to the
 * running tab/bill total. Declined and cancelled items are never billable.
 */
export function isBillable(status: string | null | undefined): boolean {
  // Missing status is treated as pending/approved-like — billable. Only explicit
  // declined/cancelled items are excluded from the running total.
  return status !== OrderStatus.DECLINED && status !== OrderStatus.CANCELLED;
}

/**
 * A billable order is fulfilled once it reaches a terminal delivered state. This is
 * the criterion that a tab must meet before payment can proceed.
 */
export function isFulfilled(status: string | null | undefined): boolean {
  return status === OrderStatus.DELIVERED || status === OrderStatus.COMPLETED;
}

/**
 * Whether an order's status should block payment for the tab.
 *
 * In the prepaid-takeaway flow orders are HELD in PENDING_PAYMENT_APPROVAL until the
 * customer pays (they are released to the kitchen at processPayment). Those held orders
 * must NOT block payment, so they are exempt here. Declined/cancelled items are already
 * non-billable and never block.
 */
export function statusBlocksPayment(status: string | null | undefined): boolean {
  return (
    isBillable(status) &&
    !isFulfilled(status) &&
    status !== OrderStatus.PENDING_PAYMENT_APPROVAL
  );
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

export enum TabType {
  DINE_IN = 'dine_in',
  TAKEAWAY = 'takeaway',
}

export enum FulfillmentType {
  SERVE = 'serve',
  PACK = 'pack',
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
