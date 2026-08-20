import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('devices')
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id: string;

  @Index()
  @Column({ type: 'uuid' })
  business_id: string;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Index()
  @Column({ type: 'varchar', length: 255 })
  device_id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  device_name: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  platform: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  app_version: string | null;

  @Column({ type: 'timestamp', nullable: true })
  last_seen_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  revoked_at: Date | null;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}