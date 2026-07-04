import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSuperadminToUserRoleEnum1784000000003 implements MigrationInterface {
    name = 'AddSuperadminToUserRoleEnum1784000000003'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "users_role_enum" ADD VALUE IF NOT EXISTS 'superadmin'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Removing enum values is not supported by PostgreSQL
    }
}
