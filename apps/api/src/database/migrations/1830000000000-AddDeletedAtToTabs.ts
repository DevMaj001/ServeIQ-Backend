import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeletedAtToTabs1830000000000 implements MigrationInterface {
  name = 'AddDeletedAtToTabs1830000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tabs" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tabs" DROP COLUMN IF EXISTS "deleted_at"`,
    );
  }
}