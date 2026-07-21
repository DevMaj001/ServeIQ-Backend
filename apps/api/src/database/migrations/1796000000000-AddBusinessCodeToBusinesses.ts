import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBusinessCodeToBusinesses1796000000000 implements MigrationInterface {
    name = 'AddBusinessCodeToBusinesses1796000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "business_code" character varying(12)`);
        await queryRunner.query(`UPDATE "businesses" SET "business_code" = upper(substr(md5("id"::text), 1, 8)) WHERE "business_code" IS NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_businesses_business_code" ON "businesses" ("business_code") WHERE "business_code" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_businesses_business_code"`);
        await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN IF EXISTS "business_code"`);
    }
}
