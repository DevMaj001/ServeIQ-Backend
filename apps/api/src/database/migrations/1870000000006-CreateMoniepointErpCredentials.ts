import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMoniepointErpCredentials1870000000006 implements MigrationInterface {
  name = 'CreateMoniepointErpCredentials1870000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "moniepoint_erp_credentials" (
            "id" uuid NOT NULL DEFAULT gen_random_uuid(),
            "branch_id" uuid NOT NULL,
            "business_id" uuid NOT NULL,
            "client_id" character varying NOT NULL,
            "client_secret_enc" text NOT NULL,
            "environment" character varying(10) NOT NULL DEFAULT 'SANDBOX',
            "is_active" boolean NOT NULL DEFAULT true,
            "created_at" timestamptz NOT NULL DEFAULT NOW(),
            "updated_at" timestamptz NOT NULL DEFAULT NOW(),
            "deleted_at" timestamptz,
            CONSTRAINT "PK_moniepoint_erp_credentials_id" PRIMARY KEY ("id")
        )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_moniepoint_erp_credentials_branch_id" ON "moniepoint_erp_credentials" ("branch_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_moniepoint_erp_credentials_business_id" ON "moniepoint_erp_credentials" ("business_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_moniepoint_erp_credentials_branch_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_moniepoint_erp_credentials_business_id"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "moniepoint_erp_credentials"`,
    );
  }
}
