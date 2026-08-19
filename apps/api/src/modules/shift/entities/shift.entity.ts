import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('shifts')
export class Shift {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  branch_id: string;

  @Column({ type: 'uuid' })
  opened_by: string;

  @Column({ type: 'uuid', nullable: true })
  closed_by: string;

  @Column({ type: 'uuid', nullable: true })
  template_id: string | null;

  @Column({ type: 'varchar', length: 5, nullable: true })
  scheduled_start_time: string;

  @Column({ type: 'varchar', length: 5, nullable: true })
  scheduled_end_time: string;

  @Column({ type: 'varchar', length: 20, default: 'custom' })
  shift_type: string;

  @Column({ type: 'uuid', array: true, default: '{}' })
  assigned_staff_ids: string[];

  @Column({ type: 'integer', default: 0 })
  starting_cash_kobo: number;

  @Column({ type: 'integer', nullable: true })
  expected_cash_kobo: number;

  @Column({ type: 'integer', nullable: true })
  actual_cash_kobo: number;

  @Column({ type: 'integer', nullable: true })
  variance_kobo: number;

  @Column({ nullable: true })
  opened_at: Date;

  @Column({ nullable: true })
  closed_at: Date;

  @Column({ default: 'open' })
  status: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
