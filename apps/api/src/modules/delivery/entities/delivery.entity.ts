import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { DeliveryStatus } from '../../../common/shared';

@Entity('deliveries')
export class Delivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  tab_id: string | null;

  // Group tracking code for standalone (tabless) online dispatch orders.
  @Index()
  @Column({ type: 'varchar', length: 12, nullable: true })
  tracking_code: string | null;

  @Index()
  @Column({ type: 'uuid' })
  branch_id: string;

  @Index()
  @Column({ type: 'varchar', length: 20, default: DeliveryStatus.PENDING })
  status: string;

  @Column({ type: 'uuid', nullable: true })
  rider_id: string | null;

  @Column({ type: 'integer', default: 0 })
  fee_kobo: number;

  @Column({ type: 'integer', default: 0 })
  payout_kobo: number;

  @Column({ type: 'timestamp', nullable: true })
  accepted_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  delivered_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  cancelled_at: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  payout_status: string;

  @Column({ type: 'timestamp', nullable: true })
  paid_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @VersionColumn()
  version: number;

  @DeleteDateColumn()
  deleted_at: Date;
}
