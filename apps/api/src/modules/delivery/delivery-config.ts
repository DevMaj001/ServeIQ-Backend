export interface DeliveryConfig {
  enabled: boolean;
  fee_kobo: number;
  rider_payout_kobo: number;
}

const EMPTY: DeliveryConfig = {
  enabled: false,
  fee_kobo: 0,
  rider_payout_kobo: 0,
};

/**
 * Delivery configuration lives in branch.settings.delivery
 * `{ enabled?: boolean; fee_kobo?: number; rider_payout_kobo?: number }`.
 * No migration needed — settings is an existing jsonb column.
 */
export function getDeliveryConfig(
  branch: { settings?: any } | null | undefined,
): DeliveryConfig {
  const d = branch?.settings?.delivery;
  if (!d || typeof d !== 'object') return EMPTY;
  return {
    enabled: Boolean(d.enabled),
    fee_kobo: Number(d.fee_kobo) || 0,
    rider_payout_kobo: Number(d.rider_payout_kobo) || 0,
  };
}
