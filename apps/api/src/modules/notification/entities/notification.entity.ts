import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum NotificationType {
  LOW_STOCK = 'low_stock',
  TAB_LONG_OPEN = 'tab_long_open',
  BILL_VOIDED = 'bill_voided',
  STOCK_REORDER = 'stock_reorder',
  SUBSCRIPTION_EXPIRING = 'subscription_expiring',
  ORDER_READY = 'order_ready',
  ORDER_APPROVED = 'order_approved',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  branch_id: string;

  /**
   * Recipient user. NULL = branch-wide broadcast visible to all staff;
   * set = targeted at a specific user (e.g. the serving waiter).
   */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @Column({ type: 'varchar', length: 30 })
  type: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  data: any;

  @Column({ type: 'boolean', default: false })
  is_read: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
