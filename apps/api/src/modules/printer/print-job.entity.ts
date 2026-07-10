import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('print_jobs')
export class PrintJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  branch_id: string;

  @Column({ type: 'uuid', nullable: true })
  printer_id: string;

  @Column({ type: 'varchar', length: 30 })
  job_type: string;

  @Column({ type: 'jsonb' })
  payload: any;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string;

  @Column({ type: 'text', nullable: true })
  error_message: string;

  @Column({ type: 'int', default: 0 })
  retry_count: number;

  @CreateDateColumn()
  created_at: Date;

  @Column({ nullable: true })
  printed_at: Date;
}