import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Tab } from '../tab/entities/tab.entity';
import { Branch } from '../branch/entities/branch.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Bill } from '../bill/entities/bill.entity';
import { PosTerminal } from '../pos/entities/pos-terminal.entity';
import { Order } from '../order/entities/order.entity';
import { OrderStatus } from '../../common/shared';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;
const MAX_RETRIES = 5;

@Injectable()
export class TrackingService {
  constructor(
    @InjectRepository(Tab)
    private tabRepo: Repository<Tab>,
    @InjectRepository(Branch)
    private branchRepo: Repository<Branch>,
    @InjectRepository(MenuItem)
    private menuItemRepo: Repository<MenuItem>,
    @InjectRepository(Bill)
    private billRepo: Repository<Bill>,
    @InjectRepository(PosTerminal)
    private posTerminalRepo: Repository<PosTerminal>,
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
  ) {}

  generateCode(): string {
    const bytes = randomBytes(CODE_LENGTH);
    let result = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      result += CODE_CHARS[bytes[i] % CODE_CHARS.length];
    }
    return result;
  }

  async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const code = this.generateCode();
      const existing = await this.tabRepo.findOne({ where: { tracking_code: code } });
      if (!existing) return code;
    }
    throw new Error('Failed to generate unique tracking code after max retries');
  }

  async getTrackingByCode(code: string) {
    const codeRegex = /^(?:SVQ-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{3}|[A-HJ-NP-Z2-9]{5})$/i;
    if (!codeRegex.test(code)) {
      throw new NotFoundException('Tracking code not found');
    }

    const tab = await this.tabRepo.findOne({ where: { tracking_code: code } });
    if (!tab) {
      throw new NotFoundException('Tracking code not found');
    }

    let businessName = '';
    let branchName = '';
    let logoUrl: string | null = null;
    let branchId = '';

    const branch = await this.branchRepo.findOne({
      where: { id: tab.branch_id },
      relations: { business: true },
    });
    branchId = tab.branch_id;
    branchName = branch?.name || '';
    if (branch?.business) {
      businessName = branch.business.name;
      logoUrl = branch.business.logo_url || null;
    }

    let paymentAccountNumber = '';
    try {
      const bill = await this.billRepo.findOne({ where: { tab_id: tab.id } });
      if (bill?.terminal_id) {
        const terminal = await this.posTerminalRepo.findOne({ where: { id: bill.terminal_id } });
        paymentAccountNumber = terminal?.account_number || '';
      }
    } catch {}

    const orders = await this.orderRepo.find({
      where: { tab_id: tab.id },
      order: { created_at: 'ASC' },
    });

    if (orders.length === 0) {
      return {
        businessName,
        branchName,
        logoUrl,
        branchId,
        paymentAccountNumber,
        tabStatus: tab.status,
        tabId: tab.id,
        trackingGeneratedAt: tab.tracking_generated_at,
        orders: [],
      };
    }

    const items = await Promise.all(
      orders.map(async (order) => {
        let menuItemName = '';
        try {
          const menuItem = await this.menuItemRepo.findOne({ where: { id: order.menu_item_id } });
          menuItemName = menuItem?.name || '';
        } catch {}

        return {
          id: order.id,
          menuItemName,
          quantity: order.quantity,
          orderStatus: order.order_status.toUpperCase(),
          createdAt: order.created_at,
          approvedAt: order.approved_at,
          preparingAt: order.preparing_at,
          actualReadyTime: order.actual_ready_time,
          deliveredAt: order.delivered_at,
          timerEndsAt: order.timer_ends_at,
          declineReason: order.decline_reason,
        };
      }),
    );

    const hasDeclined = orders.some(o => o.order_status === OrderStatus.DECLINED);

    return {
      businessName,
      branchName,
      logoUrl,
      branchId,
      paymentAccountNumber,
      tabStatus: tab.status,
      tabId: tab.id,
      trackingGeneratedAt: tab.tracking_generated_at,
      overallStatus: hasDeclined ? 'PARTIALLY_DECLINED' : 'ACTIVE',
      orders: items,
    };
  }
}