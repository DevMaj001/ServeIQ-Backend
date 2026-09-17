import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStandaloneOrderFields1870000000000 implements MigrationInterface {
  name = 'AddStandaloneOrderFields1870000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Denormalized session fields so self-service/takeaway orders can exist
    // without a Tab (the "virtual table"). Orders remain standalone; Tab stays
    // for the dine-in waiter flow.
    await queryRunner.query(`
        ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "branch_id" uuid
    `);
    await queryRunner.query(`
        ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "tracking_code" varchar(12)
    `);
    await queryRunner.query(`
        ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "tracking_generated_at" timestamp
    `);
    await queryRunner.query(`
        ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "pickup_mode" varchar(20) DEFAULT 'self'
    `);
    await queryRunner.query(`
        ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "delivery_details" jsonb
    `);
    await queryRunner.query(`
        ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "delivery_fee_kobo" integer DEFAULT 0
    `);
    await queryRunner.query(`
        ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "customer_name" varchar
    `);
    await queryRunner.query(`
        ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "party_size" integer DEFAULT 1
    `);
    await queryRunner.query(`
        ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "table_id" uuid
    `);
    await queryRunner.query(`
        ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "tab_type" varchar(20)
    `);
    await queryRunner.query(`
        ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'open'
    `);

    // Backfill from the joined Tab (existing rows keep their virtual-table data).
    await queryRunner.query(`
        UPDATE "orders" o
        SET branch_id = t.branch_id,
            tracking_code = t.tracking_code,
            tracking_generated_at = t.tracking_generated_at,
            pickup_mode = t.pickup_mode,
            delivery_details = t.delivery_details,
            delivery_fee_kobo = t.delivery_fee_kobo,
            customer_name = t.customer_name,
            party_size = t.party_size,
            table_id = t.table_id,
            tab_type = t.tab_type,
            status = t.status
        FROM "tabs" t
        WHERE o.tab_id = t.id
    `);

    await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_orders_branch_id" ON "orders" ("branch_id")
    `);
    // Not unique: every order in a group shares its tab's tracking code.
    await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_orders_tracking_code" ON "orders" ("tracking_code")
        WHERE "tracking_code" IS NOT NULL
    `);

    // Online orders no longer require a Tab row.
    await queryRunner.query(`
        ALTER TABLE "orders" ALTER COLUMN "tab_id" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE "orders" ALTER COLUMN "tab_id" SET NOT NULL
    `);
    await queryRunner.query(`
        DROP INDEX IF EXISTS "IDX_orders_tracking_code"
    `);
    await queryRunner.query(`
        DROP INDEX IF EXISTS "IDX_orders_branch_id"
    `);
    await queryRunner.query(`
        ALTER TABLE "orders" DROP COLUMN IF EXISTS "status"
    `);
    await queryRunner.query(`
        ALTER TABLE "orders" DROP COLUMN IF EXISTS "tab_type"
    `);
    await queryRunner.query(`
        ALTER TABLE "orders" DROP COLUMN IF EXISTS "table_id"
    `);
    await queryRunner.query(`
        ALTER TABLE "orders" DROP COLUMN IF EXISTS "party_size"
    `);
    await queryRunner.query(`
        ALTER TABLE "orders" DROP COLUMN IF EXISTS "customer_name"
    `);
    await queryRunner.query(`
        ALTER TABLE "orders" DROP COLUMN IF EXISTS "delivery_fee_kobo"
    `);
    await queryRunner.query(`
        ALTER TABLE "orders" DROP COLUMN IF EXISTS "delivery_details"
    `);
    await queryRunner.query(`
        ALTER TABLE "orders" DROP COLUMN IF EXISTS "pickup_mode"
    `);
    await queryRunner.query(`
        ALTER TABLE "orders" DROP COLUMN IF EXISTS "tracking_generated_at"
    `);
    await queryRunner.query(`
        ALTER TABLE "orders" DROP COLUMN IF EXISTS "tracking_code"
    `);
    await queryRunner.query(`
        ALTER TABLE "orders" DROP COLUMN IF EXISTS "branch_id"
    `);
  }
}