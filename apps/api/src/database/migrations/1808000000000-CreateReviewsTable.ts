import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReviewsTable1808000000000 implements MigrationInterface {
  name = 'CreateReviewsTable1808000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reviews" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "business_id" uuid NOT NULL,
        "branch_id" uuid,
        "tab_id" uuid NOT NULL,
        "rating" integer NOT NULL CHECK ("rating" >= 1 AND "rating" <= 5),
        "comment" text,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_reviews_business_id" ON "reviews" ("business_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_reviews_branch_id" ON "reviews" ("branch_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "reviews"`);
  }
}