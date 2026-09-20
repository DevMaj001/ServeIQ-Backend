import { isBillable } from '../../common/shared';

/**
 * The single bill-math implementation. Every place that turns orders into a
 * chargeable amount (waiter billing, self-service checkout, cash intents,
 * the public tracking view) must go through these helpers.
 *
 * Before this module existed the formula was duplicated in four places, and
 * the self-service checkout had drifted: it charged subtotal + service +
 * delivery with tax_kobo hardcoded to 0, while the bill and the tracking
 * page both included VAT — customers saw one total and paid another.
 *
 * Rules (locked by bill.calculation.spec.ts and bill-totals.spec.ts):
 * - integer kobo everywhere, Math.round at each percentage step
 * - every percentage applies to the subtotal, never compounded
 * - only isBillable() orders count toward the subtotal
 * - the total floors at 0
 */

export const DEFAULT_SERVICE_CHARGE_PERCENT = 10;
export const DEFAULT_TAX_RATE_PERCENT = 7.5;

export interface BillRates {
  serviceChargePercent: number;
  taxRatePercent: number;
}

/** Rate resolution order: explicit override → business setting → default. */
export function resolveBillRates(
  business:
    | {
        service_charge_percent?: number | string | null;
        tax_rate?: number | string | null;
      }
    | null
    | undefined,
  overrides?: {
    service_charge_percent?: number;
    tax_rate_percent?: number;
  },
): BillRates {
  return {
    serviceChargePercent:
      overrides?.service_charge_percent ??
      Number(
        business?.service_charge_percent ?? DEFAULT_SERVICE_CHARGE_PERCENT,
      ),
    taxRatePercent:
      overrides?.tax_rate_percent ??
      Number(business?.tax_rate ?? DEFAULT_TAX_RATE_PERCENT),
  };
}

export interface BillTotals {
  subtotal_kobo: number;
  service_charge_kobo: number;
  tax_kobo: number;
  delivery_fee_kobo: number;
  discount_kobo: number;
  total_kobo: number;
}

export function computeBillTotals(input: {
  orders: Array<{
    order_status?: string | null;
    subtotal_kobo?: number | null;
  }>;
  rates: BillRates;
  deliveryFeeKobo?: number;
  discountKobo?: number;
}): BillTotals {
  const subtotal = input.orders
    .filter((o) => isBillable(o.order_status))
    .reduce((sum, o) => sum + (o.subtotal_kobo ?? 0), 0);
  const serviceCharge = Math.round(
    subtotal * (input.rates.serviceChargePercent / 100),
  );
  const tax = Math.round(subtotal * (input.rates.taxRatePercent / 100));
  const deliveryFee = input.deliveryFeeKobo ?? 0;
  const discount = input.discountKobo ?? 0;
  return {
    subtotal_kobo: subtotal,
    service_charge_kobo: serviceCharge,
    tax_kobo: tax,
    delivery_fee_kobo: deliveryFee,
    discount_kobo: discount,
    total_kobo: Math.max(
      0,
      subtotal + serviceCharge + tax + deliveryFee - discount,
    ),
  };
}

/**
 * Recompute a bill's total from its own persisted components — used when a
 * component (discount, delivery fee, payment method) changes on an existing
 * bill. Keeps whatever tax the bill already carries.
 */
export function recomputeBillTotal(bill: {
  subtotal_kobo: number;
  service_charge_kobo: number;
  tax_kobo?: number | null;
  delivery_fee_kobo?: number | null;
  discount_kobo?: number | null;
}): number {
  return Math.max(
    0,
    bill.subtotal_kobo +
      bill.service_charge_kobo +
      (bill.tax_kobo ?? 0) +
      (bill.delivery_fee_kobo ?? 0) -
      (bill.discount_kobo ?? 0),
  );
}
