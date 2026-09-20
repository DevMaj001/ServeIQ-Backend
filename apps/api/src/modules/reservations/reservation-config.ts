export interface ReservationConfig {
  enabled: boolean;
  advance_days: number;
  min_party_size: number;
  max_party_size: number;
  slot_interval_minutes: number;
  default_duration_minutes: number;
  require_confirmation: boolean;
  auto_confirm: boolean;
  reminder_minutes_before: number;
  hold_minutes: number;
  allow_online: boolean;
  walkin_buffer_minutes: number;
  opening_time: string; // "HH:mm" format
  closing_time: string; // "HH:mm" format
}

const DEFAULT_CONFIG: ReservationConfig = {
  enabled: false,
  advance_days: 30,
  min_party_size: 1,
  max_party_size: 12,
  slot_interval_minutes: 30,
  default_duration_minutes: 90,
  require_confirmation: true,
  auto_confirm: false,
  reminder_minutes_before: 60,
  hold_minutes: 15,
  allow_online: true,
  walkin_buffer_minutes: 30,
  opening_time: '11:00',
  closing_time: '22:00',
};

export function getReservationConfig(
  branch: { settings?: any } | null | undefined,
): ReservationConfig {
  const r = branch?.settings?.reservation;
  if (!r || typeof r !== 'object') return DEFAULT_CONFIG;

  const num = (v: unknown, fallback: number): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const bool = (v: unknown, fallback: boolean): boolean =>
    typeof v === 'boolean' ? v : fallback;

  return {
    enabled: bool(r.enabled, DEFAULT_CONFIG.enabled),
    advance_days: num(r.advance_days, DEFAULT_CONFIG.advance_days),
    min_party_size: num(r.min_party_size, DEFAULT_CONFIG.min_party_size),
    max_party_size: num(r.max_party_size, DEFAULT_CONFIG.max_party_size),
    slot_interval_minutes: num(
      r.slot_interval_minutes,
      DEFAULT_CONFIG.slot_interval_minutes,
    ),
    default_duration_minutes: num(
      r.default_duration_minutes,
      DEFAULT_CONFIG.default_duration_minutes,
    ),
    require_confirmation: bool(
      r.require_confirmation,
      DEFAULT_CONFIG.require_confirmation,
    ),
    auto_confirm: bool(r.auto_confirm, DEFAULT_CONFIG.auto_confirm),
    reminder_minutes_before: num(
      r.reminder_minutes_before,
      DEFAULT_CONFIG.reminder_minutes_before,
    ),
    hold_minutes: num(r.hold_minutes, DEFAULT_CONFIG.hold_minutes),
    allow_online: bool(r.allow_online, DEFAULT_CONFIG.allow_online),
    walkin_buffer_minutes: num(
      r.walkin_buffer_minutes,
      DEFAULT_CONFIG.walkin_buffer_minutes,
    ),
    opening_time:
      typeof r.opening_time === 'string' && r.opening_time
        ? r.opening_time
        : DEFAULT_CONFIG.opening_time,
    closing_time:
      typeof r.closing_time === 'string' && r.closing_time
        ? r.closing_time
        : DEFAULT_CONFIG.closing_time,
  };
}

export function getAvailableSlots(
  config: ReservationConfig,
  date: Date,
  existingReservations: {
    reservation_time: Date;
    duration_minutes: number;
    table_id: string | null;
  }[],
  tables: { id: string; capacity: number }[],
  partySize: number,
): { start: Date; end: Date; availableTables: string[] }[] {
  const slots: { start: Date; end: Date; availableTables: string[] }[] = [];

  const [openH, openM] = config.opening_time.split(':').map(Number);
  const [closeH, closeM] = config.closing_time.split(':').map(Number);

  const dayStart = new Date(date);
  dayStart.setHours(openH, openM, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setHours(closeH, closeM, 0, 0);

  const slotMs = config.slot_interval_minutes * 60 * 1000;
  const minDurationMs = config.default_duration_minutes * 60 * 1000;

  for (
    let slotStart = new Date(dayStart);
    slotStart < dayEnd;
    slotStart = new Date(slotStart.getTime() + slotMs)
  ) {
    const slotEnd = new Date(slotStart.getTime() + minDurationMs);
    if (slotEnd > dayEnd) break;

    // Find tables that can accommodate partySize and are free during this slot
    const suitableTables = tables.filter((t) => t.capacity >= partySize);
    const availableTables: string[] = [];

    for (const table of suitableTables) {
      const conflict = existingReservations.some(
        (res) =>
          res.table_id === table.id &&
          res.reservation_time < slotEnd &&
          new Date(
            res.reservation_time.getTime() + res.duration_minutes * 60 * 1000,
          ) > slotStart,
      );
      if (!conflict) availableTables.push(table.id);
    }

    if (availableTables.length > 0) {
      slots.push({
        start: new Date(slotStart),
        end: new Date(slotEnd),
        availableTables,
      });
    }
  }

  return slots;
}
