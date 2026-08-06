import { MigrationInterface, QueryRunner } from 'typeorm';
import { VIRTUAL_COUNTER_INSERT_SQL } from '../../modules/table/table-system.service';

export class AddVirtualCounterTable1800000000000 implements MigrationInterface {
  name = 'AddVirtualCounterTable1800000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "tables"
            ADD COLUMN IF NOT EXISTS "is_virtual" boolean NOT NULL DEFAULT false
        `);

    const branches = await queryRunner.query(`SELECT id FROM "branches"`);
    for (const branch of branches) {
      await queryRunner.query(VIRTUAL_COUNTER_INSERT_SQL, [branch.id]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DELETE FROM "tables" WHERE "is_virtual" = true
        `);
    await queryRunner.query(`
            ALTER TABLE "tables" DROP COLUMN IF EXISTS "is_virtual"
        `);
  }
}
