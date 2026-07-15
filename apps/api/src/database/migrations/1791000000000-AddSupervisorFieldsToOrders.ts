import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSupervisorFieldsToOrders1791000000000 implements MigrationInterface {
    name = 'AddSupervisorFieldsToOrders1791000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // approved_by / approved_at
        await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "approved_by" uuid`);
        await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP`);
        // declined_by / declined_at / decline_reason
        await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "declined_by" uuid`);
        await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "declined_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "decline_reason" text`);
        // department assignment + timer
        await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "assigned_department" uuid`);
        await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "estimated_preparation_time_seconds" integer`);
        await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "timer_started_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "timer_ends_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "actual_ready_time" TIMESTAMP`);
        // delivered_by_supervisor / delivered_at
        await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivered_by_supervisor" uuid`);
        await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMP`);

        // index for supervisor queue queries
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_assigned_department" ON "orders" ("assigned_department")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_order_status" ON "orders" ("order_status")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_timer_ends_at" ON "orders" ("timer_ends_at")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_orders_timer_ends_at"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_orders_order_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_orders_assigned_department"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "delivered_at"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "delivered_by_supervisor"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "actual_ready_time"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "timer_ends_at"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "timer_started_at"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "estimated_preparation_time_seconds"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "assigned_department"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "decline_reason"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "declined_at"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "declined_by"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "approved_at"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "approved_by"`);
    }
}
