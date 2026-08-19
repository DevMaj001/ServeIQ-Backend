import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateShiftTemplates1810000000000 implements MigrationInterface {
  name = 'CreateShiftTemplates1810000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "shift_templates" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "branch_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "type" character varying(20) NOT NULL DEFAULT 'custom',
        "scheduled_start_time" character varying(5) NOT NULL,
        "scheduled_end_time" character varying(5) NOT NULL,
        "days_of_week" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "color" character varying(9) NOT NULL DEFAULT '#22c55e',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_shift_templates_branch_id" ON "shift_templates" ("branch_id")`,
    );

    // Extend shifts with schedule/template/staff columns
    await queryRunner.query(
      `ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "template_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "scheduled_start_time" character varying(5)`,
    );
    await queryRunner.query(
      `ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "scheduled_end_time" character varying(5)`,
    );
    await queryRunner.query(
      `ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "shift_type" character varying(20) DEFAULT 'custom'`,
    );
    await queryRunner.query(
      `ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "assigned_staff_ids" uuid[] DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "shifts" DROP COLUMN IF EXISTS "assigned_staff_ids"`,
    );
    await queryRunner.query(`ALTER TABLE "shifts" DROP COLUMN IF EXISTS "shift_type"`);
    await queryRunner.query(
      `ALTER TABLE "shifts" DROP COLUMN IF EXISTS "scheduled_end_time"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shifts" DROP COLUMN IF EXISTS "scheduled_start_time"`,
    );
    await queryRunner.query(`ALTER TABLE "shifts" DROP COLUMN IF EXISTS "template_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_shift_templates_branch_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "shift_templates"`);
  }
}