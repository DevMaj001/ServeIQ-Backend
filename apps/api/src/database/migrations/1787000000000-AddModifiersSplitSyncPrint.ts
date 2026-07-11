import { MigrationInterface, QueryRunner } from "typeorm";

export class AddModifiersSplitSyncPrint1787000000000 implements MigrationInterface {
    name = 'AddModifiersSplitSyncPrint1787000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Bills: remove unique index on tab_id, add payment_status, split_group, voided_at
        await queryRunner.query(`DROP INDEX IF EXISTS "bills_tab_id_unique"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bills_tab_id"`);
        await queryRunner.query(`CREATE INDEX "IDX_bills_tab_id" ON "bills" ("tab_id")`);
        await queryRunner.query(`ALTER TABLE "bills" ADD COLUMN "payment_status" varchar(20) NOT NULL DEFAULT 'pending'`);
        await queryRunner.query(`ALTER TABLE "bills" ADD COLUMN "split_group" varchar(50)`);
        await queryRunner.query(`ALTER TABLE "bills" ADD COLUMN "voided_at" timestamptz`);

        // Orders: add modifiers jsonb column
        await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN "modifiers" jsonb`);

        // Printers table
        await queryRunner.query(`
            CREATE TABLE "printers" (
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
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_printers_branch_id" ON "printers" ("branch_id")`);

        // Print jobs table
        await queryRunner.query(`
            CREATE TABLE "print_jobs" (
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
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_print_jobs_branch_id" ON "print_jobs" ("branch_id")`);

        // Sync queue table
        await queryRunner.query(`
            CREATE TABLE "sync_queue" (
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
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_sync_queue_branch_id" ON "sync_queue" ("branch_id")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_sync_queue_client_key" ON "sync_queue" ("client_idempotency_key") WHERE "client_idempotency_key" IS NOT NULL`);

        // Modifier groups table
        await queryRunner.query(`
            CREATE TABLE "modifier_groups" (
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
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_modifier_groups_branch_id" ON "modifier_groups" ("branch_id")`);

        // Modifier options table
        await queryRunner.query(`
            CREATE TABLE "modifier_options" (
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
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_modifier_options_group_id" ON "modifier_options" ("modifier_group_id")`);

        // Menu item <-> modifier group junction table
        await queryRunner.query(`
            CREATE TABLE "menu_item_modifier_groups" (
                "menu_item_id" uuid NOT NULL REFERENCES "menu_items"("id") ON DELETE CASCADE,
                "modifier_group_id" uuid NOT NULL REFERENCES "modifier_groups"("id") ON DELETE CASCADE,
                CONSTRAINT "PK_menu_item_modifier_groups" PRIMARY KEY ("menu_item_id", "modifier_group_id")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "menu_item_modifier_groups"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "modifier_options"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "modifier_groups"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "sync_queue"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "print_jobs"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "printers"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "modifiers"`);
        await queryRunner.query(`ALTER TABLE "bills" DROP COLUMN "voided_at"`);
        await queryRunner.query(`ALTER TABLE "bills" DROP COLUMN "split_group"`);
        await queryRunner.query(`ALTER TABLE "bills" DROP COLUMN "payment_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bills_tab_id"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_bills_tab_id" ON "bills" ("tab_id")`);
    }
}