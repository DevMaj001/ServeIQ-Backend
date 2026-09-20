import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeDeliveriesTabIdNullable1870000000002 implements MigrationInterface {
  name = 'MakeDeliveriesTabIdNullable1870000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Standalone online (tabless) orders can dispatch deliveries without a Tab.
    await queryRunner.query(`
        ALTER TABLE "deliveries" ALTER COLUMN "tab_id" DROP NOT NULL
    `);
    // Backfill the group tracking code from the joined option tab (dispatch
    // deliveries are created after the takeaway tab holds a tracking code).
    await queryRunner.query(`
        ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "tracking_code" varchar(12)
    `);
    await queryRunner.query(`
        UPDATE "deliveries" d
        SET tracking_code = t.tracking_code
        FROM "tabs" t
        WHERE d.tab_id = t.id
    `);
    await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_deliveries_tracking_code"
        ON "deliveries" ("tracking_code")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        DROP INDEX IF EXISTS "IDX_deliveries_tracking_code"
    `);
    await queryRunner.query(`
        ALTER TABLE "deliveries" DROP COLUMN IF EXISTS "tracking_code"
    `);
    await queryRunner.query(`
        ALTER TABLE "deliveries" ALTER COLUMN "tab_id" SET NOT NULL
    `);
  }
}