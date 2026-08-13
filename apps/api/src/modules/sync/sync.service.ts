import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { SyncQueue } from './sync.entity';
import { Order } from '../order/entities/order.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Tab } from '../tab/entities/tab.entity';
import { Table } from '../table/entities/table.entity';
import { Bill } from '../bill/entities/bill.entity';
import { BillService } from '../bill/bill.service';
import { TabType, TableStatus } from '../../common/shared';

export type SyncPayload = Record<string, any>;

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
    @InjectRepository(Table)
    private tableRepo: Repository<Table>,
    @InjectRepository(Bill)
    private billRepo: Repository<Bill>,
    private billService: BillService,
    private dataSource: DataSource,
  ) {}

  async queueOperation(
    branchId: string,
    entityType: string,
    operation: string,
    payload: any,
    clientKey?: string,
  ) {
    let entry: SyncQueue | null = null;

    if (clientKey) {
      const existing = await this.syncQueueRepo.findOne({
        where: { client_idempotency_key: clientKey },
      });
      // Already applied — return it as-is so clients can drop the local entry.
      if (existing && existing.status === 'processed') {
        return existing;
      }
      // Pending/failed entry for the same key: replay it (retry semantics).
      if (existing) {
        entry = existing;
      }
    }

    if (!entry) {
      entry = await this.syncQueueRepo.save(
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

    // Apply the mutation immediately so offline operations take effect as soon
    // as they reach the server. replayOne() marks the entry 'processed' on
    // success; on failure we record the error and rethrow so the client retries
    // locally with backoff (a later retry replays this same pending/failed row).
    try {
      await this.replayOne(entry);
    } catch (err) {
      entry.status = 'failed';
      entry.error_message = err instanceof Error ? err.message : String(err);
      await this.syncQueueRepo.save(entry);
      throw err;
    }

    return entry;
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
        entry.status = 'failed';
        entry.error_message = err.message;
        await this.syncQueueRepo.save(entry);
        results.push({ id: entry.id, status: 'failed', error: err.message });
      }
    }

    return results;
  }

  private async replayOne(entry: SyncQueue) {
    const { entity_type, operation, payload, branch_id } = entry;

    // Replay queued offline mutations. Where possible we delegate to the same
    // service used by the live API so business rules (stock deduction, tab/
    // table state, billing math) are applied consistently. Mutations are
    // replayed in FIFO order, and queueOperation's idempotency key prevents
    // duplicate side-effects on client retries.
    return this.dataSource.transaction(async (manager) => {
      switch (`${entity_type}.${operation}`) {
        case 'tab.create': {
          const existing = await manager
            .getRepository(Tab)
            .findOne({ where: { id: payload.id } });
          if (existing) break;
          const tab = manager.getRepository(Tab).create({
            id: payload.id,
            branch_id: payload.branch_id || branch_id,
            table_id: payload.table_id,
            waiter_id: payload.waiter_id ?? null,
            shift_id: payload.shift_id ?? null,
            customer_name: payload.customer_name ?? null,
            party_size: payload.party_size ?? 1,
            tab_type: payload.tab_type || TabType.DINE_IN,
            status: payload.status || 'open',
            notes: payload.notes ?? null,
            tab_number:
              payload.tab_number ||
              `TAB-SYNC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            tracking_code: payload.tracking_code || null,
            tracking_generated_at: payload.tracking_generated_at ?? null,
            opened_at: payload.opened_at
              ? new Date(payload.opened_at)
              : new Date(),
          });
          await manager.getRepository(Tab).save(tab);
          // Mark the seatable table occupied just like the live open-tab flow.
          if ((payload.tab_type || TabType.DINE_IN) !== TabType.TAKEAWAY) {
            await manager.getRepository(Table).update(payload.table_id, {
              status: TableStatus.OCCUPIED,
            });
          }
          break;
        }
        case 'tab.update': {
          await manager.getRepository(Tab).update(payload.id, {
            ...(payload.status ? { status: payload.status } : {}),
            ...(payload.closed_at
              ? { closed_at: new Date(payload.closed_at) }
              : {}),
          });
          break;
        }
        case 'order.create': {
          const existing = await manager
            .getRepository(Order)
            .findOne({ where: { id: payload.id } });
          if (existing) {
            existing.quantity = payload.quantity;
            existing.notes = payload.notes ?? existing.notes;
            await manager.getRepository(Order).save(existing);
          } else {
            await manager
              .getRepository(Order)
              .save(manager.getRepository(Order).create(payload));
          }
          break;
        }
        case 'order.delete': {
          if (payload.id) {
            await manager.getRepository(Order).delete({ id: payload.id });
          }
          break;
        }
        case 'bill.create': {
          await this.billService.generateBill(
            payload.tab_id,
            payload.branch_id || branch_id,
            'offline-sync',
            'owner',
            {
              service_charge_percent:
                payload.serviceChargePercent ?? payload.service_charge_percent,
              discount_kobo: payload.discountKobo ?? payload.discount_kobo,
            },
          );
          break;
        }
        case 'bill.pay': {
          await this.billService.processPayment(
            payload.tab_id,
            payload.branch_id || branch_id,
            'offline-sync',
            'owner',
            {
              method: payload.method,
              amount: payload.amount,
              terminal_id: payload.terminal_id,
              reference: payload.reference,
            },
          );
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
    const tables = await this.tableRepo.find({
      where: { branch_id: branchId },
    });
    const openTabs = await this.tabRepo.find({
      where: { branch_id: branchId, status: 'open' },
    });
    const openTabIds = openTabs.map((t) => t.id);
    const orders =
      openTabIds.length > 0
        ? await this.orderRepo.find({ where: { tab_id: In(openTabIds) } })
        : [];
    const bills =
      openTabIds.length > 0
        ? await this.billRepo.find({ where: { tab_id: In(openTabIds) } })
        : [];
    return {
      menus: menuItems,
      tables,
      tabs: openTabs,
      orders,
      bills,
      synced_at: new Date().toISOString(),
    };
  }
}
