import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  Index,
} from 'typeorm';
import { OrderStatus, FulfillmentType } from '../../../common/shared';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  tab_id: string;

  @Index()
  @Column({ type: 'uuid' })
  menu_item_id: string;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ type: 'integer' })
  unit_price_kobo: number;

  @Column({ type: 'integer' })
  subtotal_kobo: number;

  @Column({ default: 1 })
  round_number: number;

  @Column({ type: 'text', nullable: true })
  voice_transcription: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'jsonb', nullable: true })
  modifiers: { id: string; name: string; price_kobo: number; qty: number }[];

  @Column()
  created_by: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: FulfillmentType.SERVE,
  })
  fulfillment_type: string;

  @Column({
    type: 'varchar',
    length: 40,
    default: OrderStatus.PENDING_SUPERVISOR_APPROVAL,
  })
  order_status: string;

  @Column({ type: 'uuid', nullable: true })
  approved_by: string | null;

  @Column({ type: 'timestamp', nullable: true })
  approved_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  declined_by: string | null;

  @Column({ type: 'timestamp', nullable: true })
  declined_at: Date | null;

  @Column({ type: 'text', nullable: true })
  decline_reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  assigned_department: string | null;

  @Column({ type: 'integer', nullable: true })
  estimated_preparation_time_seconds: number | null;

  @Column({ type: 'timestamp', nullable: true })
  timer_started_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  timer_ends_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  actual_ready_time: Date | null;

  @Column({ type: 'uuid', nullable: true })
  delivered_by_supervisor: string | null;

  @Column({ type: 'timestamp', nullable: true })
  delivered_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  cancelled_by: string | null;

  @Column({ type: 'timestamp', nullable: true })
  cancelled_at: Date | null;

  @Column({ type: 'text', nullable: true })
  cancel_reason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  preparing_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @VersionColumn()
  version: number;
}
