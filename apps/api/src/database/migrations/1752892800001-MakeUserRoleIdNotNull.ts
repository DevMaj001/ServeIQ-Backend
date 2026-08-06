import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeUserRoleIdNotNull1752892800001 implements MigrationInterface {
  name = 'MakeUserRoleIdNotNull1752892800001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Enforcing NOT NULL constraint on users.role_id...');

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
