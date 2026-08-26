import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMaxTablesPerWaiterToBranches1819000000000 implements MigrationInterface {
  name = 'AddMaxTablesPerWaiterToBranches1819000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Set default to 5 for all existing branches that don't have it
    await queryRunner.query(`
      UPDATE "branches"
      SET "settings" = COALESCE("settings"::jsonb, '{}'::jsonb) || '{"max_tables_per_waiter": 5}'
      WHERE ("settings"->>'max_tables_per_waiter') IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "branches"
      SET "settings" = COALESCE("settings"::jsonb, '{}'::jsonb) - 'max_tables_per_waiter'
    `);
  }
}