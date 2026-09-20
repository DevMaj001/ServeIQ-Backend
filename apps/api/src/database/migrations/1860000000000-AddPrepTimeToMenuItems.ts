import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPrepTimeToMenuItems1860000000000 implements MigrationInterface {
  name = 'AddPrepTimeToMenuItems1860000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE "menu_items"
        ADD COLUMN "prep_time_seconds" integer
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE "menu_items" DROP COLUMN IF EXISTS "prep_time_seconds"
    `);
  }
}
