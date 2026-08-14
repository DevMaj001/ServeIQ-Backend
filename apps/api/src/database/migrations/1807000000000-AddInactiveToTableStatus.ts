import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInactiveToTableStatus1807000000000
  implements MigrationInterface
{
  name = 'AddInactiveToTableStatus1807000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "tables_status_enum" ADD VALUE IF NOT EXISTS 'inactive'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres does not support dropping a single enum value; kept as no-op.
  }
}
