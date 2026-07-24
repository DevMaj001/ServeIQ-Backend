import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('pos_terminals')
export class PosTerminal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  label: string;

  @Index()
  @Column({ type: 'uuid' })
  branch_id: string;

  @Column({ default: true })
  is_active: boolean;

  @Column({ nullable: true })
  account_number: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
