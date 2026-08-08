import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('platform_payment_providers')
export class PlatformPaymentProvider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ unique: true })
  name: string;

  @Column()
  label: string;

  @Column({ type: 'varchar', length: 20, default: 'manual' })
  type: 'manual' | 'webhook';

  @Column({ type: 'varchar', length: 20, nullable: true })
  verification_method: 'hmac-sha512' | 'rsa' | 'none' | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  config: Record<string, string>;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
