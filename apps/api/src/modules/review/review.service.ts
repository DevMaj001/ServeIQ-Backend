import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThanOrEqual } from 'typeorm';
import { Review } from './entities/review.entity';
import { Branch } from '../branch/entities/branch.entity';
import { Tab } from '../tab/entities/tab.entity';
import { Order } from '../order/entities/order.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';

@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(Review)
    private reviewRepo: Repository<Review>,
    @InjectRepository(Branch)
    private branchRepo: Repository<Branch>,
    @InjectRepository(Tab)
    private tabRepo: Repository<Tab>,
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(MenuItem)
    private menuItemRepo: Repository<MenuItem>,
  ) {}

  async findAllForBusiness(
    businessId: string,
    query: {
      branchId?: string;
      rating?: string;
      minRating?: string;
      page?: string;
      limit?: string;
    },
  ) {
    const pageNum = Math.max(1, parseInt(query.page || '1', 10) || 1);
    const limitNum = Math.min(
      100,
      Math.max(1, parseInt(query.limit || '50', 10) || 50),
    );
    const skip = (pageNum - 1) * limitNum;

    const where: any = { business_id: businessId };
    if (query.branchId) where.branch_id = query.branchId;
    if (query.rating) where.rating = parseInt(query.rating, 10);
    else if (query.minRating)
      where.rating = MoreThanOrEqual(parseInt(query.minRating, 10));

    const [data, total] = await this.reviewRepo.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip,
      take: limitNum,
    });

    const reviews = await this.attachContext(data);

    const [avg] = await this.reviewRepo.query(
      `SELECT AVG(rating) AS average, COUNT(*) AS count
       FROM "reviews"
       WHERE business_id = $1`,
      [businessId],
    );

    return {
      data: reviews,
      meta: {
        total,
        average: avg ? Number(avg.average || 0) : 0,
        count: avg ? Number(avg.count || 0) : 0,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  private async attachContext(reviews: Review[]) {
    if (reviews.length === 0) return [];

    const branchIds = [...new Set(reviews.map((r) => r.branch_id).filter(Boolean))];
    const tabIds = reviews.map((r) => r.tab_id);

    const [branches, tabs, ordersArray] = await Promise.all([
      branchIds.length > 0
        ? this.branchRepo.find({ where: { id: In(branchIds) } })
        : Promise.resolve([]),
      this.tabRepo.find({ where: { id: In(tabIds) } }),
      this.orderRepo.find({ where: { tab_id: In(tabIds) } }),
    ]);

    const branchMap = new Map(branches.map((b) => [b.id, b.name]));
    const tabMap = new Map(tabs.map((t) => [t.id, t]));
    const ordersByTab = new Map<string, Order[]>();
    for (const o of ordersArray) {
      const list = ordersByTab.get(o.tab_id) || [];
      list.push(o);
      ordersByTab.set(o.tab_id, list);
    }

    const menuIds = [...new Set(ordersArray.map((o) => o.menu_item_id))];
    const menuItems =
      menuIds.length > 0
        ? await this.menuItemRepo.find({ where: { id: In(menuIds) } })
        : [];
    const menuMap = new Map(menuItems.map((m) => [m.id, m.name]));

    return reviews.map((r) => {
      const tab = tabMap.get(r.tab_id);
      const orders = ordersByTab.get(r.tab_id) || [];
      return {
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.created_at,
        branchId: r.branch_id,
        branchName: branchMap.get(r.branch_id || '') || '',
        tabId: r.tab_id,
        tabType: tab?.tab_type || '',
        items: orders.map((o) => ({
          name: menuMap.get(o.menu_item_id) || '',
          quantity: o.quantity,
        })),
      };
    });
  }
}