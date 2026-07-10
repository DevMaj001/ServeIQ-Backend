import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('bills')
export class Bill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  tab_id: string;

  @Column({ type: 'integer' })
  subtotal_kobo: number;

  @Column({ type: 'integer', default: 0 })
  service_charge_kobo: number;

  @Column({ type: 'integer', default: 0 })
  discount_kobo: number;

  @Column({ type: 'integer', default: 0 })
  tax_kobo: number;

  @Column({ type: 'integer' })
  total_kobo: number;

  @Column({ type: 'varchar', nullable: true, unique: true })
  idempotency_key: string;

  @Column({ type: 'integer', nullable: true })
  payment_amount_kobo: number;

  @Column({
    type: 'enum',
    enum: ['cash', 'transfer', 'pos', 'card'],
    nullable: true,
  })
  payment_method: string;

  @Column({ nullable: true })
  payment_reference: string;

  @Column({ type: 'uuid', nullable: true })
  terminal_id: string;

  @Column({ nullable: true })
  paid_at: Date;

  @Column()
  issued_by: string;

  @Column({ nullable: true })
  receipt_url: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
