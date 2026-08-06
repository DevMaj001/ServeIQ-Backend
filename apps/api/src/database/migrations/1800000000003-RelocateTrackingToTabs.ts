import { MigrationInterface, QueryRunner } from 'typeorm';

export class RelocateTrackingToTabs1800000000003 implements MigrationInterface {
  name = 'RelocateTrackingToTabs1800000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tabs" ADD COLUMN IF NOT EXISTS "tracking_code" character varying(12)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tabs" ADD COLUMN IF NOT EXISTS "tracking_generated_at" TIMESTAMP`,
    );

    await queryRunner.query(`
            UPDATE "tabs" t
            SET
                "tracking_code" = sub.tracking_code,
                "tracking_generated_at" = sub.tracking_generated_at
            FROM (
                SELECT DISTINCT ON (o.tab_id)
                    o.tab_id,
                    o.tracking_code,
                    o.tracking_generated_at
                FROM orders o
                WHERE o.tracking_code IS NOT NULL
                ORDER BY o.tab_id, o.created_at ASC
            ) sub
            WHERE t.id = sub.tab_id
        `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tabs_tracking_code" ON "tabs" ("tracking_code") WHERE "tracking_code" IS NOT NULL`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_orders_tracking_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "tracking_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "tracking_generated_at"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tracking_code" character varying(12)`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tracking_generated_at" TIMESTAMP`,
    );

    await queryRunner.query(`
            UPDATE "orders" o
            SET
                "tracking_code" = sub.tracking_code,
                "tracking_generated_at" = sub.tracking_generated_at
            FROM (
                SELECT DISTINCT ON (t.id)
                    t.id AS tab_id,
                    t.tracking_code,
                    t.tracking_generated_at
                FROM tabs t
                WHERE t.tracking_code IS NOT NULL
            ) sub
            WHERE o.tab_id = sub.tab_id
        `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_orders_tracking_code" ON "orders" ("tracking_code")`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_tabs_tracking_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tabs" DROP COLUMN IF EXISTS "tracking_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tabs" DROP COLUMN IF EXISTS "tracking_generated_at"`,
    );
  }
}
