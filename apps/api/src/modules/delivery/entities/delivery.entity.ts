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
  @Column({ type: 'uuid' })
  tab_id: string;

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

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @VersionColumn()
  version: number;

  @DeleteDateColumn()
  deleted_at: Date;
}
