import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeShiftTemplateDaysOfWeek1819900000000 implements MigrationInterface {
  name = 'NormalizeShiftTemplateDaysOfWeek1819900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT data_type, udt_name
       FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = 'shift_templates'
         AND column_name = 'days_of_week'`,
    )) as { data_type: string; udt_name: string }[];

    const column = rows?.[0];
    if (!column) return;

    const isJson =
      column.data_type === 'jsonb' ||
      column.data_type === 'json' ||
      column.udt_name === 'jsonb';
    if (isJson) return;

    await queryRunner.query(
      `ALTER TABLE "shift_templates"
         ALTER COLUMN "days_of_week" TYPE jsonb
         USING to_jsonb("days_of_week"),
       ALTER COLUMN "days_of_week" SET DEFAULT '[]'::jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "shift_templates"
         ALTER COLUMN "days_of_week" TYPE integer[]
         USING ARRAY(
           SELECT (jsonb_array_elements_text("days_of_week"))::integer
         )`,
    );
  }
}