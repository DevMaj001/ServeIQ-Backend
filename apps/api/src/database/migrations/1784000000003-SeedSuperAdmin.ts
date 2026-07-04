import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedSuperAdmin1784000000003 implements MigrationInterface {
    name = 'SeedSuperAdmin1784000000003'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const existing = await queryRunner.query(
            `SELECT id FROM "users" WHERE email = 'majestydennis6@gmail.com'`
        );
        if (existing && existing.length > 0) return;

        let businessId: string;
        const slugExists = await queryRunner.query(
            `SELECT id FROM "businesses" WHERE slug = 'serveiq-admin'`
        );
        if (slugExists && slugExists.length > 0) {
            businessId = slugExists[0].id;
        } else {
            await queryRunner.query(`
                INSERT INTO "businesses" ("name", "slug", "type", "owner_id", "email", "is_active")
                VALUES ('ServeIQ Admin', 'serveiq-admin', 'restaurant', '00000000-0000-0000-0000-000000000000', 'admin@serveiq.io', true)
            `);
            const bizResult = await queryRunner.query(`SELECT id FROM "businesses" WHERE slug = 'serveiq-admin'`);
            businessId = bizResult[0].id;
        }

        await queryRunner.query(`
            INSERT INTO "branches" ("business_id", "name", "is_active")
            VALUES ('${businessId}', 'Admin Branch', true)
        `);
        const branchResult = await queryRunner.query(
            `SELECT id FROM "branches" WHERE business_id = '${businessId}' AND name = 'Admin Branch'`
        );
        const branchId = branchResult[0].id;

        await queryRunner.query(`
            INSERT INTO "users" ("business_id", "branch_id", "full_name", "email", "password_hash", "role", "is_active")
            VALUES ('${businessId}', '${branchId}', 'Super Admin', 'majestydennis6@gmail.com', '$2b$10$lWdKbNtEx5ggLkl2iIjAZ.8A0RZAPvGvCO9zFzyJH4jJOae1ZlWZ6', 'superadmin', true)
        `);
        const userResult = await queryRunner.query(
            `SELECT id FROM "users" WHERE email = 'majestydennis6@gmail.com'`
        );
        const userId = userResult[0].id;

        await queryRunner.query(`
            UPDATE "businesses" SET owner_id = '${userId}' WHERE id = '${businessId}'
        `);

        const subExists = await queryRunner.query(`
            SELECT id FROM "subscriptions" WHERE branch_id = '${branchId}'
        `);
        if (!subExists || subExists.length === 0) {
            await queryRunner.query(`
                INSERT INTO "subscriptions" ("branch_id", "status", "trial_ends_at")
                VALUES ('${branchId}', 'trialing', NOW() + INTERVAL '9999 days')
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DELETE FROM "users" WHERE email = 'majestydennis6@gmail.com'`
        );
        await queryRunner.query(
            `DELETE FROM "subscriptions" WHERE branch_id IN (SELECT id FROM "branches" WHERE business_id IN (SELECT id FROM "businesses" WHERE slug = 'serveiq-admin'))`
        );
        await queryRunner.query(
            `DELETE FROM "branches" WHERE business_id IN (SELECT id FROM "businesses" WHERE slug = 'serveiq-admin')`
        );
        await queryRunner.query(
            `DELETE FROM "businesses" WHERE slug = 'serveiq-admin'`
        );
    }
}
