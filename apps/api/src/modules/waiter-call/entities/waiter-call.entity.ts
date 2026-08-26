import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Branch } from '../../branch/entities/branch.entity';
import { Table } from '../../table/entities/table.entity';
import { User } from '../../user/entities/user.entity';

export enum WaiterCallStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  ARRIVED = 'arrived',
  RESOLVED = 'resolved',
  CANCELLED = 'cancelled',
  QUEUED = 'queued',
}

@Entity('waiter_calls')
@Index(['branch_id', 'status'])
@Index(['branch_id', 'assigned_waiter_id', 'status'])
@Index(['table_id', 'status'])
export class WaiterCall {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  branch_id: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Index()
  @Column({ type: 'uuid' })
  table_id: string;

  @ManyToOne(() => Table)
  @JoinColumn({ name: 'table_id' })
  table: Table;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  assigned_waiter_id: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_waiter_id' })
  assignedWaiter: User | null;

  @Column({ type: 'varchar', nullable: true })
  customer_session_id: string | null;

  @Column({
    type: 'enum',
    enum: WaiterCallStatus,
    default: WaiterCallStatus.PENDING,
  })
  status: WaiterCallStatus;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  accepted_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  arrived_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  resolved_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  cancelled_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;
}