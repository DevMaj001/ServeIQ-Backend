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

  /**
   * Moniepoint terminal serial (e.g. "P260xyz"), sourced from the Moniepoint
   * dashboard / device. Required for ERP push payments (the /v1/transactions
   * `terminalSerial` field). Null for terminals that were never enrolled for
   * ERP pushes.
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  serial_number: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
