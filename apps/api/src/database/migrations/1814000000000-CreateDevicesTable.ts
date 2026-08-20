import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDevicesTable1814000000000 implements MigrationInterface {
  name = 'CreateDevicesTable1814000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "devices" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "business_id" uuid NOT NULL,
        "branch_id" uuid,
        "device_id" character varying(255) NOT NULL,
        "device_name" character varying(100),
        "platform" character varying(50),
        "app_version" character varying(255),
        "last_seen_at" TIMESTAMP,
        "revoked_at" TIMESTAMP,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_devices_user_id" ON "devices" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_devices_business_id" ON "devices" ("business_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_devices_device_id" ON "devices" ("device_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "devices"`);
  }
}