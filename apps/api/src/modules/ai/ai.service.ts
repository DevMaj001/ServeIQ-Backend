import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual } from 'typeorm';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { StockMovement } from '../ingredient/entities/stock-movement.entity';
import { Bill } from '../bill/entities/bill.entity';
import { Order } from '../order/entities/order.entity';
import { Tab } from '../tab/entities/tab.entity';
import { User } from '../user/entities/user.entity';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai: any = null;
  private initPromise: Promise<void> | null = null;

  constructor(
    private configService: ConfigService,
    @InjectRepository(MenuItem)
    private menuItemRepo: Repository<MenuItem>,
    @InjectRepository(StockMovement)
    private movementRepo: Repository<StockMovement>,
    @InjectRepository(Bill)
    private billRepo: Repository<Bill>,
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(Tab)
    private tabRepo: Repository<Tab>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  private async getClient(): Promise<any> {
    if (!this.openai) {
      if (!this.initPromise) {
        this.initPromise = this.initialize();
      }
      await this.initPromise;
    }
    return this.openai;
  }

  private async initialize(): Promise<void> {
    const apiKey = this.configService.get<string>('NEMOTRON_API_KEY');
    const baseURL = this.configService.get<string>('NEMOTRON_BASE_URL');

    if (apiKey) {
      try {
        const { default: OpenAI } = await import('openai');
        this.openai = new OpenAI({ apiKey, baseURL });
      } catch (err) {
        this.logger.error('Failed to initialize OpenAI client', err);
      }
    } else {
      this.logger.warn('NEMOTRON_API_KEY not set, AI features disabled');
    }
  }

  async generateLogic(prompt: string): Promise<string> {
    const client = await this.getClient();
    if (!client) {
      throw new Error(
        'AI service unavailable: NEMOTRON_API_KEY not configured',
      );
    }

    this.logger.log('Generating logic with Nemotron');

    const systemPrompt = `You are an expert business logic generator for a hospitality POS system called ServeIQ.
Your task is to generate perfect, production-ready business logic.
Always provide:
1. A clear explanation of the logic
2. Pros and cons of the approach
3. Any considerations for implementation
4. Code examples if relevant
Keep responses structured and professional.`;

    const response = await client.chat.completions.create({
      model: this.configService.get<string>(
        'NEMOTRON_MODEL',
        'meta/llama-3.1-70b-instruct',
      ),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2048,
    });

    return response.choices[0].message.content || '';
  }

  async analyzeApiProsCons(): Promise<string> {
    const client = await this.getClient();
    if (!client) {
      throw new Error(
        'AI service unavailable: NEMOTRON_API_KEY not configured',
      );
    }

    this.logger.log('Analyzing API pros and cons with Nemotron');

    const systemPrompt = `You are an expert API analyst. Analyze the ServeIQ hospitality POS API and provide:
1. Key strengths (pros)
2. Areas for improvement (cons)
3. Security considerations
4. Performance insights
5. Recommendations for both admin and waiter app integrations
Be thorough but concise.`;

    const apiDescription = `ServeIQ API is a hospitality POS system with these main modules:
- Auth: User authentication (JWT)
- Business & Branch management
- Menu management
- Table management
- Tab/order management
- Billing & payment processing
- Dashboard analytics

Endpoints are RESTful, use NestJS, TypeORM, and PostgreSQL.
It serves two apps: Admin (web) and Waiter (mobile/tablet).`;

    const response = await client.chat.completions.create({
      model: this.configService.get<string>(
        'NEMOTRON_MODEL',
        'meta/llama-3.1-70b-instruct',
      ),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: apiDescription },
      ],
      temperature: 0.5,
      max_tokens: 2048,
    });

    return response.choices[0].message.content || '';
  }

  async getSalesReport(
    branchId: string,
    question: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<string> {
    const client = await this.getClient();
    if (!client) {
      throw new Error(
        'AI service unavailable: NEMOTRON_API_KEY not configured',
      );
    }

    const from = dateFrom
      ? new Date(dateFrom)
      : new Date(new Date().setHours(0, 0, 0, 0));
    const to = dateTo
      ? new Date(dateTo)
      : new Date(new Date().setHours(23, 59, 59, 999));

    const bills = await this.billRepo
      .createQueryBuilder('bill')
      .innerJoin(Tab, 'tab', 'tab.id::varchar = bill.tab_id::varchar')
      .where('tab.branch_id::varchar = :branchId', { branchId })
      .andWhere('bill.paid_at >= :from', { from })
      .andWhere('bill.paid_at <= :to', { to })
      .orderBy('bill.paid_at', 'DESC')
      .getMany();

    const totalRevenue = bills.reduce((sum, b) => sum + b.total_kobo, 0);
    const byMethod: Record<string, number> = {};
    for (const b of bills) {
      const method = b.payment_method || 'unknown';
      byMethod[method] = (byMethod[method] || 0) + b.total_kobo;
    }

    const paidTabs = await this.tabRepo.find({
      where: {
        branch_id: branchId,
        status: 'paid',
        closed_at: Between(from, to),
      },
    });
    const tabIds = paidTabs.map((t) => t.id);

    const topItems: any[] = [];
    if (tabIds.length > 0) {
      const orders = await this.orderRepo
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
        .slice(0, 10);

      for (const item of sorted) {
        const menuItem = await this.menuItemRepo.findOne({
          where: { id: item.menu_item_id },
        });
        topItems.push({
          name: menuItem?.name || 'Unknown',
          category: menuItem?.category || 'Unknown',
          total_sold: item.qty,
          revenue_kobo: item.revenue,
        });
      }
    }

    const dataContext = JSON.stringify(
      {
        period: { from, to },
        revenue: {
          total_kobo: totalRevenue,
          transaction_count: bills.length,
          average_bill_kobo:
            bills.length > 0 ? Math.round(totalRevenue / bills.length) : 0,
        },
        payment_methods: byMethod,
        top_selling_items: topItems,
      },
      null,
      2,
    );

    this.logger.log('Generating sales report analysis');

    const response = await client.chat.completions.create({
      model: this.configService.get<string>(
        'NEMOTRON_MODEL',
        'meta/llama-3.1-70b-instruct',
      ),
      messages: [
        {
          role: 'system',
          content:
            "You are a restaurant operations analyst. Answer the user's question using ONLY the provided data. Be concise, specific, and actionable. Use kobo amounts — convert to naira for readability (e.g. 15000 kobo = ₦150). If the data doesn't contain enough info to answer fully, say so and summarize what you can.",
        },
        {
          role: 'user',
          content: `Here is the sales data for this branch:\n${dataContext}\n\nQuestion: ${question}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    });

    return response.choices[0].message.content || '';
  }

  async getWastageInsights(branchId: string): Promise<string> {
    const client = await this.getClient();
    if (!client) {
      throw new Error(
        'AI service unavailable: NEMOTRON_API_KEY not configured',
      );
    }

    const trackedItems = await this.menuItemRepo.find({
      where: { branch_id: branchId, track_stock: true },
      order: { name: 'ASC' },
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const adjustments = await this.movementRepo.find({
      where: {
        branch_id: branchId,
        type: 'manual_adjustment',
        quantity_change: LessThanOrEqual(0),
        created_at: Between(thirtyDaysAgo, new Date()),
      },
      order: { created_at: 'DESC' },
    });

    const wastageByItem: Record<
      string,
      {
        name: string;
        total_lost: number;
        entries: number;
        estimated_cost_kobo: number;
      }
    > = {};
    for (const adj of adjustments) {
      const item = trackedItems.find((i) => i.id === adj.menu_item_id);
      if (!item) continue;
      if (!wastageByItem[adj.menu_item_id]) {
        wastageByItem[adj.menu_item_id] = {
          name: item.name,
          total_lost: 0,
          entries: 0,
          estimated_cost_kobo: 0,
        };
      }
      wastageByItem[adj.menu_item_id].total_lost += Number(adj.quantity_change);
      wastageByItem[adj.menu_item_id].entries += 1;
      if (item.cost_price_kobo) {
        wastageByItem[adj.menu_item_id].estimated_cost_kobo +=
          Math.abs(Number(adj.quantity_change)) * item.cost_price_kobo;
      }
    }

    const lowStockItems = trackedItems
      .filter((i) => Number(i.quantity_in_stock) <= Number(i.reorder_level))
      .map((i) => ({
        name: i.name,
        stock: Number(i.quantity_in_stock),
        reorder_level: Number(i.reorder_level),
        cost_price_kobo: i.cost_price_kobo,
      }));

    const dataContext = JSON.stringify(
      {
        tracked_item_count: trackedItems.length,
        wastage_adjustments_last_30_days: Object.values(wastageByItem).sort(
          (a: any, b: any) => b.total_lost - a.total_lost,
        ),
        low_stock_items: lowStockItems,
      },
      null,
      2,
    );

    this.logger.log('Generating wastage analysis');

    const response = await client.chat.completions.create({
      model: this.configService.get<string>(
        'NEMOTRON_MODEL',
        'meta/llama-3.1-70b-instruct',
      ),
      messages: [
        {
          role: 'system',
          content:
            'You are an inventory efficiency expert for restaurants. Analyze wastage patterns and give actionable advice. Highlight the top wastage items, estimate financial impact, and suggest specific fixes (e.g. portion control, supplier issues, menu rebalancing). Be concise and practical.',
        },
        {
          role: 'user',
          content: `Here is the inventory data for this branch:\n${dataContext}\n\nWhat are the key wastage patterns and what should we do about them?`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    });

    return response.choices[0].message.content || '';
  }

  async getRestockRecommendations(branchId: string): Promise<string> {
    const client = await this.getClient();
    if (!client) {
      throw new Error(
        'AI service unavailable: NEMOTRON_API_KEY not configured',
      );
    }

    const trackedItems = await this.menuItemRepo.find({
      where: { branch_id: branchId, track_stock: true },
      relations: { supplier: true },
      order: { name: 'ASC' },
    });

    const lowItems = trackedItems.filter(
      (i) => Number(i.quantity_in_stock) <= Number(i.reorder_level),
    );

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const purchases = await this.movementRepo.find({
      where: {
        branch_id: branchId,
        type: 'purchase',
        created_at: Between(thirtyDaysAgo, new Date()),
      },
      order: { created_at: 'DESC' },
    });

    const usageByItem: Record<string, number> = {};
    for (const p of purchases) {
      usageByItem[p.menu_item_id] =
        (usageByItem[p.menu_item_id] || 0) + Number(p.quantity_change);
    }

    const recommendations = lowItems.map((item) => {
      const monthlyUsage = usageByItem[item.id] || 0;
      const dailyRate = monthlyUsage / 30;
      const currentStock = Number(item.quantity_in_stock);
      const daysRemaining =
        dailyRate > 0 ? Math.round(currentStock / dailyRate) : 999;
      return {
        name: item.name,
        current_stock: currentStock,
        reorder_level: Number(item.reorder_level),
        unit: item.unit,
        supplier: item.supplier?.name || 'No supplier',
        monthly_usage: monthlyUsage,
        days_until_depleted: daysRemaining,
        suggested_order_qty:
          dailyRate > 0
            ? Math.ceil(dailyRate * 14)
            : Math.ceil(Number(item.reorder_level) * 2),
      };
    });

    const healthyItems = trackedItems
      .filter((i) => Number(i.quantity_in_stock) > Number(i.reorder_level))
      .map((i) => ({
        name: i.name,
        stock: Number(i.quantity_in_stock),
        reorder_level: Number(i.reorder_level),
      }));

    const dataContext = JSON.stringify(
      {
        total_tracked: trackedItems.length,
        items_needing_restock: recommendations.sort(
          (a, b) => a.days_until_depleted - b.days_until_depleted,
        ),
        adequately_stocked_count: healthyItems.length,
      },
      null,
      2,
    );

    this.logger.log('Generating restock recommendations');

    const response = await client.chat.completions.create({
      model: this.configService.get<string>(
        'NEMOTRON_MODEL',
        'meta/llama-3.1-70b-instruct',
      ),
      messages: [
        {
          role: 'system',
          content:
            'You are a restaurant supply chain advisor. Review the inventory data and give a prioritized restock plan. Highlight urgent items (less than 3 days of stock), suggest order quantities, and flag items with no assigned supplier. Be concise and actionable.',
        },
        {
          role: 'user',
          content: `Here is the inventory data for this branch:\n${dataContext}\n\nWhat should we reorder and in what priority?`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    });

    return response.choices[0].message.content || '';
  }
}
