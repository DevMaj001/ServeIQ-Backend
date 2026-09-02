import { MigrationInterface, QueryRunner, In } from 'typeorm';
import { ShiftTemplate } from '../../modules/shift/entities/shift-template.entity';
import { Business } from '../../modules/business/entities/business.entity';
import { Branch } from '../../modules/branch/entities/branch.entity';

export class SeedDefaultShiftTemplates1820000000000
  implements MigrationInterface
{
  name = 'SeedDefaultShiftTemplates1820000000000';

  private readonly defaults = [
    {
      name: 'Morning Shift',
      type: 'morning',
      scheduled_start_time: '07:00',
      scheduled_end_time: '15:00',
      days_of_week: [1, 2, 3, 4, 5],
      color: '#22c55e',
    },
    {
      name: 'Evening Shift',
      type: 'evening',
      scheduled_start_time: '15:00',
      scheduled_end_time: '23:00',
      days_of_week: [1, 2, 3, 4, 5],
      color: '#f59e0b',
    },
    {
      name: 'Night Shift',
      type: 'night',
      scheduled_start_time: '23:00',
      scheduled_end_time: '07:00',
      days_of_week: [0, 6],
      color: '#6366f1',
    },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure discount_min_order_amount exists before Business entity is queried
    // (added in 181950/183400 but may not have run yet due to migration ordering)
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "discount_min_order_amount" integer NOT NULL DEFAULT 0`,
    );

    const businessRepo = queryRunner.manager.getRepository(Business);
    const branchRepo = queryRunner.manager.getRepository(Branch);
    const templateRepo = queryRunner.manager.getRepository(ShiftTemplate);

    const businesses = await businessRepo.find();
    for (const business of businesses) {
      const existing = await templateRepo.count({
        where: { business_id: business.id },
      });
      if (existing > 0) continue;

      const branch = await branchRepo.findOne({
        where: { business_id: business.id, is_active: true },
        order: { created_at: 'ASC' },
      });
      if (!branch) continue;

      for (const t of this.defaults) {
        await templateRepo.save(
          templateRepo.create({
            business_id: business.id,
            branch_id: branch.id,
            name: t.name,
            type: t.type,
            scheduled_start_time: t.scheduled_start_time,
            scheduled_end_time: t.scheduled_end_time,
            days_of_week: t.days_of_week,
            color: t.color,
            is_active: true,
          }),
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const templateRepo = queryRunner.manager.getRepository(ShiftTemplate);
    const names = this.defaults.map((d) => d.name);
    await templateRepo.delete({ name: In(names) });
  }
}
