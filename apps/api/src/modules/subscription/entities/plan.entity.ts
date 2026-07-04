import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { Subscription } from './subscription.entity';

export enum BillingInterval {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  name: string;

  @Column({ type: 'integer' })
  price: number;

  @Column({ length: 3, default: 'NGN' })
  currency: string;

  @Column({ type: 'enum', enum: BillingInterval })
  billing_interval: BillingInterval;

  @Column({ type: 'jsonb', nullable: true })
  features: Record<string, any>;

  @Column({ default: true })
  is_active: boolean;

  @Column({ length: 100, nullable: true })
  paystack_plan_code: string;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => Subscription, (subscription) => subscription.plan)
  subscriptions: Subscription[];
}
