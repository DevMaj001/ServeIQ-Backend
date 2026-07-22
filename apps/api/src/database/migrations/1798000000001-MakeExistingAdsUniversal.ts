import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeExistingAdsUniversal1798000000001 implements MigrationInterface {
    name = 'MakeExistingAdsUniversal1798000000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE "advertisements" SET "branch_id" = NULL WHERE "branch_id" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }
}
