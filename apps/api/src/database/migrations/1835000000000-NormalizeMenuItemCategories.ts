import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeMenuItemCategories1835000000000
  implements MigrationInterface
{
  name = 'NormalizeMenuItemCategories1835000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `WITH norm AS (
         SELECT id, branch_id,
                btrim(regexp_replace(category, '[\\s_\\-]+', ' ', 'g')) AS norm
         FROM menu_items
         WHERE category IS NOT NULL
       ),
       counts AS (
         SELECT branch_id, lower(norm) AS key,
                array_agg(norm ORDER BY id) AS names
         FROM norm
         GROUP BY branch_id, lower(norm)
       ),
       picked AS (
         SELECT branch_id, key, (names)[1] AS chosen_label
         FROM counts
       )
       UPDATE menu_items mi
       SET category = p.chosen_label
       FROM picked p
       WHERE mi.branch_id = p.branch_id
         AND lower(btrim(regexp_replace(mi.category, '[\\s_\\-]+', ' ', 'g'))) = p.key
         AND mi.category IS DISTINCT FROM p.chosen_label`,
    );
  }

  public down(): Promise<void> {
    // data merge — not reversible
    return Promise.resolve();
  }
}
