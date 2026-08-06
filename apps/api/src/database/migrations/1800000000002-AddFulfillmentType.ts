import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFulfillmentType1800000000002 implements MigrationInterface {
  name = 'AddFulfillmentType1800000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'orders_fulfillment_type_enum') THEN
                    CREATE TYPE "public"."orders_fulfillment_type_enum" AS ENUM('serve', 'pack');
                END IF;
            END $$
        `);
    await queryRunner.query(`
            ALTER TABLE "orders"
            ADD COLUMN "fulfillment_type" "public"."orders_fulfillment_type_enum" NOT NULL DEFAULT 'serve'
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "orders" DROP COLUMN IF EXISTS "fulfillment_type"
        `);
    await queryRunner.query(`
            DROP TYPE IF EXISTS "public"."orders_fulfillment_type_enum"
        `);
  }
}
