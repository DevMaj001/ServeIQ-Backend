import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPrepTypeToMenuItems1810000000000 implements MigrationInterface {
  name = 'AddPrepTypeToMenuItems1810000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE "menu_items"
        ADD COLUMN "prep_type" varchar(20) NOT NULL DEFAULT 'cook'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE "menu_items" DROP COLUMN IF EXISTS "prep_type"
    `);
  }
}