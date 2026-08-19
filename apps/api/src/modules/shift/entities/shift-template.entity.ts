import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('shift_templates')
export class ShiftTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  branch_id: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', length: 20, default: 'custom' })
  type: string;

  @Column({ type: 'varchar', length: 5 })
  scheduled_start_time: string;

  @Column({ type: 'varchar', length: 5 })
  scheduled_end_time: string;

  @Column({ type: 'jsonb', default: '[]' })
  days_of_week: number[];

  @Column({ type: 'varchar', length: 9, default: '#22c55e' })
  color: string;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}