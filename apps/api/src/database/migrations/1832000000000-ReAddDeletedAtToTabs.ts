import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReAddDeletedAtToTabs1832000000000 implements MigrationInterface {
  name = 'ReAddDeletedAtToTabs1832000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const columnExists = await queryRunner.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tabs' AND column_name = 'deleted_at')`,
    );
    if (!columnExists[0].exists) {
      await queryRunner.query(
        `ALTER TABLE "tabs" ADD COLUMN "deleted_at" TIMESTAMP`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tabs" DROP COLUMN IF EXISTS "deleted_at"`,
    );
  }
}
