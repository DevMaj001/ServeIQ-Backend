import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  VersionColumn,
} from 'typeorm';
import { Rider } from '../../riders/entities/rider.entity';
import { Business } from '../../business/entities/business.entity';
import { User } from '../../user/entities/user.entity';

export enum LedgerType {
  DELIVERY_EARNING = 'delivery_earning',
  PAYOUT = 'payout',
  ADJUSTMENT = 'adjustment',
}

export enum LedgerRefType {
  DELIVERY = 'delivery',
  MANUAL_PAYOUT = 'manual_payout',
  BATCH_PAYOUT = 'batch_payout',
}

@Entity('rider_ledger')
export class RiderLedger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  rider_id: string;

  @ManyToOne(() => Rider, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rider_id' })
  rider: Rider;

  @Index()
  @Column({ type: 'uuid' })
  business_id: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ type: 'varchar', length: 30 })
  type: LedgerType;

  @Column({ type: 'int' })
  amount_kobo: number;

  @Column({ type: 'varchar', length: 30, nullable: true })
  ref_type: LedgerRefType | null;

  @Column({ type: 'uuid', nullable: true })
  ref_id: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn()
  created_at: Date;
}

export enum PayoutBatchStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum PayoutProvider {
  PAYSTACK = 'paystack',
  FLUTTERWAVE = 'flutterwave',
  MANUAL = 'manual',
}

@Entity('payout_batches')
export class PayoutBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  business_id: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Index()
  @Column({ type: 'uuid' })
  rider_id: string;

  @ManyToOne(() => Rider, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rider_id' })
  rider: Rider;

  @Column({ type: 'varchar', length: 20 })
  provider: PayoutProvider;

  @Column({ type: 'varchar', length: 100, nullable: true })
  provider_batch_id: string | null;

  @Column({ type: 'int' })
  total_kobo: number;

  @Column({ type: 'varchar', length: 20, default: PayoutBatchStatus.PENDING })
  status: PayoutBatchStatus;

  @Column({ type: 'text', nullable: true })
  failure_reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at: Date | null;

  @VersionColumn()
  version: number;
}
