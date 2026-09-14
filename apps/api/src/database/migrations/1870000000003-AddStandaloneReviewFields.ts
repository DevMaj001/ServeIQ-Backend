import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStandaloneReviewFields1870000000003
  implements MigrationInterface
{
  name = 'AddStandaloneReviewFields1870000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Reviews for standalone (tabless) online order groups reference the group
    // by tracking code instead of a Tab.
    await queryRunner.query(`
        ALTER TABLE "reviews" ALTER COLUMN "tab_id" DROP NOT NULL
    `);
    await queryRunner.query(`
        ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "tracking_code" varchar(12)
    `);
    await queryRunner.query(`
        UPDATE "reviews" r
        SET tracking_code = t.tracking_code
        FROM "tabs" t
        WHERE r.tab_id = t.id
    `);
    await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_reviews_tracking_code"
        ON "reviews" ("tracking_code")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        DROP INDEX IF EXISTS "IDX_reviews_tracking_code"
    `);
    await queryRunner.query(`
        ALTER TABLE "reviews" DROP COLUMN IF EXISTS "tracking_code"
    `);
    await queryRunner.query(`
        ALTER TABLE "reviews" ALTER COLUMN "tab_id" SET NOT NULL
    `);
  }
}