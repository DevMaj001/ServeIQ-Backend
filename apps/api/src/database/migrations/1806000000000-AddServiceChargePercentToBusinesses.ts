import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddServiceChargePercentToBusinesses1806000000000
  implements MigrationInterface
{
  name = 'AddServiceChargePercentToBusinesses1806000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "service_charge_percent" decimal(5,2) NOT NULL DEFAULT 10`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN IF EXISTS "service_charge_percent"`,
    );
  }
}