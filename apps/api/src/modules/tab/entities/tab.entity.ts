import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

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
  @Column({ type: 'uuid' })
  waiter_id: string;

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
    enum: ['open', 'billed', 'paid', 'voided'],
    default: 'open',
  })
  status: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  opened_at: Date;

  @Column({ nullable: true })
  billed_at: Date;

  @Column({ nullable: true })
  closed_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
