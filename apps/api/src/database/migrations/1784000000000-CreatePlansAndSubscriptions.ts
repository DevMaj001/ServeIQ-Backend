import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePlansAndSubscriptions1784000000000 implements MigrationInterface {
  name = 'CreatePlansAndSubscriptions1784000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_interval_enum') THEN CREATE TYPE "public"."billing_interval_enum" AS ENUM('monthly', 'yearly'); END IF; END $$`,
    );
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscriptions_status_enum') THEN CREATE TYPE "public"."subscriptions_status_enum" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'expired'); END IF; END $$`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "plans" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(50) NOT NULL, "price" integer NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'NGN', "billing_interval" "public"."billing_interval_enum" NOT NULL, "features" jsonb, "is_active" boolean NOT NULL DEFAULT true, "paystack_plan_code" character varying(100), "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_plans" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "subscriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "branch_id" uuid NOT NULL, "plan_id" uuid, "status" "public"."subscriptions_status_enum" NOT NULL DEFAULT 'trialing', "trial_ends_at" TIMESTAMP, "current_period_start" TIMESTAMP, "current_period_end" TIMESTAMP, "grace_period_ends_at" TIMESTAMP, "canceled_at" TIMESTAMP, "paystack_subscription_code" character varying(100), "paystack_customer_code" character varying(100), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_subscriptions" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_subscriptions_branch_id" ON "subscriptions" ("branch_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_subscriptions_plan_id" ON "subscriptions" ("plan_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_subscriptions_paystack_customer_code" ON "subscriptions" ("paystack_customer_code")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_subscriptions_paystack_subscription_code" ON "subscriptions" ("paystack_subscription_code")`,
    );

    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_subscriptions_branch_id" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_subscriptions_plan_id" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`INSERT INTO "plans" ("name", "price", "currency", "billing_interval", "features", "is_active", "paystack_plan_code") VALUES
          ('Basic', 0, 'NGN', 'monthly', '{"max_tables": 5, "max_waiters": 3, "reporting_enabled": false}', true, NULL),
          ('Pro', 3500000, 'NGN', 'monthly', '{"max_tables": 20, "max_waiters": 15, "reporting_enabled": true}', true, 'PLN_qtves056ssz1vii'),
          ('Enterprise', 10000000, 'NGN', 'monthly', '{"max_tables": 100, "max_waiters": 50, "reporting_enabled": true}', true, 'PLN_urcrd2ef9ud68pg'),
          ('Pro', 2200, 'USD', 'monthly', '{"max_tables": 20, "max_waiters": 15, "reporting_enabled": true}', true, NULL),
          ('Enterprise', 6250, 'USD', 'monthly', '{"max_tables": 100, "max_waiters": 50, "reporting_enabled": true}', true, NULL),
          ('Pro', 1700, 'GBP', 'monthly', '{"max_tables": 20, "max_waiters": 15, "reporting_enabled": true}', true, NULL),
          ('Enterprise', 4900, 'GBP', 'monthly', '{"max_tables": 100, "max_waiters": 50, "reporting_enabled": true}', true, NULL),
          ('Pro', 2000, 'EUR', 'monthly', '{"max_tables": 20, "max_waiters": 15, "reporting_enabled": true}', true, NULL),
          ('Enterprise', 5700, 'EUR', 'monthly', '{"max_tables": 100, "max_waiters": 50, "reporting_enabled": true}', true, NULL)
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "FK_subscriptions_plan_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "FK_subscriptions_branch_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_subscriptions_paystack_subscription_code"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_subscriptions_paystack_customer_code"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_subscriptions_plan_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_subscriptions_branch_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "subscriptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "plans"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."subscriptions_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."billing_interval_enum"`,
    );
  }
}
