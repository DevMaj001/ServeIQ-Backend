import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource, QueryFailedError, EntityManager } from 'typeorm';
import { Decimal } from 'decimal.js';
import { Ingredient } from './entities/ingredient.entity';
import { RecipeItem } from './entities/recipe-item.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Tab } from '../tab/entities/tab.entity';
import { Order } from '../order/entities/order.entity';
import { IngredientUnit, StockMovementType } from '../../common/shared';

const UNIT_CONVERSIONS: Record<string, { base: string; factor: number }> = {
  'kg':    { base: 'g',     factor: 1000 },
  'g':     { base: 'g',     factor: 1 },
  'l':     { base: 'ml',    factor: 1000 },
  'ml':    { base: 'ml',    factor: 1 },
  'dozen': { base: 'piece', factor: 12 },
  'piece': { base: 'piece', factor: 1 },
};

const UNIT_FAMILIES: Record<string, string> = {
  'kg': 'mass', 'g': 'mass',
  'l': 'volume', 'ml': 'volume',
  'piece': 'count', 'dozen': 'count',
  'pack': 'custom', 'crate': 'custom',
};

@Injectable()
export class IngredientService {
  constructor(
    @InjectRepository(Ingredient)
    private ingredientRepo: Repository<Ingredient>,
    @InjectRepository(RecipeItem)
    private recipeRepo: Repository<RecipeItem>,
    @InjectRepository(StockMovement)
    private movementRepo: Repository<StockMovement>,
    @InjectRepository(MenuItem)
    private menuRepo: Repository<MenuItem>,
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(Tab)
    private tabRepo: Repository<Tab>,
    @Inject(DataSource)
    private dataSource: DataSource,
  ) {}

  async findAll(branchId: string) {
    const items = await this.ingredientRepo.find({
      where: { branch_id: branchId },
      relations: { supplier: true },
      order: { name: 'ASC' },
    });
    return items.map(i => ({
      ...i,
      is_low_stock: Number(i.quantity_in_stock) <= Number(i.reorder_level),
    }));
  }

  async findOne(id: string, branchId: string) {
    const item = await this.ingredientRepo.findOne({
      where: { id, branch_id: branchId },
      relations: { supplier: true },
    });
    if (!item) throw new NotFoundException('Ingredient not found');
    return { ...item, is_low_stock: Number(item.quantity_in_stock) <= Number(item.reorder_level) };
  }

  async create(branchId: string, data: {
    name: string;
    unit: IngredientUnit;
    quantity_in_stock?: number;
    reorder_level?: number;
    conversion_to_base?: number;
    base_unit?: string;
    cost_per_unit?: number;
    menu_item_id?: string;
    supplier_id?: string;
  }) {
    if (['pack', 'crate'].includes(data.unit) && !data.conversion_to_base) {
      throw new BadRequestException('conversion_to_base is required for pack/crate units');
    }

    const item = this.ingredientRepo.create({
      branch_id: branchId,
      name: data.name,
      unit: data.unit,
      quantity_in_stock: data.quantity_in_stock ?? 0,
      reorder_level: data.reorder_level ?? 0,
      conversion_to_base: data.conversion_to_base,
      base_unit: data.base_unit,
      cost_per_unit: data.cost_per_unit ?? 0,
      menu_item_id: data.menu_item_id,
      supplier_id: data.supplier_id,
    });
    return this.ingredientRepo.save(item);
  }

  async update(id: string, branchId: string, data: any) {
    const item = await this.findOne(id, branchId);

    // Exclusivity: cannot set menu_item_id if ingredient appears in any RecipeItem
    if (data.menu_item_id !== undefined && data.menu_item_id !== null) {
      const inRecipe = await this.recipeRepo.findOne({ where: { ingredient_id: id } });
      if (inRecipe) {
        throw new BadRequestException(
          'Cannot link this ingredient to a menu item directly — it is already used in a recipe. Remove recipe references first.',
        );
      }
    }

    Object.assign(item, data);
    return this.ingredientRepo.save(item);
  }

  async remove(id: string, branchId: string) {
    const item = await this.ingredientRepo.findOne({ where: { id, branch_id: branchId } });
    if (!item) throw new NotFoundException('Ingredient not found');
    return this.ingredientRepo.remove(item);
  }

  async addStock(id: string, branchId: string, data: { quantity: number; notes?: string }) {
    if (data.quantity === 0) throw new BadRequestException('Quantity must not be zero');

    const item = await this.findOne(id, branchId);
    const qty = Number(item.quantity_in_stock) + data.quantity;
    item.quantity_in_stock = qty;
    await this.ingredientRepo.save(item);

    const movement = this.movementRepo.create({
      branch_id: branchId,
      ingredient_id: id,
      type: data.notes?.includes('waste') ? StockMovementType.WASTE
        : data.quantity > 0 ? StockMovementType.PURCHASE
        : StockMovementType.MANUAL_ADJUSTMENT,
      quantity_change: data.quantity,
      quantity_after: qty,
      notes: data.notes,
    });
    await this.movementRepo.save(movement);

    return this.findOne(id, branchId);
  }

  async getMovements(ingredientId: string, branchId: string) {
    return this.movementRepo.find({
      where: { ingredient_id: ingredientId, branch_id: branchId },
      order: { created_at: 'DESC' },
    });
  }

  async getAlerts(branchId: string) {
    const items = await this.ingredientRepo.find({
      where: { branch_id: branchId },
      relations: { supplier: true },
    });
    return items
      .filter(i => Number(i.quantity_in_stock) <= Number(i.reorder_level))
      .map(i => ({
        ...i,
        is_low_stock: true,
        deficit: Number(i.reorder_level) - Number(i.quantity_in_stock),
      }));
  }

  async getBestsellers(branchId: string, dateFrom?: string, dateTo?: string) {
    const from = dateFrom ? new Date(dateFrom) : new Date(new Date().setHours(0, 0, 0, 0));
    const to = dateTo ? new Date(dateTo) : new Date(new Date().setHours(23, 59, 59, 999));
    if (!dateFrom) from.setHours(0, 0, 0, 0);

    const paidTabs = await this.tabRepo.find({
      where: { branch_id: branchId, status: 'paid', closed_at: Between(from, to) },
    });
    const tabIds = paidTabs.map(t => t.id);

    const orderMap: Record<string, { qty: number; revenue: number }> = {};
    if (tabIds.length > 0) {
      const orders = await this.orderRepo
        .createQueryBuilder('o')
        .where('o.tab_id IN (:...tabIds)', { tabIds })
        .getMany();

      for (const order of orders) {
        if (!orderMap[order.menu_item_id]) {
          orderMap[order.menu_item_id] = { qty: 0, revenue: 0 };
        }
        orderMap[order.menu_item_id].qty += order.quantity;
        orderMap[order.menu_item_id].revenue += order.subtotal_kobo;
      }
    }

    const ingredients = await this.ingredientRepo.find({
      where: { branch_id: branchId },
      relations: { supplier: true },
    });

    const result = ingredients.map(item => {
      const sales = orderMap[item.menu_item_id || ''] || { qty: 0, revenue: 0 };
      return {
        menu_item_id: item.menu_item_id,
        ingredient_id: item.id,
        name: item.name,
        unit: item.unit,
        current_stock: Number(item.quantity_in_stock),
        total_sold: sales.qty,
        revenue_kobo: sales.revenue,
      };
    }).sort((a, b) => b.total_sold - a.total_sold);

    return {
      bestsellers: result.filter(r => r.total_sold > 0),
      slow_movers: result.filter(r => r.total_sold === 0 && r.current_stock > 0),
      out_of_stock: result.filter(r => r.current_stock === 0),
    };
  }

  async getStockVariance(branchId: string) {
    const items = await this.ingredientRepo.find({
      where: { branch_id: branchId },
      relations: { supplier: true },
    });

    const result = [];
    for (const item of items) {
      const movements = await this.movementRepo.find({
        where: { branch_id: branchId, ingredient_id: item.id },
        order: { created_at: 'DESC' },
      });

      const totalPurchased = movements.filter(m => m.type === StockMovementType.PURCHASE)
        .reduce((s, m) => s + Number(m.quantity_change), 0);
      const totalSold = movements.filter(m => m.type === StockMovementType.ORDER_CONSUMPTION)
        .reduce((s, m) => s + Math.abs(Number(m.quantity_change)), 0);
      const totalWaste = movements.filter(m => m.type === StockMovementType.WASTE)
        .reduce((s, m) => s + Number(m.quantity_change), 0);

      const expected = totalPurchased - totalSold - totalWaste;
      const actual = Number(item.quantity_in_stock);
      const variance = actual - expected;
      const variancePercent = expected !== 0 ? Math.round((variance / expected) * 100) : 0;

      result.push({
        ingredient_id: item.id,
        ingredient_name: item.name,
        unit: item.unit,
        expected_stock: expected,
        actual_stock: actual,
        variance,
        variance_percent: variancePercent,
      });
    }

    return { items: result, generated_at: new Date() };
  }

  toBaseUnit(unit: string, quantity: number, ingredient?: Ingredient): number {
    if (!UNIT_CONVERSIONS[unit]) {
      if (ingredient?.conversion_to_base && ingredient?.base_unit) {
        return quantity * Number(ingredient.conversion_to_base);
      }
      return quantity;
    }
    return quantity * UNIT_CONVERSIONS[unit].factor;
  }

  fromBaseUnit(unit: string, quantity: number, ingredient?: Ingredient): number {
    if (!UNIT_CONVERSIONS[unit]) {
      if (ingredient?.conversion_to_base && ingredient?.base_unit) {
        return quantity / Number(ingredient.conversion_to_base);
      }
      return quantity;
    }
    return quantity / UNIT_CONVERSIONS[unit].factor;
  }

  // Recipe item operations
  async getRecipe(menuItemId: string, branchId: string) {
    const menuItem = await this.menuRepo.findOne({ where: { id: menuItemId, branch_id: branchId } });
    if (!menuItem) throw new NotFoundException('Menu item not found');
    return this.recipeRepo.find({
      where: { menu_item_id: menuItemId },
      relations: { ingredient: true },
    });
  }

  async addRecipeItem(menuItemId: string, branchId: string, data: {
    ingredient_id: string;
    quantity_required: number;
    unit: string;
    waste_percent?: number;
  }) {
    const menuItem = await this.menuRepo.findOne({ where: { id: menuItemId, branch_id: branchId } });
    if (!menuItem) throw new NotFoundException('Menu item not found');

    const ingredient = await this.ingredientRepo.findOne({
      where: { id: data.ingredient_id, branch_id: branchId },
    });
    if (!ingredient) throw new NotFoundException('Ingredient not found');

    // Exclusivity: ingredient with menu_item_id (direct-link) must not appear in recipes
    if (ingredient.menu_item_id) {
      throw new BadRequestException(
        'This ingredient is directly linked to a menu item — it cannot be added to a recipe. Remove the direct link first.',
      );
    }

    // Reject references to soft-deleted ingredients
    if (ingredient.deleted_at) {
      throw new BadRequestException('Cannot add a deleted ingredient to a recipe');
    }

    // Unit family validation: recipe unit must be in same convertible family as ingredient unit
    const ingredientFamily = UNIT_FAMILIES[ingredient.unit];
    const recipeFamily = UNIT_FAMILIES[data.unit];
    if (!ingredientFamily || !recipeFamily) {
      throw new BadRequestException(`Unknown unit: ${data.unit} or ${ingredient.unit}`);
    }
    if (ingredientFamily !== recipeFamily) {
      throw new BadRequestException(
        `Unit mismatch: recipe unit "${data.unit}" (${recipeFamily}) is not compatible with ingredient unit "${ingredient.unit}" (${ingredientFamily})`,
      );
    }

    const existing = await this.recipeRepo.findOne({
      where: { menu_item_id: menuItemId, ingredient_id: data.ingredient_id },
    });
    if (existing) throw new BadRequestException('Recipe item already exists for this ingredient');

    const item = this.recipeRepo.create({
      menu_item_id: menuItemId,
      ingredient_id: data.ingredient_id,
      quantity_required: data.quantity_required,
      unit: data.unit,
      waste_percent: data.waste_percent,
    });
    return this.recipeRepo.save(item);
  }

  async updateRecipeItem(id: string, branchId: string, data: any) {
    const item = await this.recipeRepo.findOne({
      where: { id },
      relations: { ingredient: true },
    });
    if (!item || item.ingredient?.branch_id !== branchId) {
      throw new NotFoundException('Recipe item not found');
    }

    // Unit family validation if unit is being changed
    if (data.unit && data.unit !== item.unit && item.ingredient) {
      const ingredientFamily = UNIT_FAMILIES[item.ingredient.unit];
      const recipeFamily = UNIT_FAMILIES[data.unit];
      if (!ingredientFamily || !recipeFamily) {
        throw new BadRequestException(`Unknown unit: ${data.unit} or ${item.ingredient.unit}`);
      }
      if (ingredientFamily !== recipeFamily) {
        throw new BadRequestException(
          `Unit mismatch: recipe unit "${data.unit}" (${recipeFamily}) is not compatible with ingredient unit "${item.ingredient.unit}" (${ingredientFamily})`,
        );
      }
    }

    Object.assign(item, data);
    return this.recipeRepo.save(item);
  }

  async removeRecipeItem(id: string, branchId: string) {
    const item = await this.recipeRepo.findOne({
      where: { id },
      relations: { ingredient: true },
    });
    if (!item || item.ingredient?.branch_id !== branchId) {
      throw new NotFoundException('Recipe item not found');
    }
    return this.recipeRepo.remove(item);
  }

  // Stock deduction via recipe system
  //
  // All arithmetic inside the transaction uses Decimal.js to prevent floating-point
  // drift during unit conversion, subtraction, and waste-percentage multiplication.
  // TypeORM returns decimal column values as JS number; we wrap them in Decimal
  // immediately upon read and only convert back to number at the final write.
  async deductByTab(
    tab: { id: string; branch_id: string },
    orders: { menu_item_id: string; quantity: number }[],
    manager?: EntityManager,
  ) {
    // Fast-path idempotency guard (avoids unnecessary transaction attempts).
    // The DB-level partial unique index on (reference_id, ingredient_id)
    // WHERE type = 'order_consumption' is the actual correctness guarantee
    // against concurrent retries — see migration 1784000000004.
    const alreadyDeducted = await this.movementRepo.findOne({
      where: { reference_id: tab.id, type: StockMovementType.ORDER_CONSUMPTION },
    });
    if (alreadyDeducted) return;

    const deductionFn = async (mgr: EntityManager) => {
      const ingredientRepo = mgr.getRepository(Ingredient);
      const movementRepo = mgr.getRepository(StockMovement);
      const recipeRepo = mgr.getRepository(RecipeItem);

      // Phase 1: collect all deductions, grouped by ingredient_id.
      // This avoids the (reference_id, ingredient_id) unique constraint violation
      // when the same ingredient is used across multiple menu items in one tab.
      // For recipe-linked ingredients we read recipe.unit here (safe — static
      // recipe data). For direct-linked ingredients we defer unit resolution to
      // Phase 3 where the row is locked.
      interface DeductionEntry {
        id: string;
        required: Decimal;
        recipeUnit: string | null; // null = direct-link, unit resolved from locked row in Phase 3
      }
      const deductionsByIngredient = new Map<string, DeductionEntry>();

      for (const order of orders) {
        const recipeItems = await recipeRepo.find({
          where: { menu_item_id: order.menu_item_id },
          relations: { ingredient: true },
        });

        if (recipeItems.length > 0) {
          for (const recipe of recipeItems) {
            if (!recipe.ingredient || recipe.ingredient.deleted_at) continue;

            const totalRequired = new Decimal(recipe.quantity_required).times(order.quantity);
            const wasteMul = recipe.waste_percent
              ? new Decimal(1).plus(new Decimal(recipe.waste_percent).div(100))
              : new Decimal(1);
            const totalWithWaste = totalRequired.times(wasteMul);

            const existing = deductionsByIngredient.get(recipe.ingredient_id);
            if (existing) {
              existing.required = existing.required.plus(totalWithWaste);
            } else {
              deductionsByIngredient.set(recipe.ingredient_id, {
                id: recipe.ingredient_id,
                required: totalWithWaste,
                recipeUnit: recipe.unit,
              });
            }
          }
        } else {
          // Direct-link path: no recipe items, deduct ingredient by menu_item_id.
          // We only check existence here; the lock and unit resolution happen in Phase 3.
          const directExists = await ingredientRepo.findOne({
            where: { branch_id: tab.branch_id, menu_item_id: order.menu_item_id },
            select: { id: true },
          });
          if (directExists) {
            const existing = deductionsByIngredient.get(directExists.id);
            if (existing) {
              existing.required = existing.required.plus(new Decimal(order.quantity));
            } else {
              deductionsByIngredient.set(directExists.id, {
                id: directExists.id,
                required: new Decimal(order.quantity),
                recipeUnit: null, // resolved from locked row in Phase 3
              });
            }
          }
        }
      }

      if (deductionsByIngredient.size === 0) return;

      // Phase 2: sort ingredient IDs to prevent deadlocks from inconsistent lock ordering
      const sortedIds = [...deductionsByIngredient.keys()].sort();

      // Phase 3: lock and process each ingredient in sorted order
      for (const ingredientId of sortedIds) {
        const deduction = deductionsByIngredient.get(ingredientId)!;

        const ing = await ingredientRepo.findOne({
          where: { id: ingredientId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!ing || ing.deleted_at) continue;

        // Resolve unit: for recipe-linked items use recipe.unit from Phase 1;
        // for direct-linked items use the ingredient's own unit (identity conversion).
        const unitForConversion = deduction.recipeUnit ?? ing.unit;

        // All arithmetic in Decimal space to prevent floating-point drift
        const requiredInBase = this.decimalToBaseUnit(unitForConversion, deduction.required, ing);
        const stockInBase = this.decimalToBaseUnit(ing.unit, new Decimal(ing.quantity_in_stock), ing);
        const newStockInBase = stockInBase.minus(requiredInBase);
        const newStock = this.decimalFromBaseUnit(ing.unit, newStockInBase, ing);

        ing.quantity_in_stock = newStock.toNumber();
        await ingredientRepo.save(ing);

        const movementEntry = movementRepo.create({
          branch_id: tab.branch_id,
          ingredient_id: ing.id,
          type: StockMovementType.ORDER_CONSUMPTION,
          quantity_change: deduction.required.negated().toNumber(),
          quantity_after: newStock.toNumber(),
          reference_id: tab.id,
        });

        try {
          await movementRepo.save(movementEntry);
        } catch (err) {
          // The partial unique index on (reference_id, ingredient_id)
          // WHERE type = 'order_consumption' catches concurrent duplicates.
          // If this is a duplicate violation, treat as no-op — the tab was
          // already deducted by a concurrent call that won the race.
          if (err instanceof QueryFailedError && (err as any).code === '23505') {
            continue;
          }
          throw err;
        }
      }
    };

    if (manager) {
      await deductionFn(manager);
    } else {
      await this.dataSource.transaction(deductionFn);
    }
  }

  // Decimal-aware unit conversion helpers (for deduction chain only; the existing
  // toBaseUnit / fromBaseUnit using number remain for reporting code paths).

  private decimalToBaseUnit(unit: string, quantity: Decimal, ingredient?: Ingredient): Decimal {
    const conv = UNIT_CONVERSIONS[unit];
    if (conv) {
      return quantity.times(conv.factor);
    }
    if (ingredient?.conversion_to_base && ingredient?.base_unit) {
      return quantity.times(new Decimal(ingredient.conversion_to_base));
    }
    return quantity;
  }

  private decimalFromBaseUnit(unit: string, quantity: Decimal, ingredient?: Ingredient): Decimal {
    const conv = UNIT_CONVERSIONS[unit];
    if (conv) {
      return quantity.div(conv.factor);
    }
    if (ingredient?.conversion_to_base && ingredient?.base_unit) {
      return quantity.div(new Decimal(ingredient.conversion_to_base));
    }
    return quantity;
  }
}
