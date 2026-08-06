import { MigrationInterface, QueryRunner } from 'typeorm';

// Consolidates the ad-hoc DDL previously executed on every boot by
// `src/database/ensure-tables.ts`. All statements are idempotent
// (IF NOT EXISTS / WHERE NOT EXISTS) so this migration is safe on both
// a fresh database and the live database where `ensureTables` already
// applied these changes. Registration replaces runtime schema mutation
// with proper, versioned migrations.
export class ConsolidateEnsureTables1800000000005 implements MigrationInterface {
  name = 'ConsolidateEnsureTables1800000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Tabs
    await queryRunner.query(
      `ALTER TABLE "tabs" ADD COLUMN IF NOT EXISTS "shift_id" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tabs_shift_id" ON "tabs" ("shift_id")`,
    );

    // Businesses: brand colors
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "brand_primary_color" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "brand_accent_color" character varying`,
    );

    // Plans: correct legacy NGN prices (idempotent — same value on re-run)
    await queryRunner.query(
      `UPDATE "plans" SET "price" = 3500000 WHERE "name" = 'Pro' AND "currency" = 'NGN' AND "price" IN (2500000, 35000)`,
    );
    await queryRunner.query(
      `UPDATE "plans" SET "price" = 10000000 WHERE "name" = 'Enterprise' AND "currency" = 'NGN' AND "price" IN (7500000, 100000)`,
    );

    // Plans: multi-currency equivalents (idempotent by name + currency)
    await queryRunner.query(
      `INSERT INTO "plans" ("name", "price", "currency", "billing_interval", "features", "is_active") SELECT 'Pro', 2200, 'USD', 'monthly', '{"max_tables": 20, "max_waiters": 15, "reporting_enabled": true}', true WHERE NOT EXISTS (SELECT 1 FROM "plans" WHERE "name" = 'Pro' AND "currency" = 'USD')`,
    );
    await queryRunner.query(
      `INSERT INTO "plans" ("name", "price", "currency", "billing_interval", "features", "is_active") SELECT 'Pro', 1700, 'GBP', 'monthly', '{"max_tables": 20, "max_waiters": 15, "reporting_enabled": true}', true WHERE NOT EXISTS (SELECT 1 FROM "plans" WHERE "name" = 'Pro' AND "currency" = 'GBP')`,
    );
    await queryRunner.query(
      `INSERT INTO "plans" ("name", "price", "currency", "billing_interval", "features", "is_active") SELECT 'Pro', 2000, 'EUR', 'monthly', '{"max_tables": 20, "max_waiters": 15, "reporting_enabled": true}', true WHERE NOT EXISTS (SELECT 1 FROM "plans" WHERE "name" = 'Pro' AND "currency" = 'EUR')`,
    );
    await queryRunner.query(
      `INSERT INTO "plans" ("name", "price", "currency", "billing_interval", "features", "is_active") SELECT 'Enterprise', 6250, 'USD', 'monthly', '{"max_tables": 100, "max_waiters": 50, "reporting_enabled": true}', true WHERE NOT EXISTS (SELECT 1 FROM "plans" WHERE "name" = 'Enterprise' AND "currency" = 'USD')`,
    );
    await queryRunner.query(
      `INSERT INTO "plans" ("name", "price", "currency", "billing_interval", "features", "is_active") SELECT 'Enterprise', 4900, 'GBP', 'monthly', '{"max_tables": 100, "max_waiters": 50, "reporting_enabled": true}', true WHERE NOT EXISTS (SELECT 1 FROM "plans" WHERE "name" = 'Enterprise' AND "currency" = 'GBP')`,
    );
    await queryRunner.query(
      `INSERT INTO "plans" ("name", "price", "currency", "billing_interval", "features", "is_active") SELECT 'Enterprise', 5700, 'EUR', 'monthly', '{"max_tables": 100, "max_waiters": 50, "reporting_enabled": true}', true WHERE NOT EXISTS (SELECT 1 FROM "plans" WHERE "name" = 'Enterprise' AND "currency" = 'EUR')`,
    );

    // Bills: drop unique tab index, add split/tax-follow fields
    await queryRunner.query(`DROP INDEX IF EXISTS "bills_tab_id_unique"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bills_tab_id"`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_bills_tab_id" ON "bills" ("tab_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "payment_status" varchar(20) NOT NULL DEFAULT 'pending'`,
    );
    await queryRunner.query(
      `ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "split_group" varchar(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "voided_at" timestamptz`,
    );

    // Orders: modifiers
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "modifiers" jsonb`,
    );

    // Printers
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "printers" (
            "id" uuid NOT NULL DEFAULT gen_random_uuid(),
            "branch_id" uuid NOT NULL,
            "name" varchar(100) NOT NULL,
            "interface_type" varchar(20) NOT NULL DEFAULT 'network',
            "ip_address" varchar(255),
            "port" int NOT NULL DEFAULT 9100,
            "character_per_line" int NOT NULL DEFAULT 80,
            "is_default" boolean NOT NULL DEFAULT false,
            "is_active" boolean NOT NULL DEFAULT true,
            "print_type" varchar(50) NOT NULL DEFAULT 'receipt',
            "created_at" timestamptz NOT NULL DEFAULT NOW(),
            "updated_at" timestamptz NOT NULL DEFAULT NOW(),
            CONSTRAINT "PK_printers" PRIMARY KEY ("id")
        )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_printers_branch_id" ON "printers" ("branch_id")`,
    );

    // Print jobs
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "print_jobs" (
            "id" uuid NOT NULL DEFAULT gen_random_uuid(),
            "branch_id" uuid NOT NULL,
            "printer_id" uuid,
            "job_type" varchar(30) NOT NULL,
            "payload" jsonb NOT NULL,
            "status" varchar(20) NOT NULL DEFAULT 'pending',
            "error_message" text,
            "retry_count" int NOT NULL DEFAULT 0,
            "created_at" timestamptz NOT NULL DEFAULT NOW(),
            "printed_at" timestamptz,
            CONSTRAINT "PK_print_jobs" PRIMARY KEY ("id")
        )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_print_jobs_branch_id" ON "print_jobs" ("branch_id")`,
    );

    // Sync queue
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "sync_queue" (
            "id" uuid NOT NULL DEFAULT gen_random_uuid(),
            "branch_id" uuid NOT NULL,
            "entity_type" varchar(50) NOT NULL,
            "operation" varchar(20) NOT NULL,
            "entity_id" uuid,
            "payload" jsonb NOT NULL,
            "status" varchar(20) NOT NULL DEFAULT 'pending',
            "error_message" text,
            "client_idempotency_key" varchar(64),
            "created_at" timestamptz NOT NULL DEFAULT NOW(),
            "processed_at" timestamptz,
            CONSTRAINT "PK_sync_queue" PRIMARY KEY ("id")
        )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sync_queue_branch_id" ON "sync_queue" ("branch_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_sync_queue_client_key" ON "sync_queue" ("client_idempotency_key") WHERE "client_idempotency_key" IS NOT NULL`,
    );

    // Modifier groups
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "modifier_groups" (
            "id" uuid NOT NULL DEFAULT gen_random_uuid(),
            "branch_id" uuid NOT NULL,
            "name" varchar(100) NOT NULL,
            "min_select" int NOT NULL DEFAULT 0,
            "max_select" int NOT NULL DEFAULT 99,
            "required" boolean NOT NULL DEFAULT false,
            "sort_order" int NOT NULL DEFAULT 0,
            "created_at" timestamptz NOT NULL DEFAULT NOW(),
            "updated_at" timestamptz NOT NULL DEFAULT NOW(),
            CONSTRAINT "PK_modifier_groups" PRIMARY KEY ("id")
        )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_modifier_groups_branch_id" ON "modifier_groups" ("branch_id")`,
    );

    // Modifier options
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "modifier_options" (
            "id" uuid NOT NULL DEFAULT gen_random_uuid(),
            "modifier_group_id" uuid NOT NULL REFERENCES "modifier_groups"("id") ON DELETE CASCADE,
            "name" varchar(100) NOT NULL,
            "price_kobo" int NOT NULL DEFAULT 0,
            "max_qty" int NOT NULL DEFAULT 1,
            "track_stock" boolean NOT NULL DEFAULT false,
            "quantity_in_stock" decimal(12,3) NOT NULL DEFAULT 0,
            "sort_order" int NOT NULL DEFAULT 0,
            "is_available" boolean NOT NULL DEFAULT true,
            "created_at" timestamptz NOT NULL DEFAULT NOW(),
            "updated_at" timestamptz NOT NULL DEFAULT NOW(),
            CONSTRAINT "PK_modifier_options" PRIMARY KEY ("id")
        )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_modifier_options_group_id" ON "modifier_options" ("modifier_group_id")`,
    );

    // Menu item <-> modifier group junction
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "menu_item_modifier_groups" (
            "menu_item_id" uuid NOT NULL REFERENCES "menu_items"("id") ON DELETE CASCADE,
            "modifier_group_id" uuid NOT NULL REFERENCES "modifier_groups"("id") ON DELETE CASCADE,
            CONSTRAINT "PK_menu_item_modifier_groups" PRIMARY KEY ("menu_item_id", "modifier_group_id")
        )`);
  }

  public down(): Promise<void> {
    // No-op: reverse of an idempotent consolidation is intentionally
    // not executed (dropping live tables/columns is destructive).
    return Promise.resolve();
  }
}
