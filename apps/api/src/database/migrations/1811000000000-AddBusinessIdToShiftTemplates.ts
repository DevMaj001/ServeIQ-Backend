import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBusinessIdToShiftTemplates1811000000000
  implements MigrationInterface
{
  name = 'AddBusinessIdToShiftTemplates1811000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "shift_templates" ADD COLUMN IF NOT EXISTS "business_id" uuid`,
    );
    await queryRunner.query(
      `UPDATE "shift_templates" st SET "business_id" = b."business_id" FROM "branches" b WHERE b."id" = st."branch_id" AND st."business_id" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "shift_templates" ALTER COLUMN "business_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_shift_templates_business_id" ON "shift_templates" ("business_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_shift_templates_business_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shift_templates" DROP COLUMN "business_id"`,
    );
  }
}