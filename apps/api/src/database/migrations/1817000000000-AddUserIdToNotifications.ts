import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserIdToNotifications1817000000000 implements MigrationInterface {
  name = 'AddUserIdToNotifications1817000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notifications"
      ADD COLUMN IF NOT EXISTS "user_id" uuid NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notifications_user_id"
      ON "notifications" ("user_id")
    `);
    // Backfill: target legacy waiter-relevant notifications at the serving
    // waiter of their tab. Rows without a resolvable tab stay broadcasts.
    await queryRunner.query(`
      UPDATE "notifications" n
      SET "user_id" = t."waiter_id"
      FROM "tabs" t
      WHERE n."user_id" IS NULL
        AND n."type" IN ('order_ready', 'order_approved')
        AND t."waiter_id" IS NOT NULL
        AND n."data"->>'tab_id' = t."id"::text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_notifications_user_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "notifications"
      DROP COLUMN IF EXISTS "user_id"
    `);
  }
}
