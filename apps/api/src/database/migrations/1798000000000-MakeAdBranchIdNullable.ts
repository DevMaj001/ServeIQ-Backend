import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeAdBranchIdNullable1798000000000 implements MigrationInterface {
    name = 'MakeAdBranchIdNullable1798000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "advertisements" ALTER COLUMN "branch_id" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "advertisements" ALTER COLUMN "branch_id" SET NOT NULL`);
    }
}
