import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Bill } from './entities/bill.entity';
import { Tab } from '../tab/entities/tab.entity';
import { Order } from '../order/entities/order.entity';
import { Table, TableStatus } from '../table/entities/table.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { User } from '../user/entities/user.entity';
import { Branch } from '../branch/entities/branch.entity';
import { Business } from '../business/entities/business.entity';
import {
  OrderStatus,
  PaymentMethod,
  isBillable,
  statusBlocksPayment,
} from '../../common/shared';
import { IsNull, Not, In } from 'typeorm';
import { GenerateBillDto } from './dto/generate-bill.dto';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { ApplyDiscountDto } from './dto/apply-discount.dto';
import { IngredientService } from '../ingredient/ingredient.service';
import { ReceiptService } from './receipt.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { RealtimeService } from '../gateway/realtime.service';
import { getPublicServer } from '../gateway/gateway.constants';

@Injectable()
export class BillService {
  constructor(
    @InjectRepository(Bill)
    private billRepository: Repository<Bill>,
    @InjectRepository(Tab)
    private tabRepository: Repository<Tab>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Table)
    private tableRepository: Repository<Table>,
    @InjectRepository(MenuItem)
    private menuItemRepository: Repository<MenuItem>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Branch)
    private branchRepository: Repository<Branch>,
    @InjectRepository(Business)
    private businessRepository: Repository<Business>,
    @Inject(DataSource)
    private dataSource: DataSource,
    private ingredientService: IngredientService,
    private receiptService: ReceiptService,
    private cloudinaryService: CloudinaryService,
    private realtimeService: RealtimeService,
  ) {}

  async generateBill(
    tabId: string,
    branchId: string,
    userId: string,
    userRole: string,
    generateBillDto?: GenerateBillDto,
  ) {
    const tab = await this.tabRepository.findOne({ where: { id: tabId } });
    if (!tab) throw new NotFoundException('Tab not found');
    if (tab.branch_id !== branchId)
      throw new ForbiddenException('Tab does not belong to your branch');

    if (
      tab.waiter_id &&
      userId &&
      tab.waiter_id !== userId &&
      userRole !== 'owner' &&
      userRole !== 'manager' &&
      userRole !== 'cashier'
    ) {
      throw new ForbiddenException('This tab belongs to another waiter');
    }

    // Never regenerate a bill for an already-settled tab.
    if (tab.status === 'paid' || tab.closed_at) {
      return this.billRepository.findOne({
        where: { tab_id: tabId, paid_at: Not(IsNull()) },
        order: { created_at: 'DESC' },
      });
    }

    // The "running" bill to recompute is the newest live, non-voided row.
    const existing = await this.billRepository.findOne({
      where: { tab_id: tabId, voided_at: IsNull() },
      order: { created_at: 'DESC' },
    });
    if (existing?.paid_at) {
      return existing;
    }

    const orders = await this.orderRepository.find({
      where: { tab_id: tabId },
    });
    // Declined/cancelled items never contribute to the bill.
    const billableOrders = orders.filter((o) => isBillable(o.order_status));
    const subtotal = billableOrders.reduce(
      (sum, order) => sum + (order.subtotal_kobo ?? 0),
      0,
    );

    const tabBranch = await this.branchRepository.findOne({
      where: { id: tab.branch_id },
    });
    const business = tabBranch
      ? await this.businessRepository.findOne({
          where: { id: tabBranch.business_id },
        })
      : null;

    const serviceChargePercent =
      generateBillDto?.service_charge_percent ??
      Number(business?.service_charge_percent ?? 10);
    const serviceCharge = Math.round(subtotal * (serviceChargePercent / 100));
    const discount = generateBillDto?.discount_kobo ?? 0;
    const effectiveTaxRate =
      generateBillDto?.tax_rate_percent ?? Number(business?.tax_rate ?? 7.5);
    const tax = Math.round(subtotal * (effectiveTaxRate / 100));

    const deliveryFee =
      tab.pickup_mode === 'dispatch' ? Number(tab.delivery_fee_kobo || 0) : 0;

    let total = subtotal + serviceCharge + tax + deliveryFee - discount;
    if (total < 0) total = 0;

    if (existing) {
      // Running bill: recompute amounts from current billable items so items added
      // after the bill was first viewed stay reflected. Discount is preserved.
      existing.subtotal_kobo = subtotal;
      existing.service_charge_kobo = serviceCharge;
      existing.tax_kobo = tax;
      existing.delivery_fee_kobo = deliveryFee;
      existing.total_kobo = Math.max(
        0,
        subtotal +
          serviceCharge +
          tax +
          deliveryFee -
          (existing.discount_kobo ?? 0),
      );
      const updated = await this.billRepository.save(existing);

      this.realtimeService.emitBillUpdate(tab.branch_id, tabId, {
        status: 'billed',
        bill: updated,
      });
      return updated;
    }

    const bill = this.billRepository.create({
      tab_id: tabId,
      subtotal_kobo: subtotal,
      service_charge_kobo: serviceCharge,
      tax_kobo: tax,
      discount_kobo: discount,
      delivery_fee_kobo: deliveryFee,
      total_kobo: total,
      issued_by: userId,
    });

    const savedBill = await this.billRepository.save(bill);

    await this.tabRepository.update(tabId, {
      status: 'billed',
      billed_at: new Date(),
    });

    // Emit real-time events
    this.realtimeService.emitBillUpdate(tab.branch_id, tabId, {
      status: 'billed',
      bill: savedBill,
    });
    this.realtimeService.emitDashboardUpdate(tab.branch_id, {
      type: 'bill_generated',
      tabId,
      bill: savedBill,
    });

    return savedBill;
  }

  async applyDiscount(tabId: string, branchId: string, dto: ApplyDiscountDto) {
    const tab = await this.tabRepository.findOne({ where: { id: tabId } });
    if (!tab) throw new NotFoundException('Tab not found');
    if (tab.branch_id !== branchId)
      throw new ForbiddenException('Tab does not belong to your branch');

    const bill = await this.billRepository.findOne({
      where: { tab_id: tabId },
    });
    if (!bill) throw new NotFoundException('Bill not found');
    if (bill.paid_at)
      throw new BadRequestException('Cannot modify a paid bill');

    const tabBranch = await this.branchRepository.findOne({
      where: { id: tab.branch_id },
    });
    const business = tabBranch
      ? await this.businessRepository.findOne({
          where: { id: tabBranch.business_id },
        })
      : null;
    const minOrder = Number(business?.discount_min_order_amount ?? 0);
    if (minOrder > 0 && (bill.subtotal_kobo ?? 0) < minOrder) {
      throw new BadRequestException(
        `A minimum purchase of ${this.formatCurrency(
          minOrder,
          business?.currency ?? 'NGN',
        )} is required to apply a discount`,
      );
    }

    if (dto.discount_kobo !== undefined) {
      bill.discount_kobo = dto.discount_kobo;
    } else if (dto.discount_percent !== undefined) {
      bill.discount_kobo = Math.round(
        bill.subtotal_kobo * (dto.discount_percent / 100),
      );
    }

    bill.total_kobo =
      bill.subtotal_kobo +
      bill.service_charge_kobo +
      bill.tax_kobo +
      (bill.delivery_fee_kobo ?? 0) -
      bill.discount_kobo;
    if (bill.total_kobo < 0) bill.total_kobo = 0;

    return this.billRepository.save(bill);
  }

  private formatCurrency(kobo: number, currency: string): string {
    const symbolMap: Record<string, string> = {
      NGN: '\u20A6',
      USD: '$',
      GBP: '\u00A3',
      EUR: '\u20AC',
      GHS: 'GH\u00A2',
      KES: 'KSh',
      ZAR: 'R',
      XOF: 'CFA',
    };
    return `${symbolMap[currency] ?? currency}${(
      (kobo ?? 0) / 100
    ).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  async processPayment(
    tabId: string | null,
    branchId: string,
    userId: string,
    userRole: string,
    paymentDto: ProcessPaymentDto,
    opts?: { bill?: Bill },
  ) {
    // Standalone (tabless) online order groups are settled via the bill that a
    // webhook already resolved; the caller hands it over so we don't re-query.
    const bill =
      opts?.bill ??
      (await this.billRepository.findOne({
        where: { tab_id: tabId!, voided_at: IsNull() },
        order: { created_at: 'DESC' },
      }));
    if (!bill) throw new NotFoundException('Bill not found');

    // Identify the orders this settlement covers. Tabs scope by tab_id;
    // standalone online orders share their group's unique tracking_code.
    const scope = tabId
      ? ({ tab_id: tabId } as const)
      : ({ tracking_code: bill.tracking_code } as const);

    let tab: Tab | null = null;
    if (tabId) {
      tab = await this.tabRepository.findOne({ where: { id: tabId } });
      if (!tab) throw new NotFoundException('Tab not found');
      if (tab.branch_id !== branchId)
        throw new ForbiddenException('Tab does not belong to your branch');

      // For standalone groups the bill carries the branch, but waiter ownership
      // only exists for dine-in tabs.
      if (
        tab.waiter_id &&
        userId &&
        tab.waiter_id !== userId &&
        userRole !== 'owner' &&
        userRole !== 'manager' &&
        userRole !== 'cashier'
      ) {
        throw new ForbiddenException('This tab belongs to another waiter');
      }
    }

    // Takeaway / self-service orders are prepaid online — cash is not accepted
    // for them. Dine-in keeps the cash-at-counter flow.
    if (
      (tab?.tab_type === 'takeaway' || !tabId) &&
      paymentDto.method === PaymentMethod.CASH
    ) {
      throw new BadRequestException(
        'Cash payment is not available for takeaway orders. Please use transfer or a card terminal.',
      );
    }

    const orders = await this.orderRepository.find({
      where: scope as any,
    });
    const blockingOrders = orders.filter((o) =>
      statusBlocksPayment(o.order_status),
    );
    if (blockingOrders.length > 0) {
      throw new ConflictException(
        'Complete delivery of all orders before proceeding to payment. ' +
          `Undelivered item(s): ${blockingOrders
            .map((o) => o.menu_item_id.slice(0, 8))
            .join(', ')}`,
      );
    }

    // Reject underpayments: a bill must not be settled for less than its total.
    // Guards against truncated webhook amounts silently closing a larger bill.
    if (bill.total_kobo && paymentDto.amount < bill.total_kobo) {
      throw new BadRequestException(
        `Payment amount ${paymentDto.amount} is less than bill total ${bill.total_kobo}`,
      );
    }

    if (paymentDto.idempotency_key) {
      const existing = await this.billRepository.findOne({
        where: { idempotency_key: paymentDto.idempotency_key },
      });
      if (existing?.paid_at) {
        return existing;
      }
    }

    // Stock deduction, bill finalization, and tab/table state changes are wrapped
    // in a single atomic transaction. If any step fails — deadlock, lock timeout,
    // conversion error — everything rolls back, preventing the "deducted but unpaid"
    // or "paid but not deducted" inconsistency.
    //
    // In this business's pay-at-order-time workflow, payment = fulfillment, so
    // processing deduction here is correct. In a traditional restaurant (pay-at-end)
    // the deduction would move to a kitchen status transition instead.
    const branchIdForDeduction = tab?.branch_id ?? bill.branch_id ?? branchId;
    await this.dataSource.transaction(async (manager) => {
      const orders = await manager.getRepository(Order).find({
        where: scope as any,
      });

      // Standalone groups record stock movements against the bill id, which is
      // stable for the life of the settlement and unique to the group.
      await this.ingredientService.deductByTab(
        {
          id: tab?.id ?? bill.id,
          branch_id: branchIdForDeduction,
        },
        orders.map((o) => ({
          menu_item_id: o.menu_item_id,
          quantity: o.quantity,
        })),
        manager,
      );

      bill.payment_method = paymentDto.method;
      bill.payment_amount_kobo = paymentDto.amount;
      if (paymentDto.reference) {
        bill.payment_reference = paymentDto.reference;
      }
      if (paymentDto.terminal_id) {
        bill.terminal_id = paymentDto.terminal_id;
      }
      if (paymentDto.idempotency_key) {
        bill.idempotency_key = paymentDto.idempotency_key;
      }
      bill.paid_at = new Date();
      bill.payment_status = 'paid';

      await manager.getRepository(Bill).save(bill);

      // Wholesale settlement supersedes any pending split/plan rows for the same
      // scope: void them so they cannot be settled later, double-counted in revenue,
      // or show as outstanding splits after the tab/group is already closed as paid.
      await manager.getRepository(Bill).update(
        {
          ...(scope as any),
          id: Not(bill.id),
          paid_at: IsNull(),
          voided_at: IsNull(),
        },
        { voided_at: new Date() },
      );

      if (tabId && tab) {
        await manager.getRepository(Tab).update(tabId, {
          status: 'paid',
          closed_at: new Date(),
          cashier_id: userId,
        });
      } else if (!tabId && bill.tracking_code) {
        // Standalone groups carry the group status denormalized on each order.
        await manager.getRepository(Order).update(
          {
            ...(scope as any),
            status: Not('paid'),
          },
          { status: 'paid' },
        );
      }

      // Release prepaid takeaway orders (held on payment approval) to the kitchen now
      // that payment is confirmed. KDS-enabled branches send them straight to the
      // kitchen queue (bypassing supervisor approval); other branches keep the legacy
      // supervisor pipeline.
      const heldOrders = await manager.getRepository(Order).find({
        where: {
          ...(scope as any),
          order_status: OrderStatus.PENDING_PAYMENT_APPROVAL,
        },
      });
      if (heldOrders.length > 0) {
        const releaseBranch = await manager
          .getRepository(Branch)
          .findOne({ where: { id: branchIdForDeduction } });
        const releaseKdsEnabled =
          (
            releaseBranch?.settings?.feature_flags as
              Record<string, boolean> | undefined
          )?.kds_enabled === true;
        const kdsDefaultDepartment = releaseKdsEnabled
          ? (releaseBranch?.settings?.kds_default_department_id as string) ||
            null
          : null;

        // Self-service orders carry no waiter-selected department/prep time, so fill
        // them from the branch default + each item's own prep time default.
        const releaseMenuItems = await manager.getRepository(MenuItem).find({
          where: {
            id: In(heldOrders.map((o) => o.menu_item_id)),
          },
        });
        const releaseMenuMap = new Map(releaseMenuItems.map((m) => [m.id, m]));

        for (const heldOrder of heldOrders) {
          await manager.getRepository(Order).update(heldOrder.id, {
            order_status: releaseKdsEnabled
              ? OrderStatus.ASSIGNED_TO_DEPARTMENT
              : OrderStatus.PENDING_SUPERVISOR_APPROVAL,
            assigned_department: releaseKdsEnabled
              ? heldOrder.assigned_department || kdsDefaultDepartment
              : heldOrder.assigned_department,
            estimated_preparation_time_seconds:
              heldOrder.estimated_preparation_time_seconds ??
              releaseMenuMap.get(heldOrder.menu_item_id)?.prep_time_seconds ??
              heldOrder.estimated_preparation_time_seconds,
          });
        }
      }

      // Release the physical table for dine-in tabs (takeaway tabs have none).
      if (tabId && tab && tab.table_id) {
        const payTable = await manager
          .getRepository(Table)
          .findOne({ where: { id: tab.table_id } });
        if (payTable) {
          await manager
            .getRepository(Table)
            .update(tab.table_id, { status: TableStatus.AVAILABLE });
        }
      }
    });

    // Emit real-time events. Standalone groups are addressed by tracking_code.
    this.realtimeService.emitBillUpdate(
      branchIdForDeduction,
      tabId ?? bill.tracking_code ?? '',
      {
        status: 'paid',
        bill,
      },
    );
    this.realtimeService.emitDashboardUpdate(branchIdForDeduction, {
      type: 'payment_received',
      tabId,
      bill,
    });

    // Push payment confirmation to the public customer tracking page so it does
    // not need to poll (poll-free). Covers cash, card and transfer payments.
    if (tabId) {
      getPublicServer()
        ?.to(`tab:${tabId}`)
        .emit('paymentConfirmed', {
          tabId,
          status: 'paid',
        });
    } else if (bill.tracking_code) {
      getPublicServer()
        ?.to(`tracking:${bill.tracking_code}`)
        .emit('paymentConfirmed', {
          tabId: bill.tracking_code,
          status: 'paid',
        });
    }

    // Generate PDF receipt and upload to Cloudinary
    if (tabId) {
      try {
        const receiptData = await this.buildReceiptData({ tabId });
        if (!receiptData) return bill;
        const pdfBuffer = this.receiptService.generatePdf(receiptData);
        const uploadResult = await this.cloudinaryService.uploadFile(
          pdfBuffer,
          `receipts/${tabId}`,
          'raw',
        );
        if (uploadResult?.secure_url) {
          bill.receipt_url = uploadResult.secure_url;
          await this.billRepository.save(bill);
        }
      } catch (err) {
        console.error(
          'PDF receipt generation failed (non-blocking):',
          err instanceof Error ? err.message : String(err),
        );
      }
    } else if (bill.tracking_code) {
      try {
        const receiptData = await this.buildReceiptData({
          trackingCode: bill.tracking_code,
        });
        if (receiptData) {
          const pdfBuffer = this.receiptService.generatePdf(receiptData);
          const uploadResult = await this.cloudinaryService.uploadFile(
            pdfBuffer,
            `receipts/${bill.tracking_code}`,
            'raw',
          );
          if (uploadResult?.secure_url) {
            bill.receipt_url = uploadResult.secure_url;
            await this.billRepository.save(bill);
          }
        }
      } catch (err) {
        console.error(
          'PDF receipt generation failed (non-blocking):',
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    return bill;
  }

  /**
   * Supervisor confirms a cash payment taken at the counter and releases the
   * takeaway order(s) to the kitchen in a single action. The bill is marked paid
   * (cash), the tab is closed with the supervisor recorded as cashier, and any
   * orders held in PENDING_PAYMENT_APPROVAL are released and auto-approved so the
   * kitchen begins preparation immediately.
   */
  async confirmCashPayment(
    tabId: string,
    branchId: string,
    userId: string,
    userRole: string,
  ) {
    const tab = await this.tabRepository.findOne({ where: { id: tabId } });
    if (!tab) throw new NotFoundException('Tab not found');
    if (tab.branch_id !== branchId)
      throw new ForbiddenException('Tab does not belong to your branch');

    const bill = await this.billRepository.findOne({
      where: { tab_id: tabId },
      order: { created_at: 'DESC' },
    });
    if (!bill) throw new NotFoundException('Bill not found');

    // Idempotent: only process payment if not already paid.
    if (!bill.paid_at) {
      await this.processPayment(tabId, branchId, userId, userRole, {
        method: PaymentMethod.CASH,
        amount: bill.total_kobo || 0,
        idempotency_key: `cash-confirm-${tabId}`,
      });
    }
    // processPayment releases held takeaway orders to PENDING_SUPERVISOR_APPROVAL,
    // so they land back in the supervisor's Pending queue for manual approval
    // (department + prep time) before they can reach the kitchen.

    const refreshed = await this.billRepository.findOne({
      where: { tab_id: tabId },
      order: { created_at: 'DESC' },
    });

    return {
      tab_id: tabId,
      payment_status: refreshed?.payment_status,
      payment_method: refreshed?.payment_method,
      message:
        'Cash confirmed - order returned to pending for supervisor approval',
    };
  }

  /**
   * Supervisor removes a pending-cash request (e.g. customer abandoned the order
   * or spammed the cash button). Voids the awaiting-cash bill and releases any
   * orders held in PENDING_PAYMENT_APPROVAL back to PENDING_SUPERVISOR_APPROVAL,
   * leaving the tab open so the customer can re-pay another way. Idempotent: a
   * second call for an already-voided/paid request is a safe no-op.
   */
  async removeCashRequest(tabId: string, branchId: string, userId: string) {
    const tab = await this.tabRepository.findOne({ where: { id: tabId } });
    if (!tab) throw new NotFoundException('Tab not found');
    if (tab.branch_id !== branchId)
      throw new ForbiddenException('Tab does not belong to your branch');
    if (tab.status === 'paid')
      throw new BadRequestException('Tab is already paid');

    const bill = await this.billRepository.findOne({
      where: { tab_id: tabId, voided_at: IsNull() },
      order: { created_at: 'DESC' },
    });

    let removed = false;
    if (bill) {
      if (bill.paid_at) {
        throw new BadRequestException(
          'Payment was already confirmed for this order; use Confirm Cash instead',
        );
      }
      bill.voided_at = new Date();
      bill.payment_status = 'voided';
      await this.billRepository.save(bill);
      removed = true;
    }

    // When a cash request is rejected, keep orders in PENDING_PAYMENT_APPROVAL
    // so the customer can retry with another payment method (transfer/POS).
    // Do NOT move them to PENDING_SUPERVISOR_APPROVAL.

    if (removed) {
      this.realtimeService.emitDashboardUpdate(tab.branch_id, {
        type: 'cash_request_removed',
        tabId,
        userId,
      });
    }

    return {
      tab_id: tabId,
      removed,
      message: removed
        ? 'Cash payment request removed. Customer can retry payment.'
        : 'No pending cash request found for this order.',
    };
  }

  private async buildReceiptData(opts: {
    tabId?: string;
    trackingCode?: string;
  }) {
    const { tabId, trackingCode } = opts;
    const tab = tabId
      ? await this.tabRepository.findOne({ where: { id: tabId } })
      : null;
    if (tabId && !tab) throw new NotFoundException('Tab not found');

    const allBills = (await this.billRepository.find({
      where: tabId ? { tab_id: tabId } : { tracking_code: trackingCode },
      order: { created_at: 'ASC' },
    })) ?? [];

    // The receipt reflects the single full-tab bill. Prefer the most recently
    // paid bill so a settled tab shows the bill actually paid (method and amount),
    // falling back to the latest non-voided bill otherwise.
    const nonVoided = allBills.filter((b) => !b.voided_at);
    const paidBills = nonVoided.filter((b) => b.paid_at);

    const bill =
      paidBills[paidBills.length - 1] ??
      nonVoided[nonVoided.length - 1] ??
      allBills[allBills.length - 1] ??
      null;

    const orders = tabId
      ? await this.orderRepository.find({
          where: { tab_id: tabId },
        })
      : await this.orderRepository.find({
          where: { tracking_code: trackingCode },
        });

    const orderItems = [];
    for (const order of orders) {
      const menuItem = await this.menuItemRepository.findOne({
        where: { id: order.menu_item_id },
      });
      orderItems.push({
        ...order,
        menu_item: menuItem,
      });
    }

    const table = tab?.table_id
      ? await this.tableRepository.findOne({
          where: { id: tab.table_id },
        })
      : null;
    const waiter = tab?.waiter_id
      ? await this.userRepository.findOne({ where: { id: tab.waiter_id } })
      : null;
    const branch = tab
      ? await this.branchRepository.findOne({
          where: { id: tab.branch_id },
        })
      : orders[0]?.branch_id
        ? await this.branchRepository.findOne({
            where: { id: orders[0].branch_id },
          })
        : null;
    const business = branch
      ? await this.businessRepository.findOne({
          where: { id: branch.business_id },
        })
      : null;

    return {
      business,
      branch,
      tab: tab as Tab | null,
      table,
      waiter,
      bill,
      orders: orderItems,
      receipt_number: `RCP-${Date.now()}`,
    };
  }

  async getReceipt(tabId: string, branchId: string) {
    const tab = await this.tabRepository.findOne({ where: { id: tabId } });
    if (!tab) throw new NotFoundException('Tab not found');
    if (tab.branch_id !== branchId)
      throw new ForbiddenException('Tab does not belong to your branch');

    return this.buildReceiptData({ tabId });
  }

  async getReceiptPdf(tabId: string, branchId: string): Promise<Buffer> {
    const tab = await this.tabRepository.findOne({ where: { id: tabId } });
    if (!tab) throw new NotFoundException('Tab not found');
    if (tab.branch_id !== branchId)
      throw new ForbiddenException('Tab does not belong to your branch');

    const data = await this.buildReceiptData({ tabId });
    if (!data) throw new NotFoundException('Bill not found');
    return this.receiptService.generatePdf(data);
  }
}
