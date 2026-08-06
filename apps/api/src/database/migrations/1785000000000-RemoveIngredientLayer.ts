import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveIngredientLayer1785000000000 implements MigrationInterface {
  name = 'RemoveIngredientLayer1785000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // === STEP 1: Add stock columns to menu_items ===
    await queryRunner.query(
      `ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "quantity_in_stock" decimal(12,3) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "reorder_level" decimal(12,3) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "cost_price_kobo" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "track_stock" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "supplier_id" uuid`,
    );

    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_menu_items_supplier_id"
            ON "menu_items" ("supplier_id")
        `);

    // Add FK constraint for supplier_id
    await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_menu_items_supplier_id') THEN
                    ALTER TABLE "menu_items"
                    ADD CONSTRAINT "FK_menu_items_supplier_id"
                    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
                    ON DELETE NO ACTION ON UPDATE NO ACTION;
                END IF;
            END $$;
        `);

    // === STEP 2: Repoint stock_movements ===
    // Add menu_item_id column to the existing stock_movements table alongside ingredient_id
    await queryRunner.query(`
            ALTER TABLE "stock_movements"
            ADD COLUMN IF NOT EXISTS "menu_item_id" uuid
        `);

    await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_movements_menu_item_id') THEN
                    ALTER TABLE "stock_movements"
                    ADD CONSTRAINT "FK_stock_movements_menu_item_id"
                    FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id")
                    ON DELETE NO ACTION ON UPDATE NO ACTION;
                END IF;
            END $$;
        `);

    // New partial unique index for order_consumption dedup on menu_item_id
    await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_stock_movements_dedup"
            ON "stock_movements" ("reference_id", "menu_item_id")
            WHERE "type" = 'order_consumption'
        `);

    // === STEP 3: Backfill menu_items from ingredients ===

    // Bucket A — directly-linked ingredients (menu_items with a row in ingredients.menu_item_id)
    await queryRunner.query(`
            UPDATE "menu_items" mi
            SET
                "quantity_in_stock" = i."quantity_in_stock",
                "reorder_level" = i."reorder_level",
                "cost_price_kobo" = i."cost_per_unit",
                "supplier_id" = i."supplier_id",
                "track_stock" = true
            FROM "ingredients" i
            WHERE i."menu_item_id" = mi."id"
        `);

    // Bucket B — recipe-only menu items (appear in recipe_items but no direct ingredient link)
    await queryRunner.query(`
            UPDATE "menu_items" mi
            SET
                "track_stock" = false,
                "cost_price_kobo" = NULL,
                "supplier_id" = NULL,
                "quantity_in_stock" = 0
            WHERE mi."id" IN (
                SELECT DISTINCT ri."menu_item_id"
                FROM "recipe_items" ri
            )
            AND mi."id" NOT IN (
                SELECT "menu_item_id" FROM "ingredients" WHERE "menu_item_id" IS NOT NULL
            )
        `);

    // Bucket C — menu items with neither ingredient link nor recipe
    await queryRunner.query(`
            UPDATE "menu_items" mi
            SET
                "track_stock" = false,
                "cost_price_kobo" = NULL,
                "supplier_id" = NULL,
                "quantity_in_stock" = 0
            WHERE mi."id" NOT IN (
                SELECT "menu_item_id" FROM "ingredients" WHERE "menu_item_id" IS NOT NULL
                UNION
                SELECT "menu_item_id" FROM "recipe_items"
            )
        `);

    // === STEP 4: Archive old stock_movements, create new empty ledger ===

    // Rename existing stock_movements → stock_movements_legacy_ingredient_based
    // This preserves the old ingredient_id-keyed data for audit trail.
    await queryRunner.query(`
            ALTER TABLE "stock_movements" RENAME TO "stock_movements_legacy_ingredient_based"
        `);

    // Rename the unique index to match the legacy table name
    await queryRunner.query(`
            ALTER INDEX IF EXISTS "IDX_stock_movements_dedup" RENAME TO "IDX_legacy_stock_movements_dedup"
        `);

    // Drop order_id from the legacy archive (not needed, kept only for history)
    await queryRunner.query(`
            ALTER TABLE "stock_movements_legacy_ingredient_based" DROP COLUMN IF EXISTS "order_id"
        `);

    // Create new stock_movements table with menu_item_id as the key
    await queryRunner.query(`
            CREATE TABLE "stock_movements" (
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

    await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_stock_movements_dedup"
            ON "stock_movements" ("reference_id", "menu_item_id")
            WHERE "type" = 'order_consumption'
        `);

    await queryRunner.query(`
            ALTER TABLE "stock_movements"
            ADD CONSTRAINT "FK_stock_movements_menu_item_id"
            FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id")
            ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

    // === Summary report (compute before dropping tables) ===
    const bucketA = await queryRunner.query(`
            SELECT COUNT(*)::int AS count FROM "menu_items" WHERE "track_stock" = true
        `);
    const bucketB = await queryRunner.query(`
            SELECT COUNT(*)::int AS count FROM "menu_items"
            WHERE "track_stock" = false AND "cost_price_kobo" IS NULL
            AND "id" IN (SELECT DISTINCT "menu_item_id" FROM "recipe_items")
        `);
    const bucketAAffected = await queryRunner.query(`
            SELECT json_agg(json_build_object('id', mi."id", 'name', mi."name") ORDER BY mi."name") AS items
            FROM "menu_items" mi WHERE mi."track_stock" = true
        `);
    const bucketBAffected = await queryRunner.query(`
            SELECT json_agg(json_build_object('id', mi."id", 'name', mi."name") ORDER BY mi."name") AS items
            FROM "menu_items" mi
            WHERE mi."track_stock" = false AND mi."cost_price_kobo" IS NULL
            AND mi."id" IN (SELECT DISTINCT "menu_item_id" FROM "recipe_items")
        `);
    const bucketCAffected = await queryRunner.query(`
            SELECT json_agg(json_build_object('id', mi."id", 'name', mi."name") ORDER BY mi."name") AS items
            FROM "menu_items" mi
            WHERE mi."track_stock" = false AND mi."supplier_id" IS NULL
            AND mi."id" NOT IN (SELECT "menu_item_id" FROM "ingredients" WHERE "menu_item_id" IS NOT NULL)
            AND mi."id" NOT IN (SELECT "menu_item_id" FROM "recipe_items")
        `);

    console.log('===== Backfill Summary Report =====');
    console.log(
      `Bucket A (stock-tracked, linked to ingredient): ${bucketA[0]?.count ?? 0}`,
    );
    console.log(
      `Bucket B (recipe-only, non-tracked): ${bucketB[0]?.count ?? 0}`,
    );
    console.log(`Bucket C (neither, non-tracked): `);
    console.log(
      `Affected Bucket A items:`,
      JSON.stringify(bucketAAffected[0]?.items ?? []),
    );
    console.log(
      `Affected Bucket B items:`,
      JSON.stringify(bucketBAffected[0]?.items ?? []),
    );
    console.log(
      `Affected Bucket C items:`,
      JSON.stringify(bucketCAffected[0]?.items ?? []),
    );
    console.log('====================================');

    // === STEP 5: Drop old tables ===
    await queryRunner.query(`DROP TABLE IF EXISTS "recipe_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ingredients"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop FK constraint from new stock_movements
    await queryRunner.query(`
            ALTER TABLE "stock_movements"
            DROP CONSTRAINT IF EXISTS "FK_stock_movements_menu_item_id"
        `);

    // Drop new stock_movements
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_movements"`);

    // Rename legacy back
    await queryRunner.query(`
            ALTER TABLE "stock_movements_legacy_ingredient_based" RENAME TO "stock_movements"
        `);

    // Restore indices
    await queryRunner.query(`
            ALTER INDEX IF EXISTS "IDX_legacy_stock_movements_dedup" RENAME TO "IDX_stock_movements_dedup"
        `);

    // Recreate ingredients and recipe_items
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "ingredients" (
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
    await queryRunner.query(
      `CREATE INDEX "IDX_ingredients_branch_id" ON "ingredients" ("branch_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ingredients_menu_item_id" ON "ingredients" ("menu_item_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ingredients_supplier_id" ON "ingredients" ("supplier_id")`,
    );

    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "recipe_items" (
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
    await queryRunner.query(
      `CREATE INDEX "IDX_recipe_items_menu_item_id" ON "recipe_items" ("menu_item_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_recipe_items_ingredient_id" ON "recipe_items" ("ingredient_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_recipe_items_menu_ingredient" ON "recipe_items" ("menu_item_id", "ingredient_id")`,
    );

    // Remove stock columns from menu_items
    await queryRunner.query(`
            ALTER TABLE "menu_items"
            DROP CONSTRAINT IF EXISTS "FK_menu_items_supplier_id"
        `);
    await queryRunner.query(`
            ALTER TABLE "menu_items"
            DROP COLUMN IF EXISTS "supplier_id",
            DROP COLUMN IF EXISTS "track_stock",
            DROP COLUMN IF EXISTS "cost_price_kobo",
            DROP COLUMN IF EXISTS "reorder_level",
            DROP COLUMN IF EXISTS "quantity_in_stock"
        `);
  }
}
