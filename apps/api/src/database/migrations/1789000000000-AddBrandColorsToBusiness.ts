import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBrandColorsToBusiness1789000000000 implements MigrationInterface {
  name = 'AddBrandColorsToBusiness1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "brand_primary_color" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "brand_accent_color" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN IF EXISTS "brand_primary_color"`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN IF EXISTS "brand_accent_color"`,
    );
  }
}
