import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Order } from '../order/entities/order.entity';
import { Tab } from '../tab/entities/tab.entity';
import { Branch } from '../branch/entities/branch.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { OrderStatus } from '../../common/shared';

const CODE_PREFIX = 'SVQ';
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const FIRST_GROUP_LENGTH = 4;
const SECOND_GROUP_LENGTH = 3;
const MAX_RETRIES = 5;

@Injectable()
export class TrackingService {
  constructor(
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(Tab)
    private tabRepo: Repository<Tab>,
    @InjectRepository(Branch)
    private branchRepo: Repository<Branch>,
    @InjectRepository(MenuItem)
    private menuItemRepo: Repository<MenuItem>,
  ) {}

  generateCode(): string {
    const randomPart = (len: number): string => {
      const bytes = randomBytes(len);
      let result = '';
      for (let i = 0; i < len; i++) {
        result += CODE_CHARS[bytes[i] % CODE_CHARS.length];
      }
      return result;
    };

    return `${CODE_PREFIX}-${randomPart(FIRST_GROUP_LENGTH)}-${randomPart(SECOND_GROUP_LENGTH)}`;
  }

  async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const code = this.generateCode();
      const existing = await this.orderRepo.findOne({ where: { tracking_code: code } });
      if (!existing) return code;
    }
    throw new Error('Failed to generate unique tracking code after max retries');
  }

  async getTrackingByCode(code: string) {
    const codeRegex = /^SVQ-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{3}$/;
    if (!codeRegex.test(code)) {
      throw new NotFoundException('Tracking code not found');
    }

    const order = await this.orderRepo.findOne({ where: { tracking_code: code } });
    if (!order) {
      throw new NotFoundException('Tracking code not found');
    }

    const tab = await this.tabRepo.findOne({ where: { id: order.tab_id } });

    let businessName = '';
    let branchName = '';
    let logoUrl: string | null = null;
    let branchId = '';

    if (tab) {
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
    }

    if (order.order_status === OrderStatus.DECLINED) {
      return {
        businessName,
        branchName,
        logoUrl,
        branchId,
        order: {
          status: 'DECLINED',
          createdAt: order.created_at,
          approvedAt: order.approved_at,
          preparingAt: order.preparing_at,
          actualReadyTime: order.actual_ready_time,
          deliveredAt: order.delivered_at,
          timerEndsAt: order.timer_ends_at,
          declineReason: order.decline_reason,
          items: [],
        },
      };
    }

    let menuItemName = '';
    try {
      const menuItem = await this.menuItemRepo.findOne({ where: { id: order.menu_item_id } });
      menuItemName = menuItem?.name || '';
    } catch {}

    return {
      businessName,
      branchName,
      logoUrl,
      branchId,
      order: {
        status: order.order_status.toUpperCase(),
        createdAt: order.created_at,
        approvedAt: order.approved_at,
        preparingAt: order.preparing_at,
        actualReadyTime: order.actual_ready_time,
        deliveredAt: order.delivered_at,
        timerEndsAt: order.timer_ends_at,
        declineReason: order.decline_reason,
        items: [
          {
            menuItemName,
            quantity: order.quantity,
          },
        ],
      },
    };
  }
}
