import { MigrationInterface, QueryRunner } from "typeorm";

// WARNING: down() is data-lossy for several fields that have no equivalent in the old
// inventory_items schema. Specifically:
//   - Recipe composition data (recipe_items) is completely dropped — no old-style equivalent.
//   - Ingredient metadata (name, unit, supplier_id, cost_per_unit, base_unit, conversion_to_base)
//     is lost because inventory_items only had menu_item_id + stock levels.
//   - Stock movement types are approximately mapped (order_consumption→sale, waste→wastage, etc.)
//     which is lossy for 'transfer' and 'manual_adjustment' entries.
//   - Quantity precision degrades: decimal(12,3) → integer rounding.
// This is acceptable for development rollback; production recovery should use a backup.
export class CreateIngredientsAndRecipes1784000000004 implements MigrationInterface {
    name = 'CreateIngredientsAndRecipes1784000000004'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "ingredients" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "branch_id" uuid NOT NULL,
                "name" varchar(100) NOT NULL,
                "unit" varchar(10) NOT NULL,
                "quantity_in_stock" decimal(12,3) NOT NULL DEFAULT 0,
                "reorder_level" decimal(12,3) NOT NULL DEFAULT 0,
                "conversion_to_base" decimal(12,3),
                "base_unit" varchar(10),
                "cost_per_unit" integer NOT NULL DEFAULT 0,
                "menu_item_id" uuid,
                "supplier_id" uuid,
                "created_at" timestamptz NOT NULL DEFAULT NOW(),
                "updated_at" timestamptz NOT NULL DEFAULT NOW(),
                "deleted_at" timestamptz,
                CONSTRAINT "PK_ingredients" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`CREATE INDEX "IDX_ingredients_branch_id" ON "ingredients" ("branch_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_ingredients_menu_item_id" ON "ingredients" ("menu_item_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_ingredients_supplier_id" ON "ingredients" ("supplier_id")`);

        await queryRunner.query(`
            CREATE TABLE "recipe_items" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "menu_item_id" uuid NOT NULL,
                "ingredient_id" uuid NOT NULL,
                "quantity_required" decimal(12,3) NOT NULL,
                "unit" varchar(10) NOT NULL,
                "waste_percent" integer,
                "created_at" timestamptz NOT NULL DEFAULT NOW(),
                "updated_at" timestamptz NOT NULL DEFAULT NOW(),
                CONSTRAINT "PK_recipe_items" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`CREATE INDEX "IDX_recipe_items_menu_item_id" ON "recipe_items" ("menu_item_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_recipe_items_ingredient_id" ON "recipe_items" ("ingredient_id")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_recipe_items_menu_ingredient" ON "recipe_items" ("menu_item_id", "ingredient_id")`);

        // Migrate existing inventory_items to ingredients
        await queryRunner.query(`
            INSERT INTO "ingredients" (
                "id", "branch_id", "name", "unit",
                "quantity_in_stock", "reorder_level",
                "cost_per_unit", "menu_item_id",
                "created_at", "updated_at"
            )
            SELECT
                i.id, i.branch_id,
                COALESCE(mi.name, 'Migrated Item') AS name,
                COALESCE(mi.unit, 'piece') AS unit,
                i.quantity_in_stock, i.reorder_level,
                0 AS cost_per_unit, i.menu_item_id,
                i.created_at, i.updated_at
            FROM "inventory_items" i
            LEFT JOIN "menu_items" mi ON mi.id = i.menu_item_id
        `);

        // Update stock_movements: rename column and add type
        await queryRunner.query(`
            ALTER TABLE "stock_movements"
            RENAME COLUMN "inventory_item_id" TO "ingredient_id"
        `);

        // Drop old movement_type enum and replace with type varchar
        await queryRunner.query(`
            ALTER TABLE "stock_movements"
            ADD COLUMN "type" varchar(25) NOT NULL DEFAULT 'manual_adjustment'
        `);

        // Map old movement_type to new type
        await queryRunner.query(`
            UPDATE "stock_movements"
            SET "type" = CASE
                WHEN "movement_type" = 'purchase' THEN 'purchase'
                WHEN "movement_type" = 'sale' THEN 'order_consumption'
                WHEN "movement_type" = 'adjustment' THEN 'manual_adjustment'
                WHEN "movement_type" = 'wastage' THEN 'waste'
                ELSE 'manual_adjustment'
            END
        `);

        await queryRunner.query(`
            ALTER TABLE "stock_movements"
            DROP COLUMN "movement_type"
        `);

        // Change quantity_change and quantity_after from integer to decimal(12,3)
        await queryRunner.query(`
            ALTER TABLE "stock_movements"
            ALTER COLUMN "quantity_change" TYPE decimal(12,3)
        `);

        await queryRunner.query(`
            ALTER TABLE "stock_movements"
            ALTER COLUMN "quantity_after" TYPE decimal(12,3)
        `);

        // Add order_id column
        await queryRunner.query(`
            ALTER TABLE "stock_movements"
            ADD COLUMN "order_id" uuid
        `);

        // Partial unique index for idempotency: prevents duplicate order_consumption
        // movements for the same (tab_id, ingredient_id) pair. Combined with the
        // aggregation of deductions per ingredient within a tab, this ensures at
        // most one consumption row per ingredient per tab. The application-level
        // check in deductByTab() is the fast-path; this index is the correctness
        // guarantee under concurrent retries.
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_stock_movements_dedup"
            ON "stock_movements" ("reference_id", "ingredient_id")
            WHERE "type" = 'order_consumption'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // First revert stock_movements column changes
        await queryRunner.query(`
            ALTER TABLE "stock_movements"
            RENAME COLUMN "ingredient_id" TO "inventory_item_id"
        `);

        await queryRunner.query(`
            ALTER TABLE "stock_movements"
            ADD COLUMN "movement_type" varchar(20) NOT NULL DEFAULT 'adjustment'
        `);

        await queryRunner.query(`
            UPDATE "stock_movements"
            SET "movement_type" = CASE
                WHEN "type" = 'purchase' THEN 'purchase'
                WHEN "type" = 'order_consumption' THEN 'sale'
                WHEN "type" = 'waste' THEN 'wastage'
                ELSE 'adjustment'
            END
        `);

        await queryRunner.query(`
            ALTER TABLE "stock_movements"
            DROP COLUMN "type"
        `);

        await queryRunner.query(`
            ALTER TABLE "stock_movements"
            ALTER COLUMN "quantity_change" TYPE integer USING "quantity_change"::integer
        `);

        await queryRunner.query(`
            ALTER TABLE "stock_movements"
            ALTER COLUMN "quantity_after" TYPE integer USING "quantity_after"::integer
        `);

        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_stock_movements_dedup"
        `);

        await queryRunner.query(`
            ALTER TABLE "stock_movements"
            DROP COLUMN "order_id"
        `);

        // Re-insert data from ingredients back to inventory_items
        // Only delete the rows that were migrated (ID match), preserving any rows
        // that may have been added independently.
        await queryRunner.query(`
            DELETE FROM "inventory_items" WHERE "id" IN (SELECT "id" FROM "ingredients")
        `);
        await queryRunner.query(`
            INSERT INTO "inventory_items" ("id", "branch_id", "menu_item_id", "quantity_in_stock", "reorder_level", "created_at", "updated_at")
            SELECT i.id, i.branch_id, i.menu_item_id,
                   ROUND(i.quantity_in_stock)::integer,
                   ROUND(i.reorder_level)::integer,
                   i.created_at, i.updated_at
            FROM "ingredients" i
        `);

        // Drop the new tables last
        await queryRunner.query(`DROP TABLE "recipe_items"`);
        await queryRunner.query(`DROP TABLE "ingredients"`);
    }
}
