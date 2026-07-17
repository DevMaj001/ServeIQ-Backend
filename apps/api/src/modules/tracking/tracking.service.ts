import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Order } from '../order/entities/order.entity';
import { Tab } from '../tab/entities/tab.entity';
import { Branch } from '../branch/entities/branch.entity';
import { OrderStatus } from '../../common/shared';

const CODE_PREFIX = 'SVQ';
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const FIRST_GROUP_LENGTH = 4;
const SECOND_GROUP_LENGTH = 3;
const MAX_RETRIES = 5;

const STATUS_LEVEL: Record<string, number> = {
  [OrderStatus.PENDING_SUPERVISOR_APPROVAL]: 0,
  [OrderStatus.APPROVED]: 1,
  [OrderStatus.ASSIGNED_TO_DEPARTMENT]: 1,
  [OrderStatus.PREPARING]: 2,
  [OrderStatus.READY_FOR_PICKUP]: 3,
  [OrderStatus.DELIVERED]: 4,
  [OrderStatus.COMPLETED]: 4,
};

const STATUS_LABEL: Record<string, string> = {
  [OrderStatus.PENDING_SUPERVISOR_APPROVAL]: 'Order received',
  [OrderStatus.APPROVED]: 'Approved',
  [OrderStatus.ASSIGNED_TO_DEPARTMENT]: 'Approved',
  [OrderStatus.PREPARING]: 'Preparing',
  [OrderStatus.READY_FOR_PICKUP]: 'On its way',
  [OrderStatus.DELIVERED]: 'Delivered',
  [OrderStatus.COMPLETED]: 'Delivered',
};

const TIMELINE_STAGES = [
  { stage: 'order_received', label: 'Order received', timestampField: 'created_at' },
  { stage: 'approved', label: 'Approved', timestampField: 'approved_at' },
  { stage: 'preparing', label: 'Preparing', timestampField: 'preparing_at' },
  { stage: 'on_its_way', label: 'On its way', timestampField: 'actual_ready_time' },
  { stage: 'delivered', label: 'Delivered', timestampField: 'delivered_at' },
];

@Injectable()
export class TrackingService {
  constructor(
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(Tab)
    private tabRepo: Repository<Tab>,
    @InjectRepository(Branch)
    private branchRepo: Repository<Branch>,
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

    if (order.order_status === OrderStatus.DECLINED) {
      return {
        trackingCode: order.tracking_code,
        status: 'Order cancelled',
        declined: true,
        timeline: [
          { stage: 'order_received', label: 'Order received', timestamp: order.created_at, completed: true },
          { stage: 'declined', label: 'Cancelled', timestamp: order.declined_at, completed: true },
        ],
      };
    }

    const tab = await this.tabRepo.findOne({ where: { id: order.tab_id } });

    let restaurantName = '';
    if (tab) {
      const branch = await this.branchRepo.findOne({
        where: { id: tab.branch_id },
        relations: { business: true },
      });
      restaurantName = branch?.business?.name || '';
    }

    const currentLevel = STATUS_LEVEL[order.order_status] ?? -1;

    const getTimestamp = (field: string): Date | null => {
      if (field === 'created_at') return order.created_at;
      return (order as any)[field] || null;
    };

    const timeline = TIMELINE_STAGES.map(stage => {
      const timestamp = getTimestamp(stage.timestampField);
      return {
        stage: stage.stage,
        label: stage.label,
        timestamp,
        completed: timestamp !== null,
      };
    });

    const hasTimerStarted = order.timer_ends_at !== null && order.approved_at !== null;
    const isBeforeDelivery = currentLevel >= 1 && currentLevel < 3;
    const remainingTime = hasTimerStarted && isBeforeDelivery
      ? Math.max(0, Math.floor((order.timer_ends_at!.getTime() - Date.now()) / 1000))
      : 0;

    return {
      restaurantName,
      trackingCode: order.tracking_code,
      status: STATUS_LABEL[order.order_status] || 'Unknown',
      estimatedTime: order.estimated_preparation_time_seconds || null,
      remainingTime,
      timeline,
    };
  }
}
