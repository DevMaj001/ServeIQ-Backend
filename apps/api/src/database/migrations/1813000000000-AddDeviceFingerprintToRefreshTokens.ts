import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeviceFingerprintToRefreshTokens1813000000000
  implements MigrationInterface
{
  name = 'AddDeviceFingerprintToRefreshTokens1813000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens"
        ADD COLUMN IF NOT EXISTS "device_fingerprint" character varying(128)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_device_fingerprint"
      ON "refresh_tokens" ("device_fingerprint")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_refresh_tokens_device_fingerprint"
    `);
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens" DROP COLUMN IF EXISTS "device_fingerprint"
    `);
  }
}
