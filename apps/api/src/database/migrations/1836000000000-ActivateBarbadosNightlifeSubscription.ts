import { MigrationInterface, QueryRunner } from 'typeorm';

const MATCH = `AND bu.name ILIKE 'Barbados%Night%'`;

export class ActivateBarbadosNightlifeSubscription1836000000000
  implements MigrationInterface
{
  name = 'ActivateBarbadosNightlifeSubscription1836000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Activate the subscription for Barbados Nightlifee that got stuck in
    // trialing because callback_url was never sent to Paystack before the fix.
    await queryRunner.query(`
      UPDATE subscriptions s
      SET status = 'active',
          current_period_start = COALESCE(s.current_period_start, NOW()),
          current_period_end = COALESCE(
            s.current_period_end,
            NOW() + INTERVAL '30 days'
          ),
          trial_ends_at = NULL,
          updated_at = NOW()
      FROM branches b
      JOIN businesses bu ON bu.id = b.business_id
      WHERE s.branch_id = b.id
        AND ${MATCH}
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE subscriptions s
      SET status = 'trialing',
          current_period_start = NULL,
          current_period_end = NULL,
          trial_ends_at = NOW() + INTERVAL '14 days',
          updated_at = NOW()
      FROM branches b
      JOIN businesses bu ON bu.id = b.business_id
      WHERE s.branch_id = b.id
        AND ${MATCH}
    `);
  }
}