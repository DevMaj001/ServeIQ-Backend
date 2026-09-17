import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  business_id: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  branch_id?: string | null;

  @Column({ type: 'uuid' })
  tab_id: string | null;

  @Index()
  @Column({ type: 'varchar', length: 12, nullable: true })
  tracking_code: string | null;

  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}