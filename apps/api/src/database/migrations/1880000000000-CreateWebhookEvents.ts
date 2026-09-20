import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWebhookEvents1880000000000 implements MigrationInterface {
  name = 'CreateWebhookEvents1880000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "webhook_events" (
            "id" uuid NOT NULL DEFAULT gen_random_uuid(),
            "provider" character varying(64) NOT NULL,
            "branch_id" uuid,
            "reference" character varying(255),
            "amount_kobo" integer,
            "bill_id" uuid,
            "payload_hash" character(64) NOT NULL,
            "signature_status" character varying(20) NOT NULL,
            "outcome" character varying(20) NOT NULL,
            "http_status" smallint NOT NULL DEFAULT 200,
            "error_message" text,
            "payload" jsonb,
            "created_at" timestamptz NOT NULL DEFAULT NOW(),
            CONSTRAINT "PK_webhook_events_id" PRIMARY KEY ("id")
        )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_webhook_events_provider_created_at" ON "webhook_events" ("provider", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_webhook_events_branch_id_created_at" ON "webhook_events" ("branch_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_webhook_events_payload_hash" ON "webhook_events" ("payload_hash")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_webhook_events_payload_hash"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_webhook_events_branch_id_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_webhook_events_provider_created_at"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_events"`);
  }
}
