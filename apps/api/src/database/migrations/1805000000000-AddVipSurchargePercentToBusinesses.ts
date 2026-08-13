import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVipSurchargePercentToBusinesses1805000000000
  implements MigrationInterface
{
  name = 'AddVipSurchargePercentToBusinesses1805000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "vip_surcharge_percent" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN IF EXISTS "vip_surcharge_percent"`,
    );
  }
}