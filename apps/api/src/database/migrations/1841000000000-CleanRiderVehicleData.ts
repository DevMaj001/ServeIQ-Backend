import { MigrationInterface, QueryRunner } from 'typeorm';

export class CleanRiderVehicleData1841000000000 implements MigrationInterface {
  name = 'CleanRiderVehicleData1841000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Riders created via the staff page had their avatar_url incorrectly
    // written into the vehicle field. Clean those up by setting vehicle to NULL
    // where it looks like a Cloudinary/HTTP URL.
    await queryRunner.query(`
      UPDATE "riders"
      SET "vehicle" = NULL
      WHERE "vehicle" IS NOT NULL
        AND ("vehicle" LIKE 'http://%' OR "vehicle" LIKE 'https://%');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Cannot restore original data (it was incorrect anyway).
    // No-op.
  }
}