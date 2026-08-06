import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTabType1800000000001 implements MigrationInterface {
  name = 'AddTabType1800000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tabs_tab_type_enum') THEN
                    CREATE TYPE "public"."tabs_tab_type_enum" AS ENUM('dine_in', 'takeaway');
                END IF;
            END $$
        `);
    await queryRunner.query(`
            ALTER TABLE "tabs"
            ADD COLUMN "tab_type" "public"."tabs_tab_type_enum" NOT NULL DEFAULT 'dine_in'
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "tabs" DROP COLUMN IF EXISTS "tab_type"
        `);
    await queryRunner.query(`
            DROP TYPE IF EXISTS "public"."tabs_tab_type_enum"
        `);
  }
}
