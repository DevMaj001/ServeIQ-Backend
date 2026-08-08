import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Tab } from '../tab/entities/tab.entity';
import { Bill } from '../bill/entities/bill.entity';
import { Order } from '../order/entities/order.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { User } from '../user/entities/user.entity';
import { Table, TableStatus } from '../table/entities/table.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Tab)
    private tabRepository: Repository<Tab>,
    @InjectRepository(Bill)
    private billRepository: Repository<Bill>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(MenuItem)
    private menuItemRepository: Repository<MenuItem>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Table)
    private tableRepository: Repository<Table>,
  ) {}

  async getBranchOverview(branchId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Exclude virtual (system) tables from occupancy reporting
    const totalTables = await this.tableRepository.count({
      where: { branch_id: branchId, is_virtual: false },
    });
    const occupiedTables = await this.tableRepository.count({
      where: {
        branch_id: branchId,
        status: TableStatus.OCCUPIED,
        is_virtual: false,
      },
    });
    const openTabs = await this.tabRepository.count({
      where: { branch_id: branchId, status: 'open' },
    });

    const todayBills = await this.billRepository
      .createQueryBuilder('bill')
      .innerJoin(Tab, 'tab', 'tab.id::varchar = bill.tab_id::varchar')
      .where('tab.branch_id::varchar = :branchId', { branchId })
      .andWhere('bill.paid_at >= :today', { today })
      .andWhere('bill.paid_at < :tomorrow', { tomorrow })
      .getMany();

    const dailyRevenue = todayBills.reduce((sum, b) => sum + b.total_kobo, 0);

    return {
      total_tables: totalTables,
      occupied_tables: occupiedTables,
      open_tabs: openTabs,
      today_revenue_kobo: dailyRevenue,
      today_transactions: todayBills.length,
    };
  }

  async getWaiterPerformance(branchId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const waiters = await this.userRepository.find({
      where: { branch_id: branchId },
    });
    const result = [];

    for (const waiter of waiters) {
      const closedTabs = await this.tabRepository.find({
        where: {
          branch_id: branchId,
          waiter_id: waiter.id,
          status: 'paid',
          closed_at: Between(today, tomorrow),
        },
      });

      let totalRevenue = 0;
      for (const tab of closedTabs) {
        const bill = await this.billRepository.findOne({
          where: { tab_id: tab.id },
        });
        if (bill) totalRevenue += bill.total_kobo;
      }

      const voidedTabs = await this.tabRepository.count({
        where: {
          branch_id: branchId,
          waiter_id: waiter.id,
          status: 'voided',
          closed_at: Between(today, tomorrow),
        },
      });

      result.push({
        waiter_id: waiter.id,
        waiter_name: waiter.full_name,
        tabs_closed: closedTabs.length,
        revenue_kobo: totalRevenue,
        voided_tabs: voidedTabs,
      });
    }

    return result;
  }

  async getSalesReport(branchId: string, dateFrom?: string, dateTo?: string) {
    const query = this.billRepository
      .createQueryBuilder('bill')
      .innerJoin(Tab, 'tab', 'tab.id::varchar = bill.tab_id::varchar')
      .where('tab.branch_id::varchar = :branchId', { branchId });

    if (dateFrom) {
      const from = new Date(dateFrom);
      query.andWhere('bill.paid_at >= :from', { from });
    }
    if (dateTo) {
      const to = new Date(dateTo);
      query.andWhere('bill.paid_at <= :to', { to });
    }

    const bills = await query.orderBy('bill.paid_at', 'DESC').getMany();

    const totalRevenue = bills.reduce((sum, b) => sum + b.total_kobo, 0);
    const byMethod: Record<string, number> = {};
    for (const b of bills) {
      const method = b.payment_method || 'unknown';
      byMethod[method] = (byMethod[method] || 0) + b.total_kobo;
    }

    return {
      total_revenue_kobo: totalRevenue,
      transaction_count: bills.length,
      average_bill_kobo:
        bills.length > 0 ? Math.round(totalRevenue / bills.length) : 0,
      breakdown_by_method: byMethod,
    };
  }

  async getPeakHours(branchId: string, dateFrom?: string, dateTo?: string) {
    const from = dateFrom
      ? new Date(dateFrom)
      : new Date(new Date().setHours(0, 0, 0, 0));
    const to = dateTo
      ? new Date(dateTo)
      : new Date(new Date().setHours(23, 59, 59, 999));
    if (!dateFrom) from.setHours(0, 0, 0, 0);

    const rows = await this.orderRepository
      .createQueryBuilder('o')
      .innerJoin(Tab, 'tab', 'tab.id::varchar = o.tab_id::varchar')
      .where('tab.branch_id::varchar = :branchId', { branchId })
      .andWhere('tab.status = :status', { status: 'paid' })
      .andWhere('o.created_at >= :from', { from })
      .andWhere('o.created_at <= :to', { to })
      .select('EXTRACT(HOUR FROM o.created_at)', 'hour')
      .addSelect('COUNT(o.id)', 'order_count')
      .addSelect('SUM(o.subtotal_kobo)', 'revenue_kobo')
      .groupBy('EXTRACT(HOUR FROM o.created_at)')
      .orderBy('"hour"', 'ASC')
      .getRawMany();

    const hourly: Record<
      number,
      { hour: number; order_count: number; revenue_kobo: number }
    > = {};
    for (let h = 0; h < 24; h++) {
      hourly[h] = { hour: h, order_count: 0, revenue_kobo: 0 };
    }

    for (const row of rows) {
      const h = Number(row.hour);
      if (hourly[h]) {
        hourly[h].order_count = Number(row.order_count);
        hourly[h].revenue_kobo = Number(row.revenue_kobo);
      }
    }

    return Object.values(hourly);
  }

  async getTopItems(branchId: string, dateFrom?: string, dateTo?: string) {
    const from = dateFrom
      ? new Date(dateFrom)
      : new Date(new Date().setHours(0, 0, 0, 0));
    const to = dateTo
      ? new Date(dateTo)
      : new Date(new Date().setHours(23, 59, 59, 999));

    if (!dateFrom) from.setHours(0, 0, 0, 0);

    const paidTabs = await this.tabRepository.find({
      where: {
        branch_id: branchId,
        status: 'paid',
        closed_at: Between(from, to),
      },
    });

    const tabIds = paidTabs.map((t) => t.id);
    if (tabIds.length === 0) return [];

    const orders = await this.orderRepository
      .createQueryBuilder('o')
      .where('o.tab_id IN (:...tabIds)', { tabIds })
      .getMany();

    const itemMap: Record<string, { qty: number; revenue: number }> = {};
    for (const order of orders) {
      if (!itemMap[order.menu_item_id]) {
        itemMap[order.menu_item_id] = { qty: 0, revenue: 0 };
      }
      itemMap[order.menu_item_id].qty += order.quantity;
      itemMap[order.menu_item_id].revenue += order.subtotal_kobo;
    }

    const sorted = Object.entries(itemMap)
      .map(([menu_item_id, data]) => ({ menu_item_id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20);

    const result = [];
    for (const item of sorted) {
      const menuItem = await this.menuItemRepository.findOne({
        where: { id: item.menu_item_id },
      });
      result.push({
        menu_item_id: item.menu_item_id,
        name: menuItem?.name || 'Unknown',
        category: menuItem?.category || 'Unknown',
        total_sold: item.qty,
        revenue_kobo: item.revenue,
      });
    }

    return result;
  }

  async getTableVelocity(branchId: string) {
    const rows = await this.tabRepository.query(
      `
      SELECT
        t.table_id,
        tbl.table_number,
        AVG(EXTRACT(EPOCH FROM (t.closed_at - t.opened_at)) / 60)::int AS avg_duration_minutes,
        COUNT(t.id) AS total_covers
      FROM tabs t
      INNER JOIN tables tbl ON tbl.id::varchar = t.table_id::varchar AND tbl.is_virtual = false
      WHERE t.branch_id = $1
        AND t.status = 'paid'
        AND t.opened_at IS NOT NULL
        AND t.closed_at IS NOT NULL
      GROUP BY t.table_id, tbl.table_number
      ORDER BY avg_duration_minutes ASC
    `,
      [branchId],
    );

    return rows;
  }

  async getPeakEfficiency(
    branchId: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const from = dateFrom
      ? new Date(dateFrom)
      : new Date(new Date().setHours(0, 0, 0, 0));
    const to = dateTo
      ? new Date(dateTo)
      : new Date(new Date().setHours(23, 59, 59, 999));
    if (!dateFrom) from.setHours(0, 0, 0, 0);

    const rows = await this.tabRepository.query(
      `
      SELECT
        EXTRACT(HOUR FROM t.closed_at)::int AS hour,
        COUNT(t.id) AS total_covers,
        AVG(EXTRACT(EPOCH FROM (t.closed_at - t.opened_at)) / 60)::int AS avg_duration_minutes
      FROM tabs t
      WHERE t.branch_id = $1
        AND t.status = 'paid'
        AND t.closed_at >= $2
        AND t.closed_at <= $3
        AND t.opened_at IS NOT NULL
        AND t.closed_at IS NOT NULL
      GROUP BY EXTRACT(HOUR FROM t.closed_at)
      ORDER BY hour ASC
    `,
      [branchId, from, to],
    );

    const hourly: Record<
      number,
      { hour: number; total_covers: number; avg_duration_minutes: number }
    > = {};
    for (let h = 0; h < 24; h++) {
      hourly[h] = { hour: h, total_covers: 0, avg_duration_minutes: 0 };
    }
    for (const row of rows) {
      const h = Number(row.hour);
      if (hourly[h]) {
        hourly[h].total_covers = Number(row.total_covers);
        hourly[h].avg_duration_minutes = Number(row.avg_duration_minutes);
      }
    }
    return Object.values(hourly);
  }
}
