import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Supplier } from '../../supplier/entities/supplier.entity';

@Entity('menu_items')
export class MenuItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  branch_id: string;

  @Column()
  name: string;

  @Column()
  category: string;

  @Column({ type: 'integer' })
  price_kobo: number;

  @Column({ default: 'unit' })
  unit: string;

  @Column({ nullable: true })
  sku: string;

  @Column({ nullable: true })
  barcode: string;

  @Column({ nullable: true })
  image_url: string;

  @Column({ default: true })
  is_available: boolean;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  quantity_in_stock: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  reorder_level: number;

  @Column({ type: 'integer', nullable: true })
  cost_price_kobo: number;

  @Column({ default: true })
  track_stock: boolean;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  supplier_id: string;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column()
  created_by: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;
}
