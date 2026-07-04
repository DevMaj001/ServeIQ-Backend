import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSuperadminToUserRoleEnum1784000000002 implements MigrationInterface {
    name = 'AddSuperadminToUserRoleEnum1784000000002'
    transaction = false

    public async up(queryRunner: QueryRunner): Promise<void> {
        const exists = await queryRunner.query(
            `SELECT 1 FROM pg_enum WHERE enumlabel = 'superadmin' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'users_role_enum')`
        );
        if (!exists || exists.length === 0) {
            await queryRunner.query(`ALTER TYPE "users_role_enum" ADD VALUE 'superadmin'`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }
}
