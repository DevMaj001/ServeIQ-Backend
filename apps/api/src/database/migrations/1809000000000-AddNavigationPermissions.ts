import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNavigationPermissions1809000000000 implements MigrationInterface {
  name = 'AddNavigationPermissions1809000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Insert dedicated navigation permissions (code is unique).
    await queryRunner.query(`
      INSERT INTO "permissions" ("id", "code", "name", "description", "category")
      SELECT gen_random_uuid(), v.code, v.name, v.description, v.category
      FROM (VALUES
        ('view_analytics', 'View Analytics', 'View the analytics dashboard', 'Reports'),
        ('view_branch_analytics', 'View Branch Analytics', 'View branch-level analytics', 'Reports'),
        ('view_reports', 'View Reports', 'View sales reports', 'Reports'),
        ('view_departments', 'View Departments', 'View department management', 'Staff'),
        ('view_shifts', 'View Shifts', 'View shift schedules', 'Reports'),
        ('view_pos', 'View POS', 'View the point-of-sale interface', 'Reports'),
        ('view_notifications', 'View Notifications', 'View system notifications', 'Staff'),
        ('view_billing', 'View Billing', 'View billing and subscription', 'System'),
        ('view_pulse', 'View Pulse', 'View the real-time pulse dashboard', 'Reports'),
        ('view_premium_dashboard', 'View Premium Dashboard', 'View the premium dashboard', 'Reports'),
        ('view_inventory_audit', 'View Inventory Audit', 'View inventory audit log', 'Inventory'),
        ('view_inventory_tally', 'View Daily Tally', 'View daily inventory tally', 'Inventory'),
        ('reconcile_inventory', 'Reconcile Inventory', 'Reconcile inventory levels', 'Inventory'),
        ('view_tabs', 'View Tabs', 'View open tabs', 'Tables'),
        ('view_business_setup', 'View Business Setup', 'View the business setup wizard', 'System'),
        ('view_feedback', 'View Feedback', 'Submit and view feedback', 'Customers')
      ) AS v(code, name, description, category)
      WHERE NOT EXISTS (SELECT 1 FROM "permissions" p WHERE p.code = v.code)
    `);

    // 2. Grant each new permission to roles that already hold its parent permission
    //    so nobody loses existing access while gaining granular control.
    await queryRunner.query(`
      WITH v(new_code, parent_code) AS (
        VALUES
          ('view_analytics', 'view_dashboard'),
          ('view_branch_analytics', 'view_daily_sales'),
          ('view_reports', 'view_daily_sales'),
          ('view_departments', 'view_staff'),
          ('view_shifts', 'view_dashboard'),
          ('view_pos', 'view_dashboard'),
          ('view_notifications', 'view_dashboard'),
          ('view_billing', 'view_dashboard'),
          ('view_billing', 'manage_subscription'),
          ('view_pulse', 'view_dashboard'),
          ('view_premium_dashboard', 'view_dashboard'),
          ('view_inventory_audit', 'view_inventory'),
          ('view_inventory_tally', 'view_inventory'),
          ('reconcile_inventory', 'adjust_stock'),
          ('view_tabs', 'open_table'),
          ('view_business_setup', 'restaurant_settings')
      )
      INSERT INTO "role_permissions" ("role_id", "permission_id")
      SELECT DISTINCT r.id, np.id
      FROM "roles" r
      JOIN "role_permissions" rp ON rp.role_id = r.id
      JOIN "permissions" op ON op.id = rp.permission_id
      JOIN v ON v.parent_code = op.code
      JOIN "permissions" np ON np.code = v.new_code
      WHERE NOT EXISTS (
        SELECT 1 FROM "role_permissions" x WHERE x.role_id = r.id AND x.permission_id = np.id
      )
    `);

    // 3. view_feedback was previously available to every logged-in staff member:
    //    grant it to all roles.
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id")
      SELECT r.id, p.id
      FROM "roles" r
      CROSS JOIN "permissions" p
      WHERE p.code = 'view_feedback'
        AND NOT EXISTS (
          SELECT 1 FROM "role_permissions" x WHERE x.role_id = r.id AND x.permission_id = p.id
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role_permissions"
      WHERE "permission_id" IN (
        SELECT "id" FROM "permissions" WHERE "code" IN (
          'view_analytics',
          'view_branch_analytics',
          'view_reports',
          'view_departments',
          'view_shifts',
          'view_pos',
          'view_notifications',
          'view_billing',
          'view_pulse',
          'view_premium_dashboard',
          'view_inventory_audit',
          'view_inventory_tally',
          'reconcile_inventory',
          'view_tabs',
          'view_business_setup',
          'view_feedback'
        )
      )
    `);
    await queryRunner.query(`
      DELETE FROM "permissions" WHERE "code" IN (
        'view_analytics',
        'view_branch_analytics',
        'view_reports',
        'view_departments',
        'view_shifts',
        'view_pos',
        'view_notifications',
        'view_billing',
        'view_pulse',
        'view_premium_dashboard',
        'view_inventory_audit',
        'view_inventory_tally',
        'reconcile_inventory',
        'view_tabs',
        'view_business_setup',
        'view_feedback'
      )
    `);
  }
}