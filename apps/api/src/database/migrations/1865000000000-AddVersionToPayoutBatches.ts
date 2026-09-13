import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVersionToPayoutBatches1865000000000 implements MigrationInterface {
  name = 'AddVersionToPayoutBatches1865000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE "payout_batches"
        ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE "payout_batches" DROP COLUMN IF EXISTS "version"
    `);
  }
}