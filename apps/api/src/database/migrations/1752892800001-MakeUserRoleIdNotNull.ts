import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeUserRoleIdNotNull1752892800001 implements MigrationInterface {
  name = 'MakeUserRoleIdNotNull1752892800001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Enforcing NOT NULL constraint on users.role_id...');

    // This migration predates the base schema in a fresh-install ordering.
    // Skip cleanly when the users table does not exist yet (it is created by
    // a later migration); the backfill that precedes this also skips then.
    const tables = (await queryRunner.query(
      `SELECT to_regclass('public.users') IS NOT NULL AS has_users`,
    )) as Array<{ has_users: boolean }>;
    if (!tables[0]?.has_users) {
      console.log(
        'Skipping role_id NOT NULL constraint: users table does not exist yet (fresh install).',
      );
      return;
    }

    // Verify no NULLs remain before applying constraint
    const nullCount = (await queryRunner.query(
      `SELECT COUNT(*) as count FROM users WHERE role_id IS NULL`,
    )) as Array<{ count: string }>;

    const count = parseInt(nullCount[0]?.count || '0', 10);
    if (count > 0) {
      throw new Error(
        `Cannot enforce NOT NULL: ${count} users still have NULL role_id. Run backfill migration first.`,
      );
    }

    await queryRunner.query(
      `ALTER TABLE users ALTER COLUMN role_id SET NOT NULL`,
    );
    console.log('SUCCESS: users.role_id is now NOT NULL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Reverting NOT NULL constraint on users.role_id...');
    await queryRunner.query(
      `ALTER TABLE users ALTER COLUMN role_id DROP NOT NULL`,
    );
    console.log('Reverted: users.role_id is now nullable');
  }
}
