import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveVirtualTables1870000000004
  implements MigrationInterface
{
  name = 'RemoveVirtualTables1870000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove the per-branch virtual "Takeaway Counter" table entirely. On fresh
    // databases the column never existed, so guard with an info_schema check.
    await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'tables' AND column_name = 'is_virtual'
          ) THEN
            DELETE FROM "tables" WHERE "is_virtual" = true;
            ALTER TABLE "tables" DROP COLUMN "is_virtual";
          END IF;
        END $$
    `);
    // Takeaway tabs no longer point at a virtual table.
    await queryRunner.query(`
        ALTER TABLE "tabs" ALTER COLUMN "table_id" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE "tabs" ALTER COLUMN "table_id" SET NOT NULL
    `);
    await queryRunner.query(`
        ALTER TABLE "tables" ADD COLUMN IF NOT EXISTS "is_virtual" boolean NOT NULL DEFAULT false
    `);
  }
}