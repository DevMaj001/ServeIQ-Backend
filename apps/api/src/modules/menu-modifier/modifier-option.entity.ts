import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { ModifierGroup } from './modifier-group.entity';

@Entity('modifier_options')
export class ModifierOption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  modifier_group_id: string;

  @ManyToOne(() => ModifierGroup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'modifier_group_id' })
  group: ModifierGroup;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'integer', default: 0 })
  price_kobo: number;

  @Column({ type: 'int', default: 1 })
  max_qty: number;

  @Column({ type: 'boolean', default: false })
  track_stock: boolean;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  quantity_in_stock: number;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @Column({ default: true })
  is_available: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}