import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedSuperAdmin1784000000002 implements MigrationInterface {
    name = 'SeedSuperAdmin1784000000002'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO "businesses" ("id", "name", "slug", "type", "owner_id", "email", "is_active")
            SELECT '8326c991-f20b-4a70-8dfd-2b74cf3105a9', 'ServeIQ Admin', 'serveiq-admin', 'restaurant', '00000000-0000-0000-0000-000000000000', 'admin@serveiq.io', true
            WHERE NOT EXISTS (SELECT 1 FROM "businesses" WHERE "slug" = 'serveiq-admin')
        `);

        const bizExists = await queryRunner.query(
            `SELECT "id" FROM "businesses" WHERE "slug" = 'serveiq-admin'`
        );
        const businessId = bizExists?.[0]?.id || '8326c991-f20b-4a70-8dfd-2b74cf3105a9';

        await queryRunner.query(`
            INSERT INTO "branches" ("id", "business_id", "name", "is_active")
            SELECT 'b76847fc-5997-4f3d-bbb1-5631505d1d68', '${businessId}', 'Admin Branch', true
            WHERE NOT EXISTS (SELECT 1 FROM "branches" WHERE "business_id" = '${businessId}' AND "name" = 'Admin Branch')
        `);

        const branchExists = await queryRunner.query(
            `SELECT "id" FROM "branches" WHERE "business_id" = '${businessId}' AND "name" = 'Admin Branch'`
        );
        const branchId = branchExists?.[0]?.id || 'b76847fc-5997-4f3d-bbb1-5631505d1d68';

        await queryRunner.query(`
            INSERT INTO "users" ("id", "business_id", "branch_id", "full_name", "email", "password_hash", "role", "is_active")
            SELECT '4544bb48-2e63-49ba-a91b-8b3946ceac3a', '${businessId}', '${branchId}', 'Super Admin', 'majestydennis6@gmail.com', '$2b$10$lWdKbNtEx5ggLkl2iIjAZ.8A0RZAPvGvCO9zFzyJH4jJOae1ZlWZ6', 'superadmin', true
            WHERE NOT EXISTS (SELECT 1 FROM "users" WHERE "email" = 'majestydennis6@gmail.com')
        `);

        const userExists = await queryRunner.query(
            `SELECT "id" FROM "users" WHERE "email" = 'majestydennis6@gmail.com'`
        );
        if (userExists?.[0]?.id) {
            await queryRunner.query(`
                UPDATE "businesses" SET "owner_id" = '${userExists[0].id}' WHERE "id" = '${businessId}'
            `);
        }

        await queryRunner.query(`
            INSERT INTO "subscriptions" ("branch_id", "status", "trial_ends_at")
            SELECT '${branchId}', 'trialing', NOW() + INTERVAL '9999 days'
            WHERE NOT EXISTS (SELECT 1 FROM "subscriptions" WHERE "branch_id" = '${branchId}')
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DELETE FROM "users" WHERE "email" = 'majestydennis6@gmail.com'`
        );
        await queryRunner.query(
            `DELETE FROM "subscriptions" WHERE "branch_id" IN (SELECT "id" FROM "branches" WHERE "business_id" = '8326c991-f20b-4a70-8dfd-2b74cf3105a9')`
        );
        await queryRunner.query(
            `DELETE FROM "branches" WHERE "id" = 'b76847fc-5997-4f3d-bbb1-5631505d1d68'`
        );
        await queryRunner.query(
            `DELETE FROM "businesses" WHERE "id" = '8326c991-f20b-4a70-8dfd-2b74cf3105a9'`
        );
    }
}
