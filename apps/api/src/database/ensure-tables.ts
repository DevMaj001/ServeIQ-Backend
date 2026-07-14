import { DataSource } from 'typeorm';

export async function ensureTables(ds: DataSource) {
  const hasModifierGroups = await ds.query(
    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'modifier_groups')`
  ).then(r => r[0]?.exists);

  // Always apply shift_id column (independent of modifier_groups guard)
  await ds.query(`ALTER TABLE "tabs" ADD COLUMN IF NOT EXISTS "shift_id" uuid`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "IDX_tabs_shift_id" ON "tabs" ("shift_id")`);

  // Always apply brand color columns
  await ds.query(`ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "brand_primary_color" character varying`);
  await ds.query(`ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "brand_accent_color" character varying`);

  // Update plan prices (NGN kobo) — catches old seed values and any previous bad deploy values
  await ds.query(`UPDATE "plans" SET "price" = 3500000 WHERE "name" = 'Pro' AND "currency" = 'NGN' AND "price" IN (2500000, 35000)`);
  await ds.query(`UPDATE "plans" SET "price" = 10000000 WHERE "name" = 'Enterprise' AND "currency" = 'NGN' AND "price" IN (7500000, 100000)`);

  // Insert multi-currency equivalents if they don't exist yet
  await ds.query(`INSERT INTO "plans" ("name", "price", "currency", "billing_interval", "features", "is_active") SELECT 'Pro', 2200, 'USD', 'monthly', '{"max_tables": 20, "max_waiters": 15, "reporting_enabled": true}', true WHERE NOT EXISTS (SELECT 1 FROM "plans" WHERE "name" = 'Pro' AND "currency" = 'USD')`);
  await ds.query(`INSERT INTO "plans" ("name", "price", "currency", "billing_interval", "features", "is_active") SELECT 'Pro', 1700, 'GBP', 'monthly', '{"max_tables": 20, "max_waiters": 15, "reporting_enabled": true}', true WHERE NOT EXISTS (SELECT 1 FROM "plans" WHERE "name" = 'Pro' AND "currency" = 'GBP')`);
  await ds.query(`INSERT INTO "plans" ("name", "price", "currency", "billing_interval", "features", "is_active") SELECT 'Pro', 2000, 'EUR', 'monthly', '{"max_tables": 20, "max_waiters": 15, "reporting_enabled": true}', true WHERE NOT EXISTS (SELECT 1 FROM "plans" WHERE "name" = 'Pro' AND "currency" = 'EUR')`);
  await ds.query(`INSERT INTO "plans" ("name", "price", "currency", "billing_interval", "features", "is_active") SELECT 'Enterprise', 6250, 'USD', 'monthly', '{"max_tables": 100, "max_waiters": 50, "reporting_enabled": true}', true WHERE NOT EXISTS (SELECT 1 FROM "plans" WHERE "name" = 'Enterprise' AND "currency" = 'USD')`);
  await ds.query(`INSERT INTO "plans" ("name", "price", "currency", "billing_interval", "features", "is_active") SELECT 'Enterprise', 4900, 'GBP', 'monthly', '{"max_tables": 100, "max_waiters": 50, "reporting_enabled": true}', true WHERE NOT EXISTS (SELECT 1 FROM "plans" WHERE "name" = 'Enterprise' AND "currency" = 'GBP')`);
  await ds.query(`INSERT INTO "plans" ("name", "price", "currency", "billing_interval", "features", "is_active") SELECT 'Enterprise', 5700, 'EUR', 'monthly', '{"max_tables": 100, "max_waiters": 50, "reporting_enabled": true}', true WHERE NOT EXISTS (SELECT 1 FROM "plans" WHERE "name" = 'Enterprise' AND "currency" = 'EUR')`);

  if (hasModifierGroups) return;

  console.log('[ensureTables] Running deferred DDL for modifiers, splits, sync, printing...');

  await ds.query(`DROP INDEX IF EXISTS "bills_tab_id_unique"`);
  await ds.query(`DROP INDEX IF EXISTS "IDX_bills_tab_id"`);
  await ds.query(`CREATE INDEX "IDX_bills_tab_id" ON "bills" ("tab_id")`);
  await ds.query(`ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "payment_status" varchar(20) NOT NULL DEFAULT 'pending'`);
  await ds.query(`ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "split_group" varchar(50)`);
  await ds.query(`ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "voided_at" timestamptz`);
  await ds.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "modifiers" jsonb`);

  await ds.query(`CREATE TABLE IF NOT EXISTS "printers" (
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
  await ds.query(`CREATE INDEX IF NOT EXISTS "IDX_printers_branch_id" ON "printers" ("branch_id")`);

  await ds.query(`CREATE TABLE IF NOT EXISTS "print_jobs" (
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
  await ds.query(`CREATE INDEX IF NOT EXISTS "IDX_print_jobs_branch_id" ON "print_jobs" ("branch_id")`);

  await ds.query(`CREATE TABLE IF NOT EXISTS "sync_queue" (
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
  await ds.query(`CREATE INDEX IF NOT EXISTS "IDX_sync_queue_branch_id" ON "sync_queue" ("branch_id")`);
  await ds.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_sync_queue_client_key" ON "sync_queue" ("client_idempotency_key") WHERE "client_idempotency_key" IS NOT NULL`);

  await ds.query(`CREATE TABLE IF NOT EXISTS "modifier_groups" (
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
  await ds.query(`CREATE INDEX IF NOT EXISTS "IDX_modifier_groups_branch_id" ON "modifier_groups" ("branch_id")`);

  await ds.query(`CREATE TABLE IF NOT EXISTS "modifier_options" (
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
  await ds.query(`CREATE INDEX IF NOT EXISTS "IDX_modifier_options_group_id" ON "modifier_options" ("modifier_group_id")`);

  await ds.query(`CREATE TABLE IF NOT EXISTS "menu_item_modifier_groups" (
    "menu_item_id" uuid NOT NULL REFERENCES "menu_items"("id") ON DELETE CASCADE,
    "modifier_group_id" uuid NOT NULL REFERENCES "modifier_groups"("id") ON DELETE CASCADE,
    CONSTRAINT "PK_menu_item_modifier_groups" PRIMARY KEY ("menu_item_id", "modifier_group_id")
  )`);

  console.log('[ensureTables] DDL complete');
}
