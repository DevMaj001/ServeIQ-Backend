import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaxRateToBusiness1782747664791 implements MigrationInterface {
  name = 'AddTaxRateToBusiness1782747664791';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "branch_id" uuid NOT NULL, "user_id" uuid, "action" character varying NOT NULL, "entity_id" uuid, "entity_type" character varying, "payload" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ee4c6baac8b07dc19433e575cb" ON "audit_logs"  ("branch_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "token_hash" character varying NOT NULL, "expires_at" TIMESTAMP NOT NULL, "is_revoked" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_3ddc983c5f7bcf132fd8732c3f" ON "refresh_tokens"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "verification_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "token" character varying NOT NULL, "type" character varying NOT NULL, "expires_at" TIMESTAMP NOT NULL, "is_used" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f2d4d7a2aa57ef199e61567db22" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_31d2079dc4079b80517d31cf4f" ON "verification_tokens"  ("user_id") `,
    );
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_movements_movement_type_enum') THEN CREATE TYPE "public"."stock_movements_movement_type_enum" AS ENUM('purchase', 'sale', 'adjustment', 'wastage'); END IF; END $$`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "stock_movements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "branch_id" uuid NOT NULL, "inventory_item_id" uuid NOT NULL, "quantity_change" integer NOT NULL, "quantity_after" integer NOT NULL DEFAULT '0', "movement_type" "public"."stock_movements_movement_type_enum" NOT NULL, "reference_id" uuid, "notes" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_57a26b190618550d8e65fb860e7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_b85448ca9ec4bb8fc5eefb0c29" ON "stock_movements"  ("branch_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_37c4270994f24036b3fbe40ce8" ON "stock_movements"  ("inventory_item_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "inventory_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "branch_id" uuid NOT NULL, "menu_item_id" uuid NOT NULL, "quantity_in_stock" integer NOT NULL DEFAULT '0', "reorder_level" integer NOT NULL DEFAULT '10', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_cf2f451407242e132547ac19169" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_687d174ee41f46d2ee4b0a241a" ON "inventory_items"  ("branch_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_4901ce8da083204cdc424cd85e" ON "inventory_items"  ("menu_item_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_62c2e5d5f2e6d35d04a651796f" ON "inventory_items"  ("branch_id", "menu_item_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "shifts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "branch_id" uuid NOT NULL, "opened_by" uuid NOT NULL, "closed_by" uuid, "starting_cash_kobo" integer NOT NULL DEFAULT '0', "expected_cash_kobo" integer, "actual_cash_kobo" integer, "variance_kobo" integer, "opened_at" TIMESTAMP, "closed_at" TIMESTAMP, "status" character varying NOT NULL DEFAULT 'open', "note" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_84d692e367e4d6cdf045828768c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cddc0af590dd113d6e5b6b530c" ON "shifts"  ("branch_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "suppliers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "branch_id" uuid NOT NULL, "name" character varying NOT NULL, "contact_person" character varying, "phone" character varying, "email" character varying, "address" character varying, "note" character varying, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_b70ac51766a9e3144f778cfe81e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ce35fd787e09aecdb311aaff66" ON "suppliers"  ("branch_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "tax_rate" numeric(5,2) NOT NULL DEFAULT '7.5'`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "timezone" character varying NOT NULL DEFAULT 'Africa/Lagos'`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_0eddfeffadbe29bec8750d589c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bills" DROP COLUMN IF EXISTS "tab_id"`,
    );
    await queryRunner.query(`ALTER TABLE "bills" ADD "tab_id" uuid`);
    await queryRunner.query(`DELETE FROM "bills" WHERE "tab_id" IS NULL`);
    await queryRunner.query(
      `ALTER TABLE "bills" ALTER COLUMN "tab_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_29171753dda776dfb0037dba05"`,
    );
    await queryRunner.query(
      `ALTER TABLE "menu_items" DROP COLUMN IF EXISTS "branch_id"`,
    );
    await queryRunner.query(`ALTER TABLE "menu_items" ADD "branch_id" uuid`);
    await queryRunner.query(
      `DELETE FROM "menu_items" WHERE "branch_id" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "menu_items" ALTER COLUMN "branch_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_03ef7c5c41b4fa6d62d27d47f4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "tab_id"`,
    );
    await queryRunner.query(`ALTER TABLE "orders" ADD "tab_id" uuid`);
    await queryRunner.query(`DELETE FROM "orders" WHERE "tab_id" IS NULL`);
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "tab_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_6290f6ba23d55826e9deaceee5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "menu_item_id"`,
    );
    await queryRunner.query(`ALTER TABLE "orders" ADD "menu_item_id" uuid`);
    await queryRunner.query(
      `DELETE FROM "orders" WHERE "menu_item_id" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "menu_item_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_4d5057e0cdbd1407b60216df6e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tabs" DROP COLUMN IF EXISTS "branch_id"`,
    );
    await queryRunner.query(`ALTER TABLE "tabs" ADD "branch_id" uuid`);
    await queryRunner.query(`DELETE FROM "tabs" WHERE "branch_id" IS NULL`);
    await queryRunner.query(
      `ALTER TABLE "tabs" ALTER COLUMN "branch_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_1e4fa66a2d59fde6dbb07fb13a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tabs" DROP COLUMN IF EXISTS "table_id"`,
    );
    await queryRunner.query(`ALTER TABLE "tabs" ADD "table_id" uuid`);
    await queryRunner.query(`DELETE FROM "tabs" WHERE "table_id" IS NULL`);
    await queryRunner.query(
      `ALTER TABLE "tabs" ALTER COLUMN "table_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_2b477b0f678402fb70905e3aed"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tabs" DROP COLUMN IF EXISTS "waiter_id"`,
    );
    await queryRunner.query(`ALTER TABLE "tabs" ADD "waiter_id" uuid`);
    await queryRunner.query(`DELETE FROM "tabs" WHERE "waiter_id" IS NULL`);
    await queryRunner.query(
      `ALTER TABLE "tabs" ALTER COLUMN "waiter_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_ebe158ed365131baec7dccaae5"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_283e6bfdd38a7cc7fec643f72b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tables" DROP COLUMN IF EXISTS "branch_id"`,
    );
    await queryRunner.query(`ALTER TABLE "tables" ADD "branch_id" uuid`);
    await queryRunner.query(`DELETE FROM "tables" WHERE "branch_id" IS NULL`);
    await queryRunner.query(
      `ALTER TABLE "tables" ALTER COLUMN "branch_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_0eddfeffadbe29bec8750d589c" ON "bills"  ("tab_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_29171753dda776dfb0037dba05" ON "menu_items"  ("branch_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_03ef7c5c41b4fa6d62d27d47f4" ON "orders"  ("tab_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_6290f6ba23d55826e9deaceee5" ON "orders"  ("menu_item_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_4d5057e0cdbd1407b60216df6e" ON "tabs"  ("branch_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_1e4fa66a2d59fde6dbb07fb13a" ON "tabs"  ("table_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_2b477b0f678402fb70905e3aed" ON "tabs"  ("waiter_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_283e6bfdd38a7cc7fec643f72b" ON "tables"  ("branch_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ebe158ed365131baec7dccaae5" ON "tables"  ("branch_id", "table_number") `,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_items" ADD CONSTRAINT "FK_4901ce8da083204cdc424cd85e5" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inventory_items" DROP CONSTRAINT "FK_4901ce8da083204cdc424cd85e5"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ebe158ed365131baec7dccaae5"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_283e6bfdd38a7cc7fec643f72b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2b477b0f678402fb70905e3aed"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1e4fa66a2d59fde6dbb07fb13a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4d5057e0cdbd1407b60216df6e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6290f6ba23d55826e9deaceee5"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_03ef7c5c41b4fa6d62d27d47f4"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_29171753dda776dfb0037dba05"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0eddfeffadbe29bec8750d589c"`,
    );
    await queryRunner.query(`ALTER TABLE "tables" DROP COLUMN "branch_id"`);
    await queryRunner.query(
      `ALTER TABLE "tables" ADD "branch_id" character varying NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_283e6bfdd38a7cc7fec643f72b" ON "tables" USING btree ("branch_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ebe158ed365131baec7dccaae5" ON "tables" USING btree ("branch_id", "table_number") `,
    );
    await queryRunner.query(`ALTER TABLE "tabs" DROP COLUMN "waiter_id"`);
    await queryRunner.query(
      `ALTER TABLE "tabs" ADD "waiter_id" character varying NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2b477b0f678402fb70905e3aed" ON "tabs" USING btree ("waiter_id") `,
    );
    await queryRunner.query(`ALTER TABLE "tabs" DROP COLUMN "table_id"`);
    await queryRunner.query(
      `ALTER TABLE "tabs" ADD "table_id" character varying NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1e4fa66a2d59fde6dbb07fb13a" ON "tabs" USING btree ("table_id") `,
    );
    await queryRunner.query(`ALTER TABLE "tabs" DROP COLUMN "branch_id"`);
    await queryRunner.query(
      `ALTER TABLE "tabs" ADD "branch_id" character varying NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4d5057e0cdbd1407b60216df6e" ON "tabs" USING btree ("branch_id") `,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "menu_item_id"`);
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "menu_item_id" character varying NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6290f6ba23d55826e9deaceee5" ON "orders" USING btree ("menu_item_id") `,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "tab_id"`);
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "tab_id" character varying NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_03ef7c5c41b4fa6d62d27d47f4" ON "orders" USING btree ("tab_id") `,
    );
    await queryRunner.query(`ALTER TABLE "menu_items" DROP COLUMN "branch_id"`);
    await queryRunner.query(
      `ALTER TABLE "menu_items" ADD "branch_id" character varying NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_29171753dda776dfb0037dba05" ON "menu_items" USING btree ("branch_id") `,
    );
    await queryRunner.query(`ALTER TABLE "bills" DROP COLUMN "tab_id"`);
    await queryRunner.query(
      `ALTER TABLE "bills" ADD "tab_id" character varying NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_0eddfeffadbe29bec8750d589c" ON "bills" USING btree ("tab_id") `,
    );
    await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN "timezone"`);
    await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN "tax_rate"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ce35fd787e09aecdb311aaff66"`,
    );
    await queryRunner.query(`DROP TABLE "suppliers"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cddc0af590dd113d6e5b6b530c"`,
    );
    await queryRunner.query(`DROP TABLE "shifts"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_62c2e5d5f2e6d35d04a651796f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4901ce8da083204cdc424cd85e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_687d174ee41f46d2ee4b0a241a"`,
    );
    await queryRunner.query(`DROP TABLE "inventory_items"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_37c4270994f24036b3fbe40ce8"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b85448ca9ec4bb8fc5eefb0c29"`,
    );
    await queryRunner.query(`DROP TABLE "stock_movements"`);
    await queryRunner.query(
      `DROP TYPE "public"."stock_movements_movement_type_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_31d2079dc4079b80517d31cf4f"`,
    );
    await queryRunner.query(`DROP TABLE "verification_tokens"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3ddc983c5f7bcf132fd8732c3f"`,
    );
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ee4c6baac8b07dc19433e575cb"`,
    );
    await queryRunner.query(`DROP TABLE "audit_logs"`);
  }
}
