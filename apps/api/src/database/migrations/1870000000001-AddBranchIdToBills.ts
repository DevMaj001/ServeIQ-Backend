import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBranchIdToBills1870000000001 implements MigrationInterface {
  name = 'AddBranchIdToBills1870000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE "bills"
        ADD COLUMN IF NOT EXISTS "branch_id" uuid
    `);
    await queryRunner.query(`
        ALTER TABLE "bills"
        ADD COLUMN IF NOT EXISTS "tracking_code" varchar(12)
    `);

    // Backfill from the joined Tab.
    await queryRunner.query(`
        UPDATE "bills" b
        SET branch_id = t.branch_id,
            tracking_code = t.tracking_code
        FROM "tabs" t
        WHERE b.tab_id = t.id
    `);

    await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_bills_branch_id" ON "bills" ("branch_id")
    `);
    await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_bills_tracking_code" ON "bills" ("tracking_code")
    `);

    // Bills may settle standalone (tabless) online orders.
    await queryRunner.query(`
        ALTER TABLE "bills" ALTER COLUMN "tab_id" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE "bills" ALTER COLUMN "tab_id" SET NOT NULL
    `);
    await queryRunner.query(`
        DROP INDEX IF EXISTS "IDX_bills_tracking_code"
    `);
    await queryRunner.query(`
        DROP INDEX IF EXISTS "IDX_bills_branch_id"
    `);
    await queryRunner.query(`
        ALTER TABLE "bills" DROP COLUMN IF EXISTS "branch_id"
    `);
    await queryRunner.query(`
        ALTER TABLE "bills" DROP COLUMN IF EXISTS "tracking_code"
    `);
  }
}