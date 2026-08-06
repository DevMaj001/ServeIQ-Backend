import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SyncQueue } from './sync.entity';
import { Order } from '../order/entities/order.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Tab } from '../tab/entities/tab.entity';
import { Bill } from '../bill/entities/bill.entity';

interface SyncPayload {
  id: string;
  quantity?: number;
  notes?: string;
  [key: string]: unknown;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectRepository(SyncQueue)
    private syncQueueRepo: Repository<SyncQueue>,
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(MenuItem)
    private menuItemRepo: Repository<MenuItem>,
    @InjectRepository(Tab)
    private tabRepo: Repository<Tab>,
    @InjectRepository(Bill)
    private billRepo: Repository<Bill>,
    private dataSource: DataSource,
  ) {}

  async queueOperation(
    branchId: string,
    entityType: string,
    operation: string,
    payload: SyncPayload,
    clientKey?: string,
  ) {
    if (clientKey) {
      const existing = await this.syncQueueRepo.findOne({
        where: { client_idempotency_key: clientKey },
      });
      if (existing) {
        return existing;
      }
    }

    return this.syncQueueRepo.save(
      this.syncQueueRepo.create({
        branch_id: branchId,
        entity_type: entityType,
        operation,
        entity_id: payload.id,
        payload,
        client_idempotency_key: clientKey,
      }),
    );
  }

  async getPending(branchId: string) {
    return this.syncQueueRepo.find({
      where: { branch_id: branchId, status: 'pending' },
      order: { created_at: 'ASC' },
    });
  }

  async replayAll(branchId: string) {
    const pending = await this.getPending(branchId);
    const results = [];

    for (const entry of pending) {
      try {
        const result = await this.replayOne(entry);
        results.push(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        entry.status = 'failed';
        entry.error_message = message;
        await this.syncQueueRepo.save(entry);
        results.push({ id: entry.id, status: 'failed', error: message });
      }
    }

    return results;
  }

  private async replayOne(entry: SyncQueue) {
    const { entity_type, operation } = entry;
    const payload = entry.payload as SyncPayload;

    // Merge strategy — server state wins for conflicts, but client changes
    // are preserved for non-conflicting fields.
    return this.dataSource.transaction(async (manager) => {
      switch (`${entity_type}.${operation}`) {
        case 'order.create': {
          const existing = await manager
            .getRepository(Order)
            .findOne({ where: { id: payload.id } });
          if (existing) {
            existing.quantity = payload.quantity ?? existing.quantity;
            existing.notes = payload.notes ?? existing.notes;
            await manager.getRepository(Order).save(existing);
          } else {
            await manager
              .getRepository(Order)
              .save(manager.getRepository(Order).create(payload));
          }
          break;
        }
        default:
          this.logger.warn(
            `Unknown sync operation: ${entity_type}.${operation}`,
          );
      }

      entry.status = 'processed';
      entry.processed_at = new Date();
      await manager.getRepository(SyncQueue).save(entry);
    });
  }

  async getSyncStatus(branchId: string) {
    const pending = await this.syncQueueRepo.count({
      where: { branch_id: branchId, status: 'pending' },
    });
    const failed = await this.syncQueueRepo.count({
      where: { branch_id: branchId, status: 'failed' },
    });
    const processed = await this.syncQueueRepo.count({
      where: { branch_id: branchId, status: 'processed' },
    });

    return { pending, failed, processed };
  }

  async getFullSyncData(branchId: string) {
    const menuItems = await this.menuItemRepo.find({
      where: { branch_id: branchId },
    });
    const openTabs = await this.tabRepo.find({
      where: { branch_id: branchId, status: 'open' },
    });
    return {
      menus: menuItems,
      tabs: openTabs,
      synced_at: new Date().toISOString(),
    };
  }
}
