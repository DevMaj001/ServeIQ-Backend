import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('stock_movements')
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  branch_id: string;

  @Index()
  @Column({ type: 'uuid' })
  ingredient_id: string;

  @Column({ type: 'varchar', length: 25, default: 'manual_adjustment' })
  type: string;

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  quantity_change: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  quantity_after: number;

  @Column({ type: 'uuid', nullable: true })
  order_id: string;

  @Column({ type: 'uuid', nullable: true })
  reference_id: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  created_at: Date;
}
