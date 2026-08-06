import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToMany,
} from 'typeorm';
import { MenuItem } from '../menu/entities/menu-item.entity';

@Entity('modifier_groups')
export class ModifierGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  branch_id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'int', default: 0 })
  min_select: number;

  @Column({ type: 'int', default: 99 })
  max_select: number;

  @Column({ default: false })
  required: boolean;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @ManyToMany(() => MenuItem, (menuItem) => menuItem.modifierGroups)
  menu_items: MenuItem[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
