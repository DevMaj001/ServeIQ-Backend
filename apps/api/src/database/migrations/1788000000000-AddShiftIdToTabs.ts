import { MigrationInterface, QueryRunner } from "typeorm";

export class AddShiftIdToTabs1788000000000 implements MigrationInterface {
    name = 'AddShiftIdToTabs1788000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tabs" ADD COLUMN IF NOT EXISTS "shift_id" uuid`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_tabs_shift_id" ON "tabs" ("shift_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tabs_shift_id"`);
        await queryRunner.query(`ALTER TABLE "tabs" DROP COLUMN "shift_id"`);
    }
}
