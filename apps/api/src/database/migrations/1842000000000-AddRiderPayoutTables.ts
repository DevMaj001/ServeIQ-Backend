import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRiderPayoutTables1842000000000 implements MigrationInterface {
  name = 'AddRiderPayoutTables1842000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add payout tracking columns to deliveries
    await queryRunner.query(`
      ALTER TABLE "deliveries"
        ADD COLUMN IF NOT EXISTS "payout_status" varchar(20) NOT NULL DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS "paid_at" timestamptz;
      CREATE INDEX IF NOT EXISTS "IDX_deliveries_payout_status" ON "deliveries" ("payout_status");
      CREATE INDEX IF NOT EXISTS "IDX_deliveries_rider_payout" ON "deliveries" ("rider_id", "payout_status");
    `);

    // 2. Rider ledger — immutable audit trail of every credit/debit
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "rider_ledger" (
        "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "rider_id"     uuid NOT NULL REFERENCES "riders"("id") ON DELETE CASCADE,
        "business_id"  uuid NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,
        "type"         varchar(30) NOT NULL, -- 'delivery_earning', 'payout', 'adjustment'
        "amount_kobo"  int NOT NULL,          -- positive = credit to rider, negative = debit
        "ref_type"     varchar(30),           -- 'delivery', 'manual_payout', 'batch_payout'
        "ref_id"       uuid,                  -- delivery.id or payout_batches.id
        "description"  text,
        "created_at"   timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "IDX_rider_ledger_rider" ON "rider_ledger" ("rider_id", "created_at");
      CREATE INDEX IF NOT EXISTS "IDX_rider_ledger_ref" ON "rider_ledger" ("ref_type", "ref_id");
    `);

    // 3. Payout batches — records of actual bank transfers to riders
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payout_batches" (
        "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "business_id"          uuid NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,
        "rider_id"             uuid NOT NULL REFERENCES "riders"("id") ON DELETE CASCADE,
        "provider"             varchar(20) NOT NULL, -- 'paystack', 'flutterwave', 'manual'
        "provider_batch_id"    varchar(100),         -- transfer code / reference from provider
        "total_kobo"           int NOT NULL,
        "status"               varchar(20) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
        "failure_reason"       text,
        "created_by"           uuid REFERENCES "users"("id"),
        "created_at"           timestamptz NOT NULL DEFAULT now(),
        "completed_at"         timestamptz
      );
      CREATE INDEX IF NOT EXISTS "IDX_payout_batches_business" ON "payout_batches" ("business_id", "created_at");
      CREATE INDEX IF NOT EXISTS "IDX_payout_batches_rider" ON "payout_batches" ("rider_id", "created_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payout_batches"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rider_ledger"`);
    await queryRunner.query(`
      ALTER TABLE "deliveries"
        DROP COLUMN IF EXISTS "payout_status",
        DROP COLUMN IF EXISTS "paid_at";
    `);
  }
}