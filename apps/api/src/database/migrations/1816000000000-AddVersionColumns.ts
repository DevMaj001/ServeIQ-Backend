import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVersionColumns1816000000000 implements MigrationInterface {
  name = 'AddVersionColumns1816000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['orders', 'bills', 'tabs']) {
      await queryRunner.query(`
        ALTER TABLE "${table}"
          ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['orders', 'bills', 'tabs']) {
      await queryRunner.query(`
        ALTER TABLE "${table}" DROP COLUMN IF EXISTS "version"
      `);
    }
  }
}