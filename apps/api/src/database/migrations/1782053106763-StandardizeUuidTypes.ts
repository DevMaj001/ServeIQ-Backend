import { MigrationInterface, QueryRunner } from 'typeorm';

export class StandardizeUuidTypes1782053106763 implements MigrationInterface {
  name = 'StandardizeUuidTypes1782053106763';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_0eddfeffadbe29bec8750d589c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bills" DROP COLUMN IF EXISTS "tab_id"`,
    );
    await queryRunner.query(`ALTER TABLE "bills" ADD "tab_id" uuid`);
    await queryRunner.query(`DELETE FROM "bills" WHERE "tab_id" IS NULL`);
    await queryRunner.query(
      `ALTER TABLE "bills" ALTER COLUMN "tab_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_29171753dda776dfb0037dba05"`,
    );
    await queryRunner.query(
      `ALTER TABLE "menu_items" DROP COLUMN IF EXISTS "branch_id"`,
    );
    await queryRunner.query(`ALTER TABLE "menu_items" ADD "branch_id" uuid`);
    await queryRunner.query(
      `DELETE FROM "menu_items" WHERE "branch_id" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "menu_items" ALTER COLUMN "branch_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_03ef7c5c41b4fa6d62d27d47f4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "tab_id"`,
    );
    await queryRunner.query(`ALTER TABLE "orders" ADD "tab_id" uuid`);
    await queryRunner.query(`DELETE FROM "orders" WHERE "tab_id" IS NULL`);
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "tab_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_6290f6ba23d55826e9deaceee5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "menu_item_id"`,
    );
    await queryRunner.query(`ALTER TABLE "orders" ADD "menu_item_id" uuid`);
    await queryRunner.query(
      `DELETE FROM "orders" WHERE "menu_item_id" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "menu_item_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_4d5057e0cdbd1407b60216df6e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tabs" DROP COLUMN IF EXISTS "branch_id"`,
    );
    await queryRunner.query(`ALTER TABLE "tabs" ADD "branch_id" uuid`);
    await queryRunner.query(`DELETE FROM "tabs" WHERE "branch_id" IS NULL`);
    await queryRunner.query(
      `ALTER TABLE "tabs" ALTER COLUMN "branch_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_1e4fa66a2d59fde6dbb07fb13a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tabs" DROP COLUMN IF EXISTS "table_id"`,
    );
    await queryRunner.query(`ALTER TABLE "tabs" ADD "table_id" uuid`);
    await queryRunner.query(`DELETE FROM "tabs" WHERE "table_id" IS NULL`);
    await queryRunner.query(
      `ALTER TABLE "tabs" ALTER COLUMN "table_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_2b477b0f678402fb70905e3aed"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tabs" DROP COLUMN IF EXISTS "waiter_id"`,
    );
    await queryRunner.query(`ALTER TABLE "tabs" ADD "waiter_id" uuid`);
    await queryRunner.query(`DELETE FROM "tabs" WHERE "waiter_id" IS NULL`);
    await queryRunner.query(
      `ALTER TABLE "tabs" ALTER COLUMN "waiter_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_ebe158ed365131baec7dccaae5"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_283e6bfdd38a7cc7fec643f72b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tables" DROP COLUMN IF EXISTS "branch_id"`,
    );
    await queryRunner.query(`ALTER TABLE "tables" ADD "branch_id" uuid`);
    await queryRunner.query(`DELETE FROM "tables" WHERE "branch_id" IS NULL`);
    await queryRunner.query(
      `ALTER TABLE "tables" ALTER COLUMN "branch_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_0eddfeffadbe29bec8750d589c" ON "bills"  ("tab_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_29171753dda776dfb0037dba05" ON "menu_items"  ("branch_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_03ef7c5c41b4fa6d62d27d47f4" ON "orders"  ("tab_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6290f6ba23d55826e9deaceee5" ON "orders"  ("menu_item_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4d5057e0cdbd1407b60216df6e" ON "tabs"  ("branch_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1e4fa66a2d59fde6dbb07fb13a" ON "tabs"  ("table_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2b477b0f678402fb70905e3aed" ON "tabs"  ("waiter_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_283e6bfdd38a7cc7fec643f72b" ON "tables"  ("branch_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ebe158ed365131baec7dccaae5" ON "tables"  ("branch_id", "table_number") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ebe158ed365131baec7dccaae5"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_283e6bfdd38a7cc7fec643f72b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2b477b0f678402fb70905e3aed"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1e4fa66a2d59fde6dbb07fb13a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4d5057e0cdbd1407b60216df6e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6290f6ba23d55826e9deaceee5"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_03ef7c5c41b4fa6d62d27d47f4"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_29171753dda776dfb0037dba05"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0eddfeffadbe29bec8750d589c"`,
    );
    await queryRunner.query(`ALTER TABLE "tables" DROP COLUMN "branch_id"`);
    await queryRunner.query(
      `ALTER TABLE "tables" ADD "branch_id" character varying NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_283e6bfdd38a7cc7fec643f72b" ON "tables" USING btree ("branch_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ebe158ed365131baec7dccaae5" ON "tables" USING btree ("branch_id", "table_number") `,
    );
    await queryRunner.query(`ALTER TABLE "tabs" DROP COLUMN "waiter_id"`);
    await queryRunner.query(
      `ALTER TABLE "tabs" ADD "waiter_id" character varying NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2b477b0f678402fb70905e3aed" ON "tabs" USING btree ("waiter_id") `,
    );
    await queryRunner.query(`ALTER TABLE "tabs" DROP COLUMN "table_id"`);
    await queryRunner.query(
      `ALTER TABLE "tabs" ADD "table_id" character varying NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1e4fa66a2d59fde6dbb07fb13a" ON "tabs" USING btree ("table_id") `,
    );
    await queryRunner.query(`ALTER TABLE "tabs" DROP COLUMN "branch_id"`);
    await queryRunner.query(
      `ALTER TABLE "tabs" ADD "branch_id" character varying NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4d5057e0cdbd1407b60216df6e" ON "tabs" USING btree ("branch_id") `,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "menu_item_id"`);
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "menu_item_id" character varying NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6290f6ba23d55826e9deaceee5" ON "orders" USING btree ("menu_item_id") `,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "tab_id"`);
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "tab_id" character varying NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_03ef7c5c41b4fa6d62d27d47f4" ON "orders" USING btree ("tab_id") `,
    );
    await queryRunner.query(`ALTER TABLE "menu_items" DROP COLUMN "branch_id"`);
    await queryRunner.query(
      `ALTER TABLE "menu_items" ADD "branch_id" character varying NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_29171753dda776dfb0037dba05" ON "menu_items" USING btree ("branch_id") `,
    );
    await queryRunner.query(`ALTER TABLE "bills" DROP COLUMN "tab_id"`);
    await queryRunner.query(
      `ALTER TABLE "bills" ADD "tab_id" character varying NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_0eddfeffadbe29bec8750d589c" ON "bills" USING btree ("tab_id") `,
    );
  }
}
