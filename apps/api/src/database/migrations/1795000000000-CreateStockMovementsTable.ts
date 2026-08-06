import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStockMovementsTable1795000000000 implements MigrationInterface {
  name = 'CreateStockMovementsTable1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "stock_movements" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "branch_id" uuid NOT NULL,
                "menu_item_id" uuid NOT NULL,
                "type" varchar(25) NOT NULL DEFAULT 'manual_adjustment',
                "quantity_change" decimal(12,3) NOT NULL,
                "quantity_after" decimal(12,3) NOT NULL DEFAULT 0,
                "reference_id" uuid,
                "cost_at_purchase_kobo" integer,
                "notes" text,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_stock_movements" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_stock_movements_branch_id"
            ON "stock_movements" ("branch_id")
        `);
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_stock_movements_menu_item_id"
            ON "stock_movements" ("menu_item_id")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_movements"`);
  }
}
