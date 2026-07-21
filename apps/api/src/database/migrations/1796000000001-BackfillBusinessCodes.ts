import { MigrationInterface, QueryRunner } from "typeorm";

export class BackfillBusinessCodes1796000000001 implements MigrationInterface {
    name = 'BackfillBusinessCodes1796000000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE "businesses" SET "business_code" = upper(substr(md5("id"::text), 1, 8)) WHERE "business_code" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // no down — codes are data, not schema
    }
}
