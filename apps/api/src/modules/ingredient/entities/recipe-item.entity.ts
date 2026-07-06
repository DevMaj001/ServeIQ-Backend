import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Ingredient } from './ingredient.entity';

@Entity('recipe_items')
@Index(['menu_item_id', 'ingredient_id'], { unique: true })
// Note: RecipeItem does NOT soft-delete. Hard-delete is intentional because recipe
// composition is historical data. When its referenced Ingredient is soft-deleted,
// the RecipeItem row persists — the deduction path filters out deleted ingredients
// at runtime (ingredient.service.ts deductByTab). Re-creating a removed recipe item
// for the same (menu_item_id, ingredient_id) pair works because the row is gone.
export class RecipeItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  menu_item_id: string;

  @Index()
  @Column({ type: 'uuid' })
  ingredient_id: string;

  @ManyToOne(() => Ingredient)
  @JoinColumn({ name: 'ingredient_id' })
  ingredient: Ingredient;

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  quantity_required: number;

  @Column({ type: 'varchar', length: 10 })
  unit: string;

  @Column({ type: 'integer', nullable: true })
  waste_percent: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
