import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddManageDevicesPermission1815000000000 implements MigrationInterface {
  name = 'AddManageDevicesPermission1815000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Insert the manage_devices permission if it does not exist.
    await queryRunner.query(`
      INSERT INTO "permissions" ("id", "code", "name", "description", "category")
      SELECT gen_random_uuid(), 'manage_devices', 'Manage Devices', 'List, revoke and reactivate registered devices', 'Reports'
      WHERE NOT EXISTS (SELECT 1 FROM "permissions" p WHERE p.code = 'manage_devices')
    `);

    // 2. Grant to Owner and Manager roles.
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id")
      SELECT r.id, p.id
      FROM "roles" r
      CROSS JOIN "permissions" p
      WHERE r.name IN ('Owner', 'Manager')
        AND p.code = 'manage_devices'
        AND NOT EXISTS (
          SELECT 1 FROM "role_permissions" x WHERE x.role_id = r.id AND x.permission_id = p.id
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role_permissions"
      WHERE "permission_id" IN (SELECT "id" FROM "permissions" WHERE "code" = 'manage_devices')
    `);
    await queryRunner.query(`
      DELETE FROM "permissions" WHERE "code" = 'manage_devices'
    `);
  }
}