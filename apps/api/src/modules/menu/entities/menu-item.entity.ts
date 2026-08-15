import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  ManyToOne,
  ManyToMany,
  JoinColumn,
  JoinTable,
} from 'typeorm';
import { Supplier } from '../../supplier/entities/supplier.entity';
import { ModifierGroup } from '../../menu-modifier/modifier-group.entity';

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

  @Column({ type: 'varchar', length: 20, default: 'cook' })
  prep_type: string;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  quantity_in_stock: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  reorder_level: number;

  @Column({ type: 'integer', nullable: true })
  cost_price_kobo: number;

  @Column({ default: true })
  track_stock: boolean;

  @ManyToMany(() => ModifierGroup, (mg) => mg.menu_items)
  @JoinTable({
    name: 'menu_item_modifier_groups',
    joinColumn: { name: 'menu_item_id', referencedColumnName: 'id' },
    inverseJoinColumn: {
      name: 'modifier_group_id',
      referencedColumnName: 'id',
    },
  })
  modifierGroups: ModifierGroup[];

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
