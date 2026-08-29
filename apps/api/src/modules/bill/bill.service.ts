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
import { OrderStatus, PaymentMethod, isBillable, statusBlocksPayment } from '../../common/shared';
import { GenerateBillDto } from './dto/generate-bill.dto';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { ApplyDiscountDto } from './dto/apply-discount.dto';
import { IngredientService } from '../ingredient/ingredient.service';
import { ReceiptService } from './receipt.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { RealtimeService } from '../gateway/realtime.service';
import { getPublicServer } from '../gateway/gateway.constants';
import { Department } from '../department/entities/department.entity';
import { OrderService } from '../order/order.service';

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
    @InjectRepository(Department)
    private departmentRepository: Repository<Department>,
    @Inject(DataSource)
    private dataSource: DataSource,
    private ingredientService: IngredientService,
    private receiptService: ReceiptService,
    private cloudinaryService: CloudinaryService,
    private realtimeService: RealtimeService,
    private orderService: OrderService,
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

    const existing = await this.billRepository.findOne({
      where: { tab_id: tabId },
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

    let total = subtotal + serviceCharge + tax - discount;
    if (total < 0) total = 0;

    if (existing) {
      // Running bill: recompute amounts from current billable items so items added
      // after the bill was first viewed stay reflected. Discount is preserved.
      existing.subtotal_kobo = subtotal;
      existing.service_charge_kobo = serviceCharge;
      existing.tax_kobo = tax;
      existing.total_kobo = Math.max(
        0,
        subtotal + serviceCharge + tax - (existing.discount_kobo ?? 0),
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
      bill.tax_kobo -
      bill.discount_kobo;
    if (bill.total_kobo < 0) bill.total_kobo = 0;

    return this.billRepository.save(bill);
  }

  async processPayment(
    tabId: string,
    branchId: string,
    userId: string,
    userRole: string,
    paymentDto: ProcessPaymentDto,
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

    const bill = await this.billRepository.findOne({
      where: { tab_id: tabId },
      order: { created_at: 'DESC' },
    });
    if (!bill) throw new NotFoundException('Bill not found');

    // Payment gateway: a tab must not be settled while it still has undelivered
    // billable orders. Declined/cancelled items are excluded, and prepaid-takeaway
    // orders HELD in PENDING_PAYMENT_APPROVAL are exempt (they are paid up front and
    // released to the kitchen at processPayment).
    const orders = await this.orderRepository.find({ where: { tab_id: tabId } });
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
    await this.dataSource.transaction(async (manager) => {
      const orders = await manager
        .getRepository(Order)
        .find({ where: { tab_id: tabId } });

      await this.ingredientService.deductByTab(
        { id: tabId, branch_id: tab.branch_id },
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

      await manager.getRepository(Tab).update(tabId, {
        status: 'paid',
        closed_at: new Date(),
        cashier_id: userId,
      });

      // Release prepaid takeaway orders (held on payment approval) to the kitchen now
      // that payment is confirmed.
      await manager
        .getRepository(Order)
        .createQueryBuilder()
        .update(Order)
        .set({ order_status: OrderStatus.PENDING_SUPERVISOR_APPROVAL })
        .where('tab_id = :tabId', { tabId })
        .andWhere('order_status = :held', {
          held: OrderStatus.PENDING_PAYMENT_APPROVAL,
        })
        .execute();

      // Virtual tables never participate in occupancy logic — they are system records, not seatable tables.
      const payTable = await manager
        .getRepository(Table)
        .findOne({ where: { id: tab.table_id } });
      if (payTable && !payTable.is_virtual) {
        await manager
          .getRepository(Table)
          .update(tab.table_id, { status: TableStatus.AVAILABLE });
      }
    });

    // Emit real-time events
    this.realtimeService.emitBillUpdate(tab.branch_id, tabId, {
      status: 'paid',
      bill,
    });
    this.realtimeService.emitDashboardUpdate(tab.branch_id, {
      type: 'payment_received',
      tabId,
      bill,
    });

    // Push payment confirmation to the public customer tracking page so it does
    // not need to poll (poll-free). Covers cash, card and transfer payments.
    getPublicServer()?.to(`tab:${tabId}`).emit('paymentConfirmed', {
      tabId,
      status: 'paid',
    });

    // Generate PDF receipt and upload to Cloudinary
    try {
      const receiptData = await this.buildReceiptData(tabId);
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

    // After processPayment, held takeaway orders are now PENDING_SUPERVISOR_APPROVAL.
    // Auto-approve them so the supervisor's single action releases the order to the kitchen.
    const heldOrders = await this.orderRepository.find({
      where: { tab_id: tabId, order_status: OrderStatus.PENDING_SUPERVISOR_APPROVAL },
    });

    let approvedCount = 0;
    if (heldOrders.length > 0) {
      const branch = await this.branchRepository.findOne({
        where: { id: branchId },
      });
      const dept = await this.departmentRepository.findOne({
        where: { branch_id: branchId },
      });
      const settings = (branch?.settings as any) || {};
      const prep =
        Number(settings?.takeaway_estimated_prep_seconds) > 0
          ? Number(settings.takeaway_estimated_prep_seconds)
          : 600;

      if (dept) {
        for (const order of heldOrders) {
          try {
            await this.orderService.approve(
              order.id,
              userId,
              {
                department: dept.id,
                estimated_preparation_time_seconds: prep,
              },
              branchId,
            );
            approvedCount++;
          } catch (err) {
            console.error(
              `confirmCashPayment: failed to approve order ${order.id}:`,
              err instanceof Error ? err.message : String(err),
            );
          }
        }
      }
    }

    const refreshed = await this.billRepository.findOne({
      where: { tab_id: tabId },
      order: { created_at: 'DESC' },
    });

    return {
      tab_id: tabId,
      payment_status: refreshed?.payment_status,
      payment_method: refreshed?.payment_method,
      approved_orders: approvedCount,
      requires_manual_approval: Math.max(0, heldOrders.length - approvedCount),
      message:
        approvedCount === heldOrders.length
          ? 'Cash confirmed and order released to kitchen'
          : 'Cash confirmed; some orders need manual supervisor approval (no department configured)',
    };
  }

  private async buildReceiptData(tabId: string) {
    const tab = await this.tabRepository.findOne({ where: { id: tabId } });
    if (!tab) throw new NotFoundException('Tab not found');

    const bill = await this.billRepository.findOne({
      where: { tab_id: tabId },
    });
    if (!bill) return null;

    const orders = await this.orderRepository.find({
      where: { tab_id: tabId },
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

    const table = await this.tableRepository.findOne({
      where: { id: tab.table_id },
    });
    const waiter = tab.waiter_id
      ? await this.userRepository.findOne({ where: { id: tab.waiter_id } })
      : null;
    const branch = await this.branchRepository.findOne({
      where: { id: tab.branch_id },
    });
    const business = branch
      ? await this.businessRepository.findOne({
          where: { id: branch.business_id },
        })
      : null;

    return {
      business,
      branch,
      tab,
      table,
      waiter,
      bill,
      orders: orderItems,
      receipt_number: `RCP-${Date.now()}`,
    };
  }

  // ── Split Checks ──

  async splitEvenly(
    tabId: string,
    branchId: string,
    userId: string,
    userRole: string,
    numSplits: number,
  ) {
    const tab = await this.tabRepository.findOne({ where: { id: tabId } });
    if (!tab) throw new NotFoundException('Tab not found');
    if (tab.branch_id !== branchId)
      throw new ForbiddenException('Tab does not belong to your branch');

    const orders = await this.orderRepository.find({
      where: { tab_id: tabId },
    });
    if (orders.length === 0)
      throw new BadRequestException('No items on this tab');

    const billableOrders = orders.filter((o) => isBillable(o.order_status));
    if (billableOrders.length === 0)
      throw new BadRequestException('No billable items on this tab');

    const total = billableOrders.reduce((sum, o) => sum + o.subtotal_kobo, 0);
    const baseAmount = Math.floor(total / numSplits);
    const remainder = total - baseAmount * numSplits;

    const splitGroup = `split_${Date.now()}_${tabId.slice(0, 8)}`;
    const bills = [];

    for (let i = 0; i < numSplits; i++) {
      const amount = baseAmount + (i < remainder ? 1 : 0);
      bills.push(
        await this.billRepository.save(
          this.billRepository.create({
            tab_id: tabId,
            split_group: splitGroup,
            subtotal_kobo: amount,
            service_charge_kobo: 0,
            tax_kobo: 0,
            discount_kobo: 0,
            total_kobo: amount,
            payment_status: 'pending',
            issued_by: userId,
          }),
        ),
      );
    }

    await this.tabRepository.update(tabId, { status: 'billed' });

    // Emit real-time events
    this.realtimeService.emitBillUpdate(tab.branch_id, tabId, {
      status: 'billed',
      splitBills: bills,
    });
    this.realtimeService.emitDashboardUpdate(tab.branch_id, {
      type: 'bill_split',
      tabId,
      splitBills: bills,
    });

    return bills;
  }

  async splitByItem(
    tabId: string,
    branchId: string,
    userId: string,
    userRole: string,
    allocations: { order_ids: string[]; label?: string }[],
  ) {
    const tab = await this.tabRepository.findOne({ where: { id: tabId } });
    if (!tab) throw new NotFoundException('Tab not found');
    if (tab.branch_id !== branchId)
      throw new ForbiddenException('Tab does not belong to your branch');

    const allOrders = await this.orderRepository.find({
      where: { tab_id: tabId },
    });
    const orderMap = new Map(allOrders.map((o) => [o.id, o]));
    const splitGroup = `split_${Date.now()}_${tabId.slice(0, 8)}`;
    const bills = [];

    for (const allocation of allocations) {
      let subtotal = 0;
      for (const oid of allocation.order_ids) {
        const order = orderMap.get(oid);
        // Never charge a declined/cancelled item on a split.
        if (order && isBillable(order.order_status)) {
          subtotal += order.subtotal_kobo;
        }
      }
      if (subtotal === 0) continue;

      bills.push(
        await this.billRepository.save(
          this.billRepository.create({
            tab_id: tabId,
            split_group: splitGroup,
            subtotal_kobo: subtotal,
            service_charge_kobo: 0,
            tax_kobo: 0,
            discount_kobo: 0,
            total_kobo: subtotal,
            payment_status: 'pending',
            issued_by: userId,
          }),
        ),
      );
    }

    await this.tabRepository.update(tabId, { status: 'billed' });

    // Emit real-time events
    this.realtimeService.emitBillUpdate(tab.branch_id, tabId, {
      status: 'billed',
      splitBills: bills,
    });
    this.realtimeService.emitDashboardUpdate(tab.branch_id, {
      type: 'bill_split',
      tabId,
      splitBills: bills,
    });

    return bills;
  }

  async getSplitBills(tabId: string, branchId: string) {
    const tab = await this.tabRepository.findOne({ where: { id: tabId } });
    if (!tab) throw new NotFoundException('Tab not found');
    if (tab.branch_id !== branchId)
      throw new ForbiddenException('Tab does not belong to your branch');

    return this.billRepository.find({
      where: { tab_id: tabId },
      order: { created_at: 'ASC' },
    });
  }

  async processSplitPayment(
    tabId: string,
    billId: string,
    branchId: string,
    userId: string,
    userRole: string,
    paymentDto: ProcessPaymentDto,
  ) {
    const tab = await this.tabRepository.findOne({ where: { id: tabId } });
    if (!tab) throw new NotFoundException('Tab not found');
    if (tab.branch_id !== branchId)
      throw new ForbiddenException('Tab does not belong to your branch');

    const bill = await this.billRepository.findOne({
      where: { id: billId, tab_id: tabId },
    });
    if (!bill) throw new NotFoundException('Split bill not found');
    if (bill.paid_at)
      throw new BadRequestException('This split bill is already paid');

    // Same payment gate as full settlement: no undelivered billable orders may be
    // outstanding when a split is being settled (declined/cancelled excluded,
    // prepaid-takeaway held orders exempt).
    const openOrders = await this.orderRepository.find({
      where: { tab_id: tabId },
    });
    const blockingOrders = openOrders.filter((o) =>
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

    if (paymentDto.idempotency_key) {
      const dup = await this.billRepository.findOne({
        where: { idempotency_key: paymentDto.idempotency_key },
      });
      if (dup?.paid_at) return dup;
    }

    bill.payment_method = paymentDto.method;
    bill.payment_amount_kobo = paymentDto.amount;
    if (paymentDto.reference) bill.payment_reference = paymentDto.reference;
    if (paymentDto.terminal_id) bill.terminal_id = paymentDto.terminal_id;
    if (paymentDto.idempotency_key)
      bill.idempotency_key = paymentDto.idempotency_key;
    bill.paid_at = new Date();
    bill.payment_status = 'paid';
    const saved = await this.billRepository.save(bill);

    const allBills = await this.billRepository.find({
      where: { tab_id: tabId },
    });
    const allPaid = allBills.every((b) => b.paid_at);
    const anyPaid = allBills.some((b) => b.paid_at);

    if (allPaid) {
      const tab = await this.tabRepository.findOne({ where: { id: tabId } });
      if (tab) {
        await this.tabRepository.update(tabId, {
          status: 'paid',
          closed_at: new Date(),
          cashier_id: userId,
        });
        if (tab.table_id) {
          const splitTable = await this.tableRepository.findOne({
            where: { id: tab.table_id },
          });
          if (splitTable && !splitTable.is_virtual) {
            await this.tableRepository.update(tab.table_id, {
              status: TableStatus.AVAILABLE,
            });
          }
        }
      }
    } else if (!anyPaid) {
      await this.tabRepository.update(tabId, { status: 'billed' });
    }

    return saved;
  }

  async getReceipt(tabId: string, branchId: string) {
    const tab = await this.tabRepository.findOne({ where: { id: tabId } });
    if (!tab) throw new NotFoundException('Tab not found');
    if (tab.branch_id !== branchId)
      throw new ForbiddenException('Tab does not belong to your branch');

    return this.buildReceiptData(tabId);
  }

  async getReceiptPdf(tabId: string, branchId: string): Promise<Buffer> {
    const tab = await this.tabRepository.findOne({ where: { id: tabId } });
    if (!tab) throw new NotFoundException('Tab not found');
    if (tab.branch_id !== branchId)
      throw new ForbiddenException('Tab does not belong to your branch');

    const data = await this.buildReceiptData(tabId);
    if (!data) throw new NotFoundException('Bill not found');
    return this.receiptService.generatePdf(data);
  }
}
