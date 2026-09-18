import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMoniepointErpPushes1870000000007 implements MigrationInterface {
  name = 'CreateMoniepointErpPushes1870000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "moniepoint_erp_pushes" (
            "id" uuid NOT NULL DEFAULT gen_random_uuid(),
            "business_id" uuid NOT NULL,
            "branch_id" uuid NOT NULL,
            "bill_id" uuid,
            "merchant_reference" character varying(100) NOT NULL,
            "terminal_serial" character varying(100) NOT NULL,
            "amount_kobo" integer NOT NULL,
            "status" character varying(20) NOT NULL DEFAULT 'pending',
            "error" text,
            "pushed_at" timestamptz NOT NULL DEFAULT NOW(),
            "paid_at" timestamptz,
            "created_at" timestamptz NOT NULL DEFAULT NOW(),
            "updated_at" timestamptz NOT NULL DEFAULT NOW(),
            "deleted_at" timestamptz,
            CONSTRAINT "PK_moniepoint_erp_pushes_id" PRIMARY KEY ("id")
        )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_moniepoint_erp_pushes_business_id" ON "moniepoint_erp_pushes" ("business_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_moniepoint_erp_pushes_branch_id" ON "moniepoint_erp_pushes" ("branch_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_moniepoint_erp_pushes_branch_ref" ON "moniepoint_erp_pushes" ("branch_id", "merchant_reference")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_moniepoint_erp_pushes_business_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_moniepoint_erp_pushes_branch_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_moniepoint_erp_pushes_branch_ref"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "moniepoint_erp_pushes"`);
  }
}
