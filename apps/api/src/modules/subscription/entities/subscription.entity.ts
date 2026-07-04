import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { Branch } from '../../branch/entities/branch.entity';
import { Plan } from './plan.entity';

export enum SubscriptionStatus {
  TRIALING = 'trialing',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  EXPIRED = 'expired',
}

@Entity('subscriptions')
@Unique(['branch_id'])
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  branch_id: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ type: 'uuid', nullable: true })
  plan_id: string;

  @ManyToOne(() => Plan, (plan) => plan.subscriptions)
  @JoinColumn({ name: 'plan_id' })
  plan: Plan;

  @Column({ type: 'enum', enum: SubscriptionStatus, default: SubscriptionStatus.TRIALING })
  status: SubscriptionStatus;

  @Column({ type: 'timestamptz', nullable: true })
  trial_ends_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  current_period_start: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  current_period_end: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  grace_period_ends_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  canceled_at: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  paystack_subscription_code: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  paystack_customer_code: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
