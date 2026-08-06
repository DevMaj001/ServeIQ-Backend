import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeWaiterIdNullable1800000000004 implements MigrationInterface {
  name = 'MakeWaiterIdNullable1800000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tabs" ALTER COLUMN "waiter_id" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tabs" ALTER COLUMN "waiter_id" SET NOT NULL`,
    );
  }
}
