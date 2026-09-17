import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTableReservations1843000000000 implements MigrationInterface {
  name = 'AddTableReservations1843000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Reservation status enum is inline in the table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reservations" (
        "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "business_id"         uuid NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,
        "branch_id"           uuid NOT NULL REFERENCES "branches"("id") ON DELETE CASCADE,
        "table_id"            uuid REFERENCES "tables"("id") ON DELETE SET NULL,
        "customer_name"       varchar(200) NOT NULL,
        "customer_phone"      varchar(50) NOT NULL,
        "customer_email"      varchar(200),
        "party_size"          int NOT NULL,
        "reservation_time"    timestamptz NOT NULL,
        "duration_minutes"    int NOT NULL DEFAULT 90,
        "status"              varchar(20) NOT NULL DEFAULT 'pending', -- pending, confirmed, seated, completed, cancelled, no_show
        "special_requests"    text,
        "source"              varchar(20) NOT NULL DEFAULT 'public', -- public, walkin, phone, admin
        "confirmation_code"   varchar(12) NOT NULL UNIQUE,
        "reminded_at"         timestamptz,
        "seated_at"           timestamptz,
        "completed_at"        timestamptz,
        "cancelled_at"        timestamptz,
        "cancelled_by"        uuid REFERENCES "users"("id"),
        "cancellation_reason" text,
        "created_at"          timestamptz NOT NULL DEFAULT now(),
        "updated_at"          timestamptz NOT NULL DEFAULT now(),
        "version"             int NOT NULL DEFAULT 1,
        "deleted_at"          timestamptz
      );
      CREATE INDEX IF NOT EXISTS "IDX_reservations_branch_time" ON "reservations" ("branch_id", "reservation_time");
      CREATE INDEX IF NOT EXISTS "IDX_reservations_table_time" ON "reservations" ("table_id", "reservation_time");
      CREATE INDEX IF NOT EXISTS "IDX_reservations_status" ON "reservations" ("status");
      CREATE INDEX IF NOT EXISTS "IDX_reservations_confirmation" ON "reservations" ("confirmation_code");
      CREATE INDEX IF NOT EXISTS "IDX_reservations_customer_phone" ON "reservations" ("customer_phone");
    `);

    // 2. Reservation settings live in branch.settings JSONB (no separate table needed)
    // Example branch.settings:
    // {
    //   "reservation": {
    //     "enabled": true,
    //     "advance_days": 30,
    //     "min_party_size": 1,
    //     "max_party_size": 12,
    //     "slot_interval_minutes": 30,
    //     "default_duration_minutes": 90,
    //     "require_confirmation": true,
    //     "auto_confirm": false,
    //     "reminder_minutes_before": 60,
    //     "hold_minutes": 15,
    //     "allow_online": true,
    //     "walkin_buffer_minutes": 30
    //   }
    // }

    // 3. Add reservation_id to tabs for linking seated reservations to tabs
    await queryRunner.query(`
      ALTER TABLE "tabs"
        ADD COLUMN IF NOT EXISTS "reservation_id" uuid REFERENCES "reservations"("id") ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS "IDX_tabs_reservation_id" ON "tabs" ("reservation_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tabs" DROP COLUMN IF EXISTS "reservation_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reservations"`);
  }
}