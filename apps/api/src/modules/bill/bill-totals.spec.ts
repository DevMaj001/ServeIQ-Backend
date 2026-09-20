import {
  computeBillTotals,
  recomputeBillTotal,
  resolveBillRates,
} from './bill-totals';
import { OrderStatus } from '../../common/shared';

describe('resolveBillRates', () => {
  it('falls back to platform defaults', () => {
    expect(resolveBillRates(null)).toEqual({
      serviceChargePercent: 10,
      taxRatePercent: 7.5,
    });
  });

  it('uses business rates, coercing numeric strings from Postgres', () => {
    expect(
      resolveBillRates({ service_charge_percent: '12.5', tax_rate: '5' }),
    ).toEqual({ serviceChargePercent: 12.5, taxRatePercent: 5 });
  });

  it('lets explicit overrides win over business rates', () => {
    expect(
      resolveBillRates(
        { service_charge_percent: 12, tax_rate: 5 },
        { service_charge_percent: 0, tax_rate_percent: 0 },
      ),
    ).toEqual({ serviceChargePercent: 0, taxRatePercent: 0 });
  });
});

describe('computeBillTotals', () => {
  const rates = { serviceChargePercent: 10, taxRatePercent: 7.5 };

  it('matches the golden case: 15000 + 10% service + 7.5% tax = 17625', () => {
    const totals = computeBillTotals({
      orders: [{ order_status: OrderStatus.DELIVERED, subtotal_kobo: 15000 }],
      rates,
    });
    expect(totals).toEqual({
      subtotal_kobo: 15000,
      service_charge_kobo: 1500,
      tax_kobo: 1125,
      delivery_fee_kobo: 0,
      discount_kobo: 0,
      total_kobo: 17625,
    });
  });

  it('always includes tax (regression: self-service checkout charged tax_kobo 0)', () => {
    const totals = computeBillTotals({
      orders: [{ order_status: OrderStatus.DELIVERED, subtotal_kobo: 10000 }],
      rates,
    });
    expect(totals.tax_kobo).toBe(750);
    expect(totals.total_kobo).toBe(11750);
  });

  it('excludes declined and cancelled orders (regression: cash-intent summed every row)', () => {
    const totals = computeBillTotals({
      orders: [
        { order_status: OrderStatus.DELIVERED, subtotal_kobo: 10000 },
        { order_status: OrderStatus.DECLINED, subtotal_kobo: 4000 },
        { order_status: OrderStatus.CANCELLED, subtotal_kobo: 6000 },
      ],
      rates,
    });
    expect(totals.subtotal_kobo).toBe(10000);
  });

  it('applies percentages to the subtotal only, never compounded', () => {
    const totals = computeBillTotals({
      orders: [{ order_status: OrderStatus.DELIVERED, subtotal_kobo: 20000 }],
      rates,
      deliveryFeeKobo: 5000,
    });
    // tax on 20000, not on 20000 + 2000 service, not on delivery
    expect(totals.tax_kobo).toBe(1500);
    expect(totals.total_kobo).toBe(20000 + 2000 + 1500 + 5000);
  });

  it('floors the total at zero when the discount exceeds it', () => {
    const totals = computeBillTotals({
      orders: [{ order_status: OrderStatus.DELIVERED, subtotal_kobo: 1000 }],
      rates,
      discountKobo: 99999,
    });
    expect(totals.total_kobo).toBe(0);
  });

  it('rounds each percentage step to integer kobo', () => {
    const totals = computeBillTotals({
      orders: [{ order_status: OrderStatus.DELIVERED, subtotal_kobo: 3333 }],
      rates,
    });
    expect(totals.service_charge_kobo).toBe(333); // round(333.3)
    expect(totals.tax_kobo).toBe(250); // round(249.975)
    expect(Number.isInteger(totals.total_kobo)).toBe(true);
  });
});

describe('recomputeBillTotal', () => {
  it('keeps the tax the bill already carries (regression: cash-intent dropped it)', () => {
    expect(
      recomputeBillTotal({
        subtotal_kobo: 15000,
        service_charge_kobo: 1500,
        tax_kobo: 1125,
        delivery_fee_kobo: 500,
        discount_kobo: 1000,
      }),
    ).toBe(17125);
  });

  it('treats missing components as zero and floors at zero', () => {
    expect(
      recomputeBillTotal({
        subtotal_kobo: 1000,
        service_charge_kobo: 100,
        discount_kobo: 5000,
      }),
    ).toBe(0);
  });
});
