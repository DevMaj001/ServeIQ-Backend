import { Injectable, Inject, NotFoundException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource, QueryFailedError, EntityManager } from 'typeorm';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { Tab } from '../tab/entities/tab.entity';
import { Order } from '../order/entities/order.entity';
import { StockMovementType } from '../../common/shared';

@Injectable()
export class IngredientService {
  constructor(
    @InjectRepository(MenuItem)
    private menuItemRepo: Repository<MenuItem>,
    @InjectRepository(StockMovement)
    private movementRepo: Repository<StockMovement>,
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(Tab)
    private tabRepo: Repository<Tab>,
    @Inject(DataSource)
    private dataSource: DataSource,
  ) {}

  async findAll(branchId: string) {
    const items = await this.menuItemRepo.find({
      where: { branch_id: branchId, track_stock: true },
      relations: { supplier: true },
      order: { name: 'ASC' },
    });
    return items.map(i => ({
      ...i,
      is_low_stock: Number(i.quantity_in_stock) <= Number(i.reorder_level),
    }));
  }

  async findOne(id: string, branchId: string) {
    const item = await this.menuItemRepo.findOne({
      where: { id, branch_id: branchId },
      relations: { supplier: true },
    });
    if (!item) throw new NotFoundException('Inventory item not found');
    return { ...item, is_low_stock: Number(item.quantity_in_stock) <= Number(item.reorder_level) };
  }

  async create(branchId: string, data: any) {
    const item = this.menuItemRepo.create({
      branch_id: branchId,
      name: data.name,
      category: data.category,
      price_kobo: data.price_kobo ?? 0,
      unit: data.unit ?? 'unit',
      sku: data.sku,
      barcode: data.barcode,
      image_url: data.image_url,
      is_available: data.is_available ?? true,
      created_by: data.created_by,
      quantity_in_stock: data.quantity_in_stock ?? 0,
      reorder_level: data.reorder_level ?? 0,
      cost_price_kobo: data.cost_price_kobo ?? 0,
      track_stock: data.track_stock ?? true,
      supplier_id: data.supplier_id,
    });
    return this.menuItemRepo.save(item);
  }

  async update(id: string, branchId: string, data: any) {
    const item = await this.findOne(id, branchId);
    Object.assign(item, data);
    return this.menuItemRepo.save(item);
  }

  async findUntracked(branchId: string) {
    return this.menuItemRepo.find({
      where: [
        { branch_id: branchId, track_stock: false },
        { branch_id: branchId, track_stock: null as any },
      ],
      order: { name: 'ASC' },
    });
  }

  async remove(id: string, branchId: string) {
    const item = await this.menuItemRepo.findOne({ where: { id, branch_id: branchId } });
    if (!item) throw new NotFoundException('Inventory item not found');
    return this.menuItemRepo.softRemove(item);
  }

  async restock(id: string, branchId: string, data: { added_quantity: number; cost_price_kobo?: number; barcode?: string }) {
    if (data.added_quantity <= 0) {
      throw new HttpException(
        { success: false, message: 'Added quantity must be positive', errors: {} },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const item = await this.findOne(id, branchId);
    const qty = Number(item.quantity_in_stock) + data.added_quantity;
    item.quantity_in_stock = qty;
    if (data.cost_price_kobo !== undefined) {
      item.cost_price_kobo = data.cost_price_kobo;
    }
    if (data.barcode) {
      item.barcode = data.barcode;
    }
    await this.menuItemRepo.save(item);

    const snapshotCost = data.cost_price_kobo ?? item.cost_price_kobo;

    const movement = this.movementRepo.create({
      branch_id: branchId,
      menu_item_id: id,
      type: StockMovementType.PURCHASE,
      quantity_change: data.added_quantity,
      quantity_after: qty,
      cost_at_purchase_kobo: snapshotCost,
      notes: 'Restocked',
    });
    await this.movementRepo.save(movement);

    return this.findOne(id, branchId);
  }

  async getMovements(menuItemId: string, branchId: string) {
    return this.movementRepo.find({
      where: { menu_item_id: menuItemId, branch_id: branchId },
      order: { created_at: 'DESC' },
    });
  }

  async getAlerts(branchId: string) {
    const items = await this.menuItemRepo.find({
      where: { branch_id: branchId, track_stock: true },
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

    const items = await this.menuItemRepo.find({
      where: { branch_id: branchId, track_stock: true },
      relations: { supplier: true },
    });

    const result = items.map(item => {
      const sales = orderMap[item.id] || { qty: 0, revenue: 0 };
      return {
        menu_item_id: item.id,
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
    const items = await this.menuItemRepo.find({
      where: { branch_id: branchId, track_stock: true },
      relations: { supplier: true },
    });

    const result = [];
    for (const item of items) {
      const movements = await this.movementRepo.find({
        where: { branch_id: branchId, menu_item_id: item.id },
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
        menu_item_id: item.id,
        item_name: item.name,
        unit: item.unit,
        expected_stock: expected,
        actual_stock: actual,
        variance,
        variance_percent: variancePercent,
      });
    }

    return { items: result, generated_at: new Date() };
  }

  async deductByTab(
    tab: { id: string; branch_id: string },
    orders: { menu_item_id: string; quantity: number }[],
    manager?: EntityManager,
  ) {
    const alreadyDeducted = await this.movementRepo.findOne({
      where: { reference_id: tab.id, type: StockMovementType.ORDER_CONSUMPTION },
    });
    if (alreadyDeducted) return;

    const deductionFn = async (mgr: EntityManager) => {
      const menuItemRepo = mgr.getRepository(MenuItem);
      const movementRepo = mgr.getRepository(StockMovement);

      // Phase 1: aggregate deductions per menu_item_id,
      // filtering only items with track_stock = true
      const deductionsByItem = new Map<string, { id: string; qty: number }>();
      for (const order of orders) {
        const item = await menuItemRepo.findOne({
          where: { id: order.menu_item_id, track_stock: true },
          select: { id: true },
        });
        if (!item) continue;
        const existing = deductionsByItem.get(item.id);
        if (existing) {
          existing.qty += order.quantity;
        } else {
          deductionsByItem.set(item.id, { id: item.id, qty: order.quantity });
        }
      }

      if (deductionsByItem.size === 0) return;

      // Phase 2: sort IDs to prevent deadlocks
      const sortedIds = [...deductionsByItem.keys()].sort();

      // Phase 3: lock and deduct each item in sorted order
      for (const menuItemId of sortedIds) {
        const deduction = deductionsByItem.get(menuItemId)!;
        const item = await menuItemRepo.findOne({
          where: { id: menuItemId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!item || !item.track_stock) continue;

        const oldQty = Number(item.quantity_in_stock);
        item.quantity_in_stock = oldQty - deduction.qty;
        await menuItemRepo.save(item);

        const movement = movementRepo.create({
          branch_id: tab.branch_id,
          menu_item_id: item.id,
          type: StockMovementType.ORDER_CONSUMPTION,
          quantity_change: -deduction.qty,
          quantity_after: Number(item.quantity_in_stock),
          reference_id: tab.id,
        });

        try {
          await movementRepo.save(movement);
        } catch (err) {
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

  async getAudit(branchId: string) {
    const items = await this.menuItemRepo.find({
      where: { branch_id: branchId, track_stock: true },
      relations: { supplier: true },
    });

    const result = [];
    for (const item of items) {
      const movements = await this.movementRepo.find({
        where: { branch_id: branchId, menu_item_id: item.id },
        order: { created_at: 'DESC' },
      });

      const totalRestocked = movements.filter(m => m.type === StockMovementType.PURCHASE)
        .reduce((s, m) => s + Number(m.quantity_change), 0);
      const totalSold = movements.filter(m => m.type === StockMovementType.ORDER_CONSUMPTION)
        .reduce((s, m) => s + Math.abs(Number(m.quantity_change)), 0);
      const totalWaste = movements.filter(m => m.type === StockMovementType.WASTE)
        .reduce((s, m) => s + Number(m.quantity_change), 0);
      const totalAdjustments = movements.filter(m => m.type === StockMovementType.MANUAL_ADJUSTMENT)
        .reduce((s, m) => s + Number(m.quantity_change), 0);

      const currentStock = Number(item.quantity_in_stock);

      // Derive initial_stock backwards from the ledger
      const initialStock = currentStock - totalRestocked + totalSold - totalAdjustments + Math.abs(totalWaste);

      // Book balance = what stock should be based on purchases and sales only
      // (excluding manual adjustments and waste — those are real-world events that
      // the audit is designed to catch)
      const bookBalance = initialStock + totalRestocked - totalSold;
      const actualBalance = currentStock;
      const slippage = actualBalance - bookBalance;

      const lastRestock = movements
        .filter(m => m.type === StockMovementType.PURCHASE)
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())[0];

      const hasMovements = movements.length > 0;
      let status = 'Unreviewed';
      if (hasMovements) {
        if (Math.abs(slippage) < 0.001) {
          status = 'Balanced';
        } else if (slippage < 0) {
          status = 'Shortage';
        } else {
          status = 'Surplus';
        }
      }

      result.push({
        id: item.id,
        item_name: item.name,
        initial_stock: initialStock,
        total_restocked: totalRestocked,
        total_in: totalRestocked,
        total_sold: totalSold,
        book_balance: bookBalance,
        actual_balance: actualBalance,
        slippage,
        last_restock_date: lastRestock?.created_at || null,
        status,
      });
    }

    return result;
  }

  async reconcile(branchId: string, data: { reconciliation_id: string; counts: { menu_item_id: string; physical_count: number }[] }) {
    const existingMovements = await this.movementRepo.find({
      where: { reference_id: data.reconciliation_id, type: StockMovementType.MANUAL_ADJUSTMENT },
    });
    if (existingMovements.length > 0) {
      const adjustments = existingMovements.map(m => ({
        menu_item_id: m.menu_item_id,
        delta: Number(m.quantity_change),
        movement_id: m.id,
      }));
      return { adjustments };
    }

    const adjustments = [];
    for (const count of data.counts) {
      const item = await this.menuItemRepo.findOne({
        where: { id: count.menu_item_id, branch_id: branchId },
      });
      if (!item) continue;

      const oldQty = Number(item.quantity_in_stock);
      const delta = count.physical_count - oldQty;
      if (delta === 0) continue;

      item.quantity_in_stock = count.physical_count;
      await this.menuItemRepo.save(item);

      const movement = this.movementRepo.create({
        branch_id: branchId,
        menu_item_id: count.menu_item_id,
        type: StockMovementType.MANUAL_ADJUSTMENT,
        quantity_change: delta,
        quantity_after: count.physical_count,
        reference_id: data.reconciliation_id,
        notes: `Reconciliation adjustment (physical count: ${count.physical_count})`,
      });
      const saved = await this.movementRepo.save(movement);

      adjustments.push({ menu_item_id: count.menu_item_id, delta, movement_id: saved.id });
    }

    return { adjustments };
  }

  async getDailyTally(branchId: string, date?: string) {
    const tallyDate = date ? new Date(date) : new Date();
    tallyDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(tallyDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const items = await this.menuItemRepo.find({
      where: { branch_id: branchId, track_stock: true },
    });

    const resultItems = [];
    let totalOpeningValue = 0;
    let totalRevenue = 0;
    let totalClosingValue = 0;
    let totalItemsSold = 0;
    let totalItemsRestocked = 0;
    let allBalanced = true;

    for (const item of items) {
      const todayMovements = await this.movementRepo.find({
        where: { branch_id: branchId, menu_item_id: item.id, created_at: Between(tallyDate, nextDay) },
      });

      const todayPurchases = todayMovements.filter(m => m.type === StockMovementType.PURCHASE)
        .reduce((s, m) => s + Number(m.quantity_change), 0);
      const todaySales = todayMovements.filter(m => m.type === StockMovementType.ORDER_CONSUMPTION)
        .reduce((s, m) => s + Math.abs(Number(m.quantity_change)), 0);
      const todayWaste = todayMovements.filter(m => m.type === StockMovementType.WASTE)
        .reduce((s, m) => s + Number(m.quantity_change), 0);
      const todayAdjustments = todayMovements.filter(m => m.type === StockMovementType.MANUAL_ADJUSTMENT)
        .reduce((s, m) => s + Number(m.quantity_change), 0);

      const currentStock = Number(item.quantity_in_stock);
      const openingStock = currentStock - todayPurchases + todaySales - todayWaste - todayAdjustments;

      const closingStock = currentStock;
      const restockedToday = todayPurchases;
      const soldToday = todaySales;
      const unitPrice = item.price_kobo;
      const unitCost = item.cost_price_kobo;
      const revenueToday = soldToday * unitPrice;
      const openingValue = openingStock * unitCost;
      const closingValue = closingStock * unitCost;

      const isTallyValid = Math.abs(closingStock - (openingStock + restockedToday - soldToday)) < 0.001;
      if (!isTallyValid) allBalanced = false;

      const explanation = `${item.name}: opening ${openingStock} + restocked ${restockedToday} - sold ${soldToday} = closing ${closingStock}`;

      totalOpeningValue += openingValue;
      totalRevenue += revenueToday;
      totalClosingValue += closingValue;
      totalItemsSold += soldToday;
      totalItemsRestocked += restockedToday;

      resultItems.push({
        id: item.id,
        item_name: item.name,
        opening_stock: openingStock,
        restocked_today: restockedToday,
        sold_today: soldToday,
        closing_stock: closingStock,
        revenue_today: revenueToday,
        unit_price: unitPrice,
        opening_value: openingValue,
        closing_value: closingValue,
        is_tally_valid: isTallyValid,
        explanation,
      });
    }

    return {
      summary: {
        date: tallyDate.toISOString().split('T')[0],
        summary_statement: `Daily tally for ${tallyDate.toISOString().split('T')[0]}: opened at ${totalOpeningValue} kobo, sold ${totalItemsSold} items (${totalRevenue} kobo), closed at ${totalClosingValue} kobo`,
        total_opening_value: totalOpeningValue,
        total_revenue: totalRevenue,
        total_closing_value: totalClosingValue,
        total_items_sold: totalItemsSold,
        total_items_restocked: totalItemsRestocked,
        is_all_balanced: allBalanced,
      },
      items: resultItems,
    };
  }
}
