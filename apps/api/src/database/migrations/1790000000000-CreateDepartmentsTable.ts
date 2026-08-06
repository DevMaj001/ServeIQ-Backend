import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDepartmentsTable1790000000000 implements MigrationInterface {
  name = 'CreateDepartmentsTable1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "departments" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "branch_id" uuid NOT NULL,
            "name" character varying(100) NOT NULL,
            "is_active" boolean NOT NULL DEFAULT true,
            "created_at" TIMESTAMP NOT NULL DEFAULT now(),
            "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_departments" PRIMARY KEY ("id")
        )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_departments_branch_id" ON "departments" ("branch_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "departments" ADD CONSTRAINT "FK_departments_branch_id" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "departments" DROP CONSTRAINT IF EXISTS "FK_departments_branch_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_departments_branch_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "departments"`);
  }
}
