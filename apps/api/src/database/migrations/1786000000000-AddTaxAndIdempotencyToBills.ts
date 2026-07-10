import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTaxAndIdempotencyToBills1786000000000 implements MigrationInterface {
    name = 'AddTaxAndIdempotencyToBills1786000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "bills"
            ADD COLUMN "tax_kobo" integer NOT NULL DEFAULT 0
        `);
        await queryRunner.query(`
            ALTER TABLE "bills"
            ADD COLUMN "idempotency_key" varchar NULL
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_bills_idempotency_key" ON "bills" ("idempotency_key")
            WHERE "idempotency_key" IS NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bills_idempotency_key"`);
        await queryRunner.query(`ALTER TABLE "bills" DROP COLUMN "idempotency_key"`);
        await queryRunner.query(`ALTER TABLE "bills" DROP COLUMN "tax_kobo"`);
    }
}