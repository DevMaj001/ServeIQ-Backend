import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFeedbackTable1802000000000 implements MigrationInterface {
  name = 'CreateFeedbackTable1802000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "feedback" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "business_id" uuid NOT NULL,
                "branch_id" uuid,
                "user_id" uuid,
                "category" varchar(20) NOT NULL,
                "message" text NOT NULL,
                "screenshot" text,
                "url" text,
                "user_agent" text,
                "status" varchar(20) NOT NULL DEFAULT 'open',
                "admin_notes" text,
                "created_at" timestamptz NOT NULL DEFAULT NOW(),
                "updated_at" timestamptz NOT NULL DEFAULT NOW(),
                CONSTRAINT "PK_feedback" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_feedback_business_id" ON "feedback" ("business_id")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_feedback_branch_id" ON "feedback" ("branch_id")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_feedback_business_status" ON "feedback" ("business_id", "status")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_feedback_business_status"`);
    await queryRunner.query(`DROP INDEX "IDX_feedback_branch_id"`);
    await queryRunner.query(`DROP INDEX "IDX_feedback_business_id"`);
    await queryRunner.query(`DROP TABLE "feedback"`);
  }
}
