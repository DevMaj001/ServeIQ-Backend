import { MigrationInterface, QueryRunner } from 'typeorm';

// Adds brute-force lockout columns to `users` for the 5-attempt → 15-minute
// account lockout enforced in AuthService.login. Idempotent so it is safe on
// both fresh and live databases.
export class AddLoginLockout1800000000006 implements MigrationInterface {
  name = 'AddLoginLockout1800000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "failed_login_attempts" int NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "locked_until" timestamptz`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "locked_until"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "failed_login_attempts"`,
    );
  }
}
