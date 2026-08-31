import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  constructor(private dataSource: DataSource) {}

  async onApplicationBootstrap() {
    try {
      await this.dataSource.query(
        `ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "tax_rate" numeric(5,2) NOT NULL DEFAULT '7.5'`,
      );
      await this.dataSource.query(
        `ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "timezone" character varying NOT NULL DEFAULT 'Africa/Lagos'`,
      );
      await this.dataSource.query(
        `ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "terminal_id" uuid`,
      );
      await this.dataSource.query(
        `ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "payment_amount_kobo" integer`,
      );
      await this.dataSource.query(
        `CREATE TABLE IF NOT EXISTS "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "branch_id" uuid NOT NULL, "user_id" uuid, "action" character varying NOT NULL, "entity_id" uuid, "entity_type" character varying, "payload" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
      );
      await this.dataSource.query(
        `CREATE TABLE IF NOT EXISTS "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "token_hash" character varying NOT NULL, "expires_at" TIMESTAMP NOT NULL, "is_revoked" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
      );
      await this.dataSource.query(
        `CREATE TABLE IF NOT EXISTS "verification_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "token" character varying NOT NULL, "type" character varying NOT NULL, "expires_at" TIMESTAMP NOT NULL, "is_used" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f2d4d7a2aa57ef199e61567db22" PRIMARY KEY ("id"))`,
      );
      await this.dataSource.query(
        `CREATE TABLE IF NOT EXISTS "shifts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "branch_id" uuid NOT NULL, "opened_by" uuid NOT NULL, "closed_by" uuid, "starting_cash_kobo" integer NOT NULL DEFAULT '0', "expected_cash_kobo" integer, "actual_cash_kobo" integer, "variance_kobo" integer, "opened_at" TIMESTAMP, "closed_at" TIMESTAMP, "status" character varying NOT NULL DEFAULT 'open', "note" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_84d692e367e4d6cdf045828768c" PRIMARY KEY ("id"))`,
      );
      await this.dataSource.query(
        `CREATE TABLE IF NOT EXISTS "suppliers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "branch_id" uuid NOT NULL, "name" character varying NOT NULL, "contact_person" character varying, "phone" character varying, "email" character varying, "address" character varying, "note" character varying, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_b70ac51766a9e3144f778cfe81e" PRIMARY KEY ("id"))`,
      );
      await this.dataSource.query(
        `CREATE TABLE IF NOT EXISTS "pos_terminals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "branch_id" uuid NOT NULL, "label" character varying NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_pos_terminals" PRIMARY KEY ("id"))`,
      );
      await this.dataSource.query(
        `ALTER TABLE "pos_terminals" ADD COLUMN IF NOT EXISTS "account_number" character varying`,
      );
      await this.dataSource.query(
        `ALTER TABLE "tabs" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP`,
      );
      await this.dataSource.query(
        `ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "sequence" integer`,
      );
      await this.dataSource.query(
        `DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bills_allocation_type_enum') THEN
            CREATE TYPE "public"."bills_allocation_type_enum" AS ENUM ('item', 'remaining', 'percentage', 'amount');
          END IF;
        END $$`,
      );
      await this.dataSource.query(
        `ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "allocation_type" "public"."bills_allocation_type_enum"`,
      );
      await this.dataSource.query(
        `ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "allocation_config" jsonb`,
      );
      console.log(
        '[SchemaSync] Missing columns and tables created successfully',
      );
    } catch (err) {
      console.warn(
        '[SchemaSync] Non-fatal schema sync warning:',
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  getHello(): string {
    return 'Hello World!';
  }
}
