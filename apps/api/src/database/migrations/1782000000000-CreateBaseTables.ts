import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateBaseTables1782000000000 implements MigrationInterface {
    name = 'CreateBaseTables1782000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create enum types (safe — IF NOT EXISTS)
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'businesses_type_enum') THEN CREATE TYPE "public"."businesses_type_enum" AS ENUM('bar', 'lounge', 'restaurant', 'club', 'cafe'); END IF; END $$`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tables_status_enum') THEN CREATE TYPE "public"."tables_status_enum" AS ENUM('available', 'occupied', 'reserved'); END IF; END $$`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tabs_status_enum') THEN CREATE TYPE "public"."tabs_status_enum" AS ENUM('open', 'billed', 'paid', 'voided'); END IF; END $$`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bills_payment_method_enum') THEN CREATE TYPE "public"."bills_payment_method_enum" AS ENUM('cash', 'transfer', 'pos', 'card'); END IF; END $$`);

        // businesses
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "businesses" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "name" character varying NOT NULL,
            "slug" character varying NOT NULL,
            "type" "public"."businesses_type_enum" NOT NULL,
            "owner_id" uuid NOT NULL,
            "email" character varying NOT NULL,
            "phone" character varying,
            "address" text,
            "currency" character varying NOT NULL DEFAULT 'NGN',
            "tax_rate" numeric(5,2) NOT NULL DEFAULT '7.5',
            "timezone" character varying NOT NULL DEFAULT 'Africa/Lagos',
            "subscription_plan" character varying NOT NULL DEFAULT 'free_trial',
            "logo_url" character varying,
            "cac_document_url" character varying,
            "brand_primary_color" character varying,
            "brand_accent_color" character varying,
            "is_active" boolean NOT NULL DEFAULT true,
            "created_at" TIMESTAMP NOT NULL DEFAULT now(),
            "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
            "deleted_at" TIMESTAMP,
            CONSTRAINT "PK_businesses" PRIMARY KEY ("id"),
            CONSTRAINT "UQ_businesses_slug" UNIQUE ("slug")
        )`);

        // branches
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "branches" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "business_id" uuid NOT NULL,
            "name" character varying NOT NULL,
            "address" text,
            "phone" character varying,
            "settings" jsonb,
            "is_active" boolean NOT NULL DEFAULT true,
            "created_at" TIMESTAMP NOT NULL DEFAULT now(),
            "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
            "deleted_at" TIMESTAMP,
            CONSTRAINT "PK_branches" PRIMARY KEY ("id")
        )`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_branches_business_id" ON "branches" ("business_id")`);

        // users
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "users" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "business_id" uuid NOT NULL,
            "branch_id" uuid NOT NULL,
            "full_name" character varying NOT NULL,
            "email" character varying NOT NULL,
            "phone" character varying,
            "avatar_url" character varying,
            "password_hash" character varying NOT NULL,
            "pin_hash" character varying,
            "role" character varying(20) NOT NULL DEFAULT 'waiter',
            "role_id" uuid,
            "is_active" boolean NOT NULL DEFAULT true,
            "email_verified_at" TIMESTAMP,
            "last_login_at" TIMESTAMP,
            "invited_by" character varying,
            "created_at" TIMESTAMP NOT NULL DEFAULT now(),
            "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
            "deleted_at" TIMESTAMP,
            CONSTRAINT "PK_users" PRIMARY KEY ("id"),
            CONSTRAINT "UQ_users_email" UNIQUE ("email")
        )`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_business_id" ON "users" ("business_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_branch_id" ON "users" ("branch_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_role_id" ON "users" ("role_id")`);

        // tables
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "tables" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "branch_id" uuid NOT NULL,
            "table_number" character varying NOT NULL,
            "label" character varying,
            "capacity" integer NOT NULL DEFAULT 1,
            "status" "public"."tables_status_enum" NOT NULL DEFAULT 'available',
            "created_at" TIMESTAMP NOT NULL DEFAULT now(),
            "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
            "deleted_at" TIMESTAMP,
            CONSTRAINT "PK_tables" PRIMARY KEY ("id"),
            CONSTRAINT "UQ_tables_branch_table" UNIQUE ("branch_id", "table_number")
        )`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_tables_branch_id" ON "tables" ("branch_id")`);

        // tabs
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "tabs" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "branch_id" uuid NOT NULL,
            "table_id" uuid NOT NULL,
            "waiter_id" uuid NOT NULL,
            "shift_id" uuid,
            "cashier_id" character varying,
            "tab_number" character varying NOT NULL,
            "customer_name" character varying,
            "party_size" integer NOT NULL DEFAULT 1,
            "status" "public"."tabs_status_enum" NOT NULL DEFAULT 'open',
            "notes" text,
            "opened_at" TIMESTAMP NOT NULL DEFAULT now(),
            "billed_at" TIMESTAMP,
            "closed_at" TIMESTAMP,
            "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_tabs" PRIMARY KEY ("id"),
            CONSTRAINT "UQ_tabs_tab_number" UNIQUE ("tab_number")
        )`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_tabs_branch_id" ON "tabs" ("branch_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_tabs_table_id" ON "tabs" ("table_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_tabs_waiter_id" ON "tabs" ("waiter_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_tabs_shift_id" ON "tabs" ("shift_id")`);

        // orders
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "orders" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "tab_id" uuid NOT NULL,
            "menu_item_id" uuid NOT NULL,
            "quantity" integer NOT NULL,
            "unit_price_kobo" integer NOT NULL,
            "subtotal_kobo" integer NOT NULL,
            "round_number" integer NOT NULL DEFAULT 1,
            "voice_transcription" text,
            "notes" text,
            "modifiers" jsonb,
            "created_by" character varying NOT NULL,
            "order_status" character varying(40) NOT NULL DEFAULT 'pending_supervisor_approval',
            "approved_by" uuid,
            "approved_at" TIMESTAMP,
            "declined_by" uuid,
            "declined_at" TIMESTAMP,
            "decline_reason" text,
            "assigned_department" uuid,
            "estimated_preparation_time_seconds" integer,
            "timer_started_at" TIMESTAMP,
            "timer_ends_at" TIMESTAMP,
            "actual_ready_time" TIMESTAMP,
            "delivered_by_supervisor" uuid,
            "delivered_at" TIMESTAMP,
            "tracking_code" character varying(12),
            "tracking_generated_at" TIMESTAMP,
            "preparing_at" TIMESTAMP,
            "created_at" TIMESTAMP NOT NULL DEFAULT now(),
            "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_orders" PRIMARY KEY ("id")
        )`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_tab_id" ON "orders" ("tab_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_menu_item_id" ON "orders" ("menu_item_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_assigned_department" ON "orders" ("assigned_department")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_order_status" ON "orders" ("order_status")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_timer_ends_at" ON "orders" ("timer_ends_at")`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_orders_tracking_code" ON "orders" ("tracking_code")`);

        // bills
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "bills" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "tab_id" uuid NOT NULL,
            "payment_status" character varying(20) NOT NULL DEFAULT 'pending',
            "split_group" character varying(50),
            "subtotal_kobo" integer NOT NULL,
            "service_charge_kobo" integer NOT NULL DEFAULT 0,
            "discount_kobo" integer NOT NULL DEFAULT 0,
            "tax_kobo" integer NOT NULL DEFAULT 0,
            "total_kobo" integer NOT NULL,
            "idempotency_key" character varying,
            "payment_amount_kobo" integer,
            "payment_method" "public"."bills_payment_method_enum",
            "payment_reference" character varying,
            "terminal_id" uuid,
            "paid_at" TIMESTAMP,
            "voided_at" TIMESTAMP,
            "issued_by" character varying NOT NULL,
            "receipt_url" character varying,
            "created_at" TIMESTAMP NOT NULL DEFAULT now(),
            "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_bills" PRIMARY KEY ("id")
        )`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_bills_tab_id" ON "bills" ("tab_id")`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_bills_idempotency_key" ON "bills" ("idempotency_key")`);

        // menu_items
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "menu_items" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "branch_id" uuid NOT NULL,
            "name" character varying NOT NULL,
            "category" character varying NOT NULL,
            "price_kobo" integer NOT NULL,
            "unit" character varying NOT NULL DEFAULT 'unit',
            "sku" character varying,
            "barcode" character varying,
            "image_url" character varying,
            "is_available" boolean NOT NULL DEFAULT true,
            "quantity_in_stock" numeric(12,3) NOT NULL DEFAULT 0,
            "reorder_level" numeric(12,3) NOT NULL DEFAULT 0,
            "cost_price_kobo" integer,
            "track_stock" boolean NOT NULL DEFAULT true,
            "supplier_id" uuid,
            "created_by" character varying NOT NULL,
            "created_at" TIMESTAMP NOT NULL DEFAULT now(),
            "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
            "deleted_at" TIMESTAMP,
            CONSTRAINT "PK_menu_items" PRIMARY KEY ("id")
        )`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_menu_items_branch_id" ON "menu_items" ("branch_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_menu_items_supplier_id" ON "menu_items" ("supplier_id")`);

        // FK constraints (safe — IF NOT EXISTS style via DO block)
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_branches_business_id') THEN ALTER TABLE "branches" ADD CONSTRAINT "FK_branches_business_id" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE; END IF; END $$`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_users_business_id') THEN ALTER TABLE "users" ADD CONSTRAINT "FK_users_business_id" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE; END IF; END $$`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "menu_items" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "bills" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "orders" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "tabs" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "tables" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "branches" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "businesses" CASCADE`);

        await queryRunner.query(`DROP TYPE IF EXISTS "public"."bills_payment_method_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."tabs_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."tables_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."businesses_type_enum"`);
    }
}
