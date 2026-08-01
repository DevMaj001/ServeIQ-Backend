import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { TabType } from '../../../common/shared';

@Entity('tabs')
export class Tab {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  branch_id: string;

  @Index()
  @Column({ type: 'uuid' })
  table_id: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  waiter_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  shift_id: string;

  @Column({ nullable: true })
  cashier_id: string;

  @Column({ unique: true })
  tab_number: string;

  @Column({ nullable: true })
  customer_name: string;

  @Column({ default: 1 })
  party_size: number;

  @Column({
    type: 'enum',
    enum: TabType,
    default: TabType.DINE_IN,
  })
  tab_type: TabType;

  @Column({
    type: 'enum',
    enum: ['open', 'billed', 'paid', 'voided'],
    default: 'open',
  })
  status: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 12, nullable: true })
  tracking_code: string | null;

  @Column({ type: 'timestamp', nullable: true })
  tracking_generated_at: Date | null;

  @CreateDateColumn()
  opened_at: Date;

  @Column({ nullable: true })
  billed_at: Date;

  @Column({ nullable: true })
  closed_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
