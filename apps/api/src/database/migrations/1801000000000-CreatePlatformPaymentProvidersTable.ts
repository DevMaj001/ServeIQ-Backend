import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePlatformPaymentProvidersTable1801000000000 implements MigrationInterface {
  name = 'CreatePlatformPaymentProvidersTable1801000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "platform_payment_providers" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying NOT NULL,
                "label" character varying NOT NULL,
                "type" character varying(20) NOT NULL DEFAULT 'manual',
                "verification_method" character varying(20),
                "config" jsonb NOT NULL DEFAULT '{}',
                "is_active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_platform_payment_providers_id" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_platform_payment_providers_name" ON "platform_payment_providers" ("name")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_platform_payment_providers_name"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "platform_payment_providers"`,
    );
  }
}
