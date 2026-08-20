import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id: string;

  @Column()
  token_hash: string;

  @Column()
  expires_at: Date;

  @Column({ default: false })
  is_revoked: boolean;

  @Index()
  @Column({ type: 'varchar', length: 128, nullable: true })
  device_fingerprint: string | null;

  @CreateDateColumn()
  created_at: Date;
}
