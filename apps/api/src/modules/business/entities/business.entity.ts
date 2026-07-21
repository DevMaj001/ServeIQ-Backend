import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { Branch } from '../../branch/entities/branch.entity';

@Entity('businesses')
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ unique: true, length: 12, nullable: true })
  business_code: string;

  @Column({ type: 'enum', enum: ['bar', 'lounge', 'restaurant', 'club', 'cafe'] })
  type: string;

  @Column({ nullable: true })
  owner_id: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  address: string;

  @Column({ default: 'NGN' })
  currency: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 7.5 })
  tax_rate: number;

  @Column({ default: 'Africa/Lagos' })
  timezone: string;

  @Column({ default: 'free_trial' })
  subscription_plan: string;

  @Column({ nullable: true })
  logo_url: string;

  @Column({ nullable: true })
  cac_document_url: string;

  @Column({ nullable: true })
  brand_primary_color: string;

  @Column({ nullable: true })
  brand_accent_color: string;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;

  @OneToMany(() => Branch, (branch) => branch.business)
  branches: Branch[];
}
