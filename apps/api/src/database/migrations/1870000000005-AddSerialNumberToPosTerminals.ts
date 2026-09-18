import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSerialNumberToPosTerminals1870000000005 implements MigrationInterface {
  name = 'AddSerialNumberToPosTerminals1870000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE "pos_terminals"
        ADD COLUMN IF NOT EXISTS "serial_number" varchar(100)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE "pos_terminals" DROP COLUMN IF EXISTS "serial_number"
    `);
  }
}
