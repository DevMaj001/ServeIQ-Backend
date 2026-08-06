import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsureSchemaConsistency1783000000000 implements MigrationInterface {
  name = 'EnsureSchemaConsistency1783000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add missing columns to businesses (safe — IF NOT EXISTS)
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "tax_rate" numeric(5,2) NOT NULL DEFAULT '7.5'`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "timezone" character varying NOT NULL DEFAULT 'Africa/Lagos'`,
    );

    // Create tables that may not exist yet (guarded by DO $$ to avoid PK constraint name collision with earlier migrations)
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'audit_logs') THEN CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "branch_id" uuid NOT NULL, "user_id" uuid, "action" character varying NOT NULL, "entity_id" uuid, "entity_type" character varying, "payload" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id")); END IF; END $$`,
    );
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'refresh_tokens') THEN CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "token_hash" character varying NOT NULL, "expires_at" TIMESTAMP NOT NULL, "is_revoked" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id")); END IF; END $$`,
    );
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'verification_tokens') THEN CREATE TABLE "verification_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "token" character varying NOT NULL, "type" character varying NOT NULL, "expires_at" TIMESTAMP NOT NULL, "is_used" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f2d4d7a2aa57ef199e61567db22" PRIMARY KEY ("id")); END IF; END $$`,
    );
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_movements_movement_type_enum') THEN CREATE TYPE "public"."stock_movements_movement_type_enum" AS ENUM('purchase', 'sale', 'adjustment', 'wastage'); END IF; END $$`,
    );
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'stock_movements') THEN CREATE TABLE "stock_movements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "branch_id" uuid NOT NULL, "inventory_item_id" uuid NOT NULL, "quantity_change" integer NOT NULL, "quantity_after" integer NOT NULL DEFAULT '0', "movement_type" "public"."stock_movements_movement_type_enum" NOT NULL, "reference_id" uuid, "notes" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_57a26b190618550d8e65fb860e7" PRIMARY KEY ("id")); END IF; END $$`,
    );
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'inventory_items') THEN CREATE TABLE "inventory_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "branch_id" uuid NOT NULL, "menu_item_id" uuid NOT NULL, "quantity_in_stock" integer NOT NULL DEFAULT '0', "reorder_level" integer NOT NULL DEFAULT '10', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_cf2f451407242e132547ac19169" PRIMARY KEY ("id")); END IF; END $$`,
    );
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'shifts') THEN CREATE TABLE "shifts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "branch_id" uuid NOT NULL, "opened_by" uuid NOT NULL, "closed_by" uuid, "starting_cash_kobo" integer NOT NULL DEFAULT '0', "expected_cash_kobo" integer, "actual_cash_kobo" integer, "variance_kobo" integer, "opened_at" TIMESTAMP, "closed_at" TIMESTAMP, "status" character varying NOT NULL DEFAULT 'open', "note" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_84d692e367e4d6cdf045828768c" PRIMARY KEY ("id")); END IF; END $$`,
    );
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'suppliers') THEN CREATE TABLE "suppliers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "branch_id" uuid NOT NULL, "name" character varying NOT NULL, "contact_person" character varying, "phone" character varying, "email" character varying, "address" character varying, "note" character varying, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_b70ac51766a9e3144f778cfe81e" PRIMARY KEY ("id")); END IF; END $$`,
    );

    // Create indexes (safe — IF NOT EXISTS)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ee4c6baac8b07dc19433e575cb" ON "audit_logs" ("branch_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_3ddc983c5f7bcf132fd8732c3f" ON "refresh_tokens" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_31d2079dc4079b80517d31cf4f" ON "verification_tokens" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_b85448ca9ec4bb8fc5eefb0c29" ON "stock_movements" ("branch_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_37c4270994f24036b3fbe40ce8" ON "stock_movements" ("inventory_item_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_687d174ee41f46d2ee4b0a241a" ON "inventory_items" ("branch_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_4901ce8da083204cdc424cd85e" ON "inventory_items" ("menu_item_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_62c2e5d5f2e6d35d04a651796f" ON "inventory_items" ("branch_id", "menu_item_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cddc0af590dd113d6e5b6b530c" ON "shifts" ("branch_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ce35fd787e09aecdb311aaff66" ON "suppliers" ("branch_id")`,
    );

    // Add FK constraint (safe — IF NOT EXISTS)
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_4901ce8da083204cdc424cd85e5') THEN ALTER TABLE "inventory_items" ADD CONSTRAINT "FK_4901ce8da083204cdc424cd85e5" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse in opposite order
    await queryRunner.query(
      `ALTER TABLE "inventory_items" DROP CONSTRAINT IF EXISTS "FK_4901ce8da083204cdc424cd85e5"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_ce35fd787e09aecdb311aaff66"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_cddc0af590dd113d6e5b6b530c"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_62c2e5d5f2e6d35d04a651796f"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_4901ce8da083204cdc424cd85e"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_687d174ee41f46d2ee4b0a241a"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_37c4270994f24036b3fbe40ce8"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_b85448ca9ec4bb8fc5eefb0c29"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_31d2079dc4079b80517d31cf4f"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_3ddc983c5f7bcf132fd8732c3f"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_ee4c6baac8b07dc19433e575cb"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "suppliers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "shifts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_movements"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."stock_movements_movement_type_enum"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "verification_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN IF EXISTS "timezone"`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN IF EXISTS "tax_rate"`,
    );
  }
}
