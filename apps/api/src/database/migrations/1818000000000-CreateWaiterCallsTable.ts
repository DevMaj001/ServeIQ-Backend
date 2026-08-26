import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWaiterCallsTable1818000000000 implements MigrationInterface {
  name = 'CreateWaiterCallsTable1818000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "waiter_calls" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "branch_id" uuid NOT NULL,
        "table_id" uuid NOT NULL,
        "assigned_waiter_id" uuid,
        "customer_session_id" varchar,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "reason" text,
        "accepted_at" timestamptz,
        "arrived_at" timestamptz,
        "resolved_at" timestamptz,
        "cancelled_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_waiter_calls" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "waiter_calls"
      ADD CONSTRAINT "FK_waiter_calls_branch"
      FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "waiter_calls"
      ADD CONSTRAINT "FK_waiter_calls_table"
      FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "waiter_calls"
      ADD CONSTRAINT "FK_waiter_calls_assigned_waiter"
      FOREIGN KEY ("assigned_waiter_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_waiter_calls_branch_status" ON "waiter_calls" ("branch_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_waiter_calls_branch_waiter_status" ON "waiter_calls" ("branch_id", "assigned_waiter_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_waiter_calls_table_status" ON "waiter_calls" ("table_id", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_waiter_calls_table_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_waiter_calls_branch_waiter_status"`);
    await queryRunner.query(`DROP INDEX "IDX_waiter_calls_branch_status"`);
    await queryRunner.query(`ALTER TABLE "waiter_calls" DROP CONSTRAINT IF EXISTS "FK_waiter_calls_assigned_waiter"`);
    await queryRunner.query(`ALTER TABLE "waiter_calls" DROP CONSTRAINT IF EXISTS "FK_waiter_calls_table"`);
    await queryRunner.query(`ALTER TABLE "waiter_calls" DROP CONSTRAINT IF EXISTS "FK_waiter_calls_branch"`);
    await queryRunner.query(`DROP TABLE "waiter_calls"`);
  }
}