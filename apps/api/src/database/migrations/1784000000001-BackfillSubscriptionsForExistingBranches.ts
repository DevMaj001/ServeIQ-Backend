import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillSubscriptionsForExistingBranches1784000000001 implements MigrationInterface {
  name = 'BackfillSubscriptionsForExistingBranches1784000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            INSERT INTO "subscriptions" ("branch_id", "status", "trial_ends_at")
            SELECT b.id, 'trialing', NOW() + INTERVAL '14 days'
            FROM "branches" b
            WHERE NOT EXISTS (SELECT 1 FROM "subscriptions" s WHERE s.branch_id = b.id)
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DELETE FROM "subscriptions"
            WHERE plan_id IS NULL
              AND paystack_subscription_code IS NULL
              AND paystack_customer_code IS NULL
        `);
  }
}
