import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillUserRoleId1752892800000 implements MigrationInterface {
  name = 'BackfillUserRoleId1752892800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Starting role_id backfill for users with NULL role_id...');

    // Map legacy users.role enum values to roles.name
    // First, ensure all expected roles exist
    const roles = await queryRunner.query(
      `SELECT id, name FROM roles WHERE name IN ('Owner', 'Manager', 'Supervisor', 'Waiter', 'Chef', 'Cashier', 'Owner')`,
    );

    const roleMap = new Map<string, string>();
    roles.forEach((r: { id: string; name: string }) =>
      roleMap.set(r.name, r.id),
    );
    console.log('Found roles:', Array.from(roleMap.entries()));

    // Verify all expected roles exist
    const expectedRoles = [
      'Owner',
      'Manager',
      'Supervisor',
      'Waiter',
      'Chef',
      'Cashier',
    ];
    for (const role of expectedRoles) {
      if (!roleMap.has(role)) {
        throw new Error(`Required role "${role}" not found in roles table`);
      }
    }

    // Map legacy enum values to role names
    // users.role column uses the UserRole enum values (lowercase in some cases)
    const roleMapping = {
      owner: 'Owner',
      manager: 'Manager',
      supervisor: 'Supervisor',
      waiter: 'Waiter',
      chef: 'Chef',
      cashier: 'Cashier',
      superadmin: 'Owner', // superadmin maps to Owner role for permission purposes
    };

    for (const [legacyRole, roleName] of Object.entries(roleMapping)) {
      const roleId = roleMap.get(roleName);
      if (!roleId) {
        console.warn(
          `Warning: No role ID found for ${roleName} (mapped from ${legacyRole})`,
        );
        continue;
      }

      const result = await queryRunner.query(
        `UPDATE users SET role_id = $1 WHERE role_id IS NULL AND role = $2`,
        [roleId, legacyRole],
      );

      const count = result[1] || 0;
      if (count > 0) {
        console.log(
          `Updated ${count} users with legacy role "${legacyRole}" -> role_id ${roleId} (${roleName})`,
        );
      }
    }

    // Check for any remaining NULL role_id
    const remaining = await queryRunner.query(
      `SELECT id, email, role FROM users WHERE role_id IS NULL`,
    );

    if (remaining.length > 0) {
      console.warn(
        'WARNING: The following users still have NULL role_id after backfill:',
      );
      console.table(remaining);
    } else {
      console.log('SUCCESS: All users now have role_id populated.');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op: Backfill is derived from existing data (users.role enum).
    // Reversing would require knowing original NULL state which is not tracked.
    // This migration is effectively irreversible without a backup.
    console.log(
      'No-op down migration: role_id backfill is not meaningfully reversible.',
    );
  }
}
