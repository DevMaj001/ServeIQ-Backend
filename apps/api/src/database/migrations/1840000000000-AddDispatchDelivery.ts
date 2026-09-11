import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDispatchDelivery1840000000000 implements MigrationInterface {
  name = 'AddDispatchDelivery1840000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Ensure the 'rider' value exists in the users role enum (if column is
    //    still a PG enum). If the column is already varchar this is a harmless
    //    no-op wrapped in try/catch.
    try {
      await queryRunner.query(
        `ALTER TYPE "users_role_enum" ADD VALUE IF NOT EXISTS 'rider'`,
      );
    } catch {
      // column might already be varchar — safe to ignore
    }

    // 2. Riders table – one row per rider-user.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "riders" (
        "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"      uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "business_id"  uuid NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,
        "branch_id"    uuid NOT NULL REFERENCES "branches"("id") ON DELETE CASCADE,
        "is_online"    boolean NOT NULL DEFAULT false,
        "vehicle"      varchar(100),
        "created_at"   timestamptz NOT NULL DEFAULT now(),
        "updated_at"   timestamptz NOT NULL DEFAULT now(),
        "version"      int NOT NULL DEFAULT 1,
        CONSTRAINT "UQ_riders_user_id" UNIQUE ("user_id")
      );
      CREATE INDEX IF NOT EXISTS "IDX_riders_branch_id" ON "riders" ("branch_id");
      CREATE INDEX IF NOT EXISTS "IDX_riders_business_id" ON "riders" ("business_id");
    `);

    // 3. Deliveries table – tracks dispatch lifecycle per tab.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "deliveries" (
        "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tab_id"       uuid NOT NULL REFERENCES "tabs"("id") ON DELETE CASCADE,
        "branch_id"    uuid NOT NULL REFERENCES "branches"("id") ON DELETE CASCADE,
        "status"       varchar(20) NOT NULL DEFAULT 'pending',
        "rider_id"     uuid REFERENCES "riders"("id") ON DELETE SET NULL,
        "fee_kobo"     int NOT NULL DEFAULT 0,
        "payout_kobo"  int NOT NULL DEFAULT 0,
        "accepted_at"  timestamptz,
        "delivered_at" timestamptz,
        "cancelled_at" timestamptz,
        "created_at"   timestamptz NOT NULL DEFAULT now(),
        "updated_at"   timestamptz NOT NULL DEFAULT now(),
        "version"      int NOT NULL DEFAULT 1,
        "deleted_at"   timestamptz
      );
      CREATE INDEX IF NOT EXISTS "IDX_deliveries_tab_id" ON "deliveries" ("tab_id");
      CREATE INDEX IF NOT EXISTS "IDX_deliveries_branch_id" ON "deliveries" ("branch_id");
      CREATE INDEX IF NOT EXISTS "IDX_deliveries_status" ON "deliveries" ("status");
      -- At most one ACTIVE delivery per tab (cancelled/delivered rows excluded)
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_deliveries_tab_active"
        ON "deliveries" ("tab_id")
        WHERE "deleted_at" IS NULL
          AND "status" IN ('pending', 'accepted', 'out_for_delivery');
    `);

    // 4. Tab columns – pickup mode, delivery address snapshot, delivery fee.
    await queryRunner.query(`
      ALTER TABLE "tabs"
        ADD COLUMN IF NOT EXISTS "pickup_mode" varchar(20) NOT NULL DEFAULT 'self',
        ADD COLUMN IF NOT EXISTS "delivery_details" jsonb,
        ADD COLUMN IF NOT EXISTS "delivery_fee_kobo" int NOT NULL DEFAULT 0
    `);

    // 5. Bill column – delivery fee snapshot (persisted at bill generation time).
    await queryRunner.query(`
      ALTER TABLE "bills"
        ADD COLUMN IF NOT EXISTS "delivery_fee_kobo" int NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bills" DROP COLUMN IF EXISTS "delivery_fee_kobo"`);
    await queryRunner.query(`ALTER TABLE "tabs" DROP COLUMN IF EXISTS "delivery_fee_kobo"`);
    await queryRunner.query(`ALTER TABLE "tabs" DROP COLUMN IF EXISTS "delivery_details"`);
    await queryRunner.query(`ALTER TABLE "tabs" DROP COLUMN IF EXISTS "pickup_mode"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "deliveries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "riders"`);
  }
}
