import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDiscountMinOrderToBusinesses1833000000000
  implements MigrationInterface
{
  name = 'AddDiscountMinOrderToBusinesses1833000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "discount_min_order_amount" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN IF EXISTS "discount_min_order_amount"`,
    );
  }
}
