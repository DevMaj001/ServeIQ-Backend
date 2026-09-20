import { MigrationInterface, QueryRunner } from 'typeorm';

export class ActivateBerbadosNightlifeSubscription1836000000001
  implements MigrationInterface
{
  name = 'ActivateBerbadosNightlifeSubscription1836000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Idempotent: activate the subscription for Berbados Nightlife & Lounge
    // Kubwa (berbadosnightlife@gmail.com) that remains in 'trialing' after
    // paying before the callback_url fix. Only affects trialing rows.
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
        AND s.status = 'trialing'
        AND (bu.email ILIKE 'berbadosnightlife@gmail.com'
             OR bu.name ILIKE 'Berbados%Night%'
             OR bu.name ILIKE 'Barbados%Night%')
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
        AND (bu.email ILIKE 'berbadosnightlife@gmail.com'
             OR bu.name ILIKE 'Berbados%Night%'
             OR bu.name ILIKE 'Barbados%Night%')
    `);
  }
}