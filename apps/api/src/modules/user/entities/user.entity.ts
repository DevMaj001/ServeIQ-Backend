import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Business } from '../../business/entities/business.entity';
import { Branch } from '../../branch/entities/branch.entity';
import { Role } from '../../role/entities/role.entity';
import { UserRole } from '../../../common/shared';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  business_id: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Index()
  @Column({ type: 'uuid' })
  branch_id: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column()
  full_name: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  avatar_url: string;

  @Column()
  password_hash: string;

  @Column({ nullable: true })
  pin_hash: string;

  @Column({ type: 'varchar', length: 20, default: UserRole.WAITER })
  role: UserRole;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  role_id: string;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'role_id' })
  roleEntity: Role;

  @Column({ default: true })
  is_active: boolean;

  @Column({ nullable: true })
  email_verified_at: Date;

  @Column({ nullable: true })
  last_login_at: Date;

  @Column({ nullable: true })
  invited_by: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;
}
