import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUnitsTable1799000000001 implements MigrationInterface {
  name = 'CreateUnitsTable1799000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "units" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "branch_id" uuid NOT NULL,
                "name" character varying(50) NOT NULL,
                "sort_order" integer NOT NULL DEFAULT 0,
                "is_active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_units_id" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_units_branch_id" ON "units" ("branch_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_units_branch_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "units"`);
  }
}
