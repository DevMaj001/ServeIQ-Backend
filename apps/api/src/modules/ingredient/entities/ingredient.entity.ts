import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Supplier } from '../../supplier/entities/supplier.entity';

@Entity('ingredients')
export class Ingredient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  branch_id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 10 })
  unit: string;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  quantity_in_stock: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  reorder_level: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true })
  conversion_to_base: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  base_unit: string;

  // Priced per this ingredient's stored unit (e.g., unit='kg' → cost_per_unit=500 means
  // 500 kobo per kg). If the unit field is changed after creation, cost_per_unit's meaning
  // silently shifts — the service layer does NOT currently block unit changes when
  // cost_per_unit is non-zero, nor does it auto-recompute.
  @Column({ type: 'integer', default: 0 })
  cost_per_unit: number;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  menu_item_id: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  supplier_id: string;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;
}
