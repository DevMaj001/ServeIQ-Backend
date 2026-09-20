import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  VersionColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Branch } from '../../branch/entities/branch.entity';
import { Business } from '../../business/entities/business.entity';
import { Table } from '../../table/entities/table.entity';
import { User } from '../../user/entities/user.entity';

export enum ReservationStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  SEATED = 'seated',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

export enum ReservationSource {
  PUBLIC = 'public',
  WALKIN = 'walkin',
  PHONE = 'phone',
  ADMIN = 'admin',
}

@Entity('reservations')
@Index(['branch_id', 'reservation_time'])
@Index(['table_id', 'reservation_time'])
@Index(['status'])
@Index(['confirmation_code'], { unique: true })
@Index(['customer_phone'])
export class Reservation {
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
  branch_id: string;

  @ManyToOne(() => Branch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ type: 'uuid', nullable: true })
  table_id: string | null;

  @ManyToOne(() => Table, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'table_id' })
  table: Table;

  @Column({ type: 'varchar', length: 200 })
  customer_name: string;

  @Column({ type: 'varchar', length: 50 })
  customer_phone: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  customer_email: string | null;

  @Column({ type: 'int' })
  party_size: number;

  @Column({ type: 'timestamptz' })
  reservation_time: Date;

  @Column({ type: 'int', default: 90 })
  duration_minutes: number;

  @Column({ type: 'varchar', length: 20, default: ReservationStatus.PENDING })
  status: ReservationStatus;

  @Column({ type: 'text', nullable: true })
  special_requests: string | null;

  @Column({ type: 'varchar', length: 20, default: ReservationSource.PUBLIC })
  source: ReservationSource;

  @Column({ type: 'varchar', length: 12, unique: true })
  confirmation_code: string;

  @Column({ type: 'timestamptz', nullable: true })
  reminded_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  seated_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelled_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  cancelled_by: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'cancelled_by' })
  cancelledBy: User;

  @Column({ type: 'text', nullable: true })
  cancellation_reason: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @VersionColumn()
  version: number;

  @DeleteDateColumn()
  deleted_at: Date | null;

  // Computed properties (not persisted)
  get end_time(): Date {
    return new Date(
      this.reservation_time.getTime() + this.duration_minutes * 60 * 1000,
    );
  }

  get is_active(): boolean {
    return !['cancelled', 'completed', 'no_show'].includes(this.status);
  }

  get is_upcoming(): boolean {
    return this.reservation_time > new Date();
  }
}
