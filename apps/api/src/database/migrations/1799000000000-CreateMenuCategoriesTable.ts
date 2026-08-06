import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMenuCategoriesTable1799000000000 implements MigrationInterface {
  name = 'CreateMenuCategoriesTable1799000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "menu_categories" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "branch_id" uuid NOT NULL,
                "name" character varying(100) NOT NULL,
                "sort_order" integer NOT NULL DEFAULT 0,
                "is_active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_menu_categories_id" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_menu_categories_branch_id" ON "menu_categories" ("branch_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_menu_categories_branch_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "menu_categories"`);
  }
}
