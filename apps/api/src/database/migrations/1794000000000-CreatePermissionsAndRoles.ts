import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePermissionsAndRoles1794000000000 implements MigrationInterface {
  name = 'CreatePermissionsAndRoles1794000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "permissions" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "code" varchar(50) NOT NULL,
                "name" varchar(100) NOT NULL,
                "description" text,
                "category" varchar(30) NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_permissions" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_permissions_code" UNIQUE ("code")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "roles" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "name" varchar(50) NOT NULL,
                "description" text,
                "is_system" boolean NOT NULL DEFAULT false,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_roles" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "role_permissions" (
                "role_id" uuid NOT NULL,
                "permission_id" uuid NOT NULL,
                CONSTRAINT "PK_role_permissions" PRIMARY KEY ("role_id", "permission_id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_role_permissions_role_id" ON "role_permissions" ("role_id")
        `);
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_role_permissions_permission_id" ON "role_permissions" ("permission_id")
        `);
    await queryRunner.query(`
            ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role_id" uuid
        `);
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_users_role_id" ON "users" ("role_id")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_users_role_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "role_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_role_permissions_permission_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_role_permissions_role_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "permissions"`);
  }
}
