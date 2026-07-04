import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedSuperAdmin1784000000002 implements MigrationInterface {
    name = 'SeedSuperAdmin1784000000002'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const existing = await queryRunner.query(
            `SELECT id FROM "users" WHERE email = 'majestydennis6@gmail.com'`
        );
        if (existing.length > 0) return;

        const businessResult = await queryRunner.query(`
            INSERT INTO "businesses" ("name", "slug", "type", "owner_id", "email", "is_active")
            VALUES ('ServeIQ Admin', 'serveiq-admin', 'restaurant', '00000000-0000-0000-0000-000000000000', 'admin@serveiq.io', true)
            RETURNING id
        `);
        const businessId = businessResult[0].id;

        const branchResult = await queryRunner.query(`
            INSERT INTO "branches" ("business_id", "name", "is_active")
            VALUES ($1, 'Admin Branch', true)
            RETURNING id
        `, [businessId]);
        const branchId = branchResult[0].id;

        const userResult = await queryRunner.query(`
            INSERT INTO "users" ("business_id", "branch_id", "full_name", "email", "password_hash", "role", "is_active")
            VALUES ($1, $2, 'Super Admin', 'majestydennis6@gmail.com', '$2b$10$D7E1ff2EOUu4mOuhRWHJ9e4/sS9Vj3dRyYm.nBjhCa2hZoj/lTBEG', 'superadmin', true)
            RETURNING id
        `, [businessId, branchId]);
        const userId = userResult[0].id;

        await queryRunner.query(`
            UPDATE "businesses" SET owner_id = $1 WHERE id = $2
        `, [userId, businessId]);

        await queryRunner.query(`
            INSERT INTO "subscriptions" ("branch_id", "status", "trial_ends_at")
            VALUES ($1, 'trialing', NOW() + INTERVAL '9999 days')
        `, [branchId]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DELETE FROM "subscriptions" WHERE branch_id IN (SELECT id FROM "branches" WHERE business_id IN (SELECT id FROM "businesses" WHERE slug = 'serveiq-admin'))`
        );
        await queryRunner.query(
            `DELETE FROM "users" WHERE email = 'majestydennis6@gmail.com'`
        );
        await queryRunner.query(
            `DELETE FROM "branches" WHERE business_id IN (SELECT id FROM "businesses" WHERE slug = 'serveiq-admin')`
        );
        await queryRunner.query(
            `DELETE FROM "businesses" WHERE slug = 'serveiq-admin'`
        );
    }
}
