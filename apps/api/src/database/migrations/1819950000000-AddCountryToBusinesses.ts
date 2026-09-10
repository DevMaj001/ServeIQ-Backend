import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCountryToBusinesses1819950000000 implements MigrationInterface {
  name = 'AddCountryToBusinesses1819950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "country" character varying(2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN IF EXISTS "country"`,
    );
  }
}
