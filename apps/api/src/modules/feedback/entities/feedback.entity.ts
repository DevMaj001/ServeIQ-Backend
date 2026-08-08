import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum FeedbackStatus {
  OPEN = 'open',
  IN_REVIEW = 'in_review',
  RESOLVED = 'resolved',
}

@Entity('feedback')
export class Feedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  business_id: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  branch_id?: string | null;

  @Column({ type: 'uuid', nullable: true })
  user_id?: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 20 })
  category: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'text', nullable: true })
  screenshot?: string | null;

  @Column({ type: 'text', nullable: true })
  url?: string | null;

  @Column({ type: 'text', nullable: true })
  user_agent?: string | null;

  @Column({ type: 'varchar', length: 20, default: FeedbackStatus.OPEN })
  status: string;

  @Column({ type: 'text', nullable: true })
  admin_notes: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
