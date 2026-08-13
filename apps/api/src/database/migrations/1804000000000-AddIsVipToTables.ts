import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsVipToTables1804000000000 implements MigrationInterface {
  name = 'AddIsVipToTables1804000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tables" ADD COLUMN IF NOT EXISTS "is_vip" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tables" DROP COLUMN IF EXISTS "is_vip"`,
    );
  }
}