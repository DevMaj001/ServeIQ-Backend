import { Inject, Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
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
import { GenerateBillDto } from './dto/generate-bill.dto';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { ApplyDiscountDto } from './dto/apply-discount.dto';
import { IngredientService } from '../ingredient/ingredient.service';
import { ReceiptService } from './receipt.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';

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
  ) {}

  async generateBill(tabId: string, userId: string, userRole: string, generateBillDto?: GenerateBillDto) {
    const tab = await this.tabRepository.findOne({ where: { id: tabId } });
    if (!tab) throw new NotFoundException('Tab not found');

    if (
      tab.waiter_id &&
      userId &&
      tab.waiter_id !== userId &&
      userRole !== 'owner' &&
      userRole !== 'manager'
    ) {
      throw new ForbiddenException('This tab belongs to another waiter');
    }

    const orders = await this.orderRepository.find({ where: { tab_id: tabId } });
    const subtotal = orders.reduce((sum, order) => sum + order.subtotal_kobo, 0);

    const serviceChargePercent = generateBillDto?.service_charge_percent ?? 10;
    const serviceCharge = Math.round(subtotal * (serviceChargePercent / 100));
    const discount = generateBillDto?.discount_kobo ?? 0;

    const tabBranch = await this.branchRepository.findOne({ where: { id: tab.branch_id } });
    const business = tabBranch ? await this.businessRepository.findOne({ where: { id: tabBranch.business_id } }) : null;
    const effectiveTaxRate = generateBillDto?.tax_rate_percent ?? Number(business?.tax_rate ?? 7.5);
    const tax = Math.round(subtotal * (effectiveTaxRate / 100));

    let total = subtotal + serviceCharge + tax - discount;
    if (total < 0) total = 0;

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

    await this.tabRepository.update(tabId, { status: 'billed', billed_at: new Date() });

    return savedBill;
  }

  async applyDiscount(tabId: string, dto: ApplyDiscountDto) {
    const bill = await this.billRepository.findOne({ where: { tab_id: tabId } });
    if (!bill) throw new NotFoundException('Bill not found');
    if (bill.paid_at) throw new BadRequestException('Cannot modify a paid bill');

    if (dto.discount_kobo !== undefined) {
      bill.discount_kobo = dto.discount_kobo;
    } else if (dto.discount_percent !== undefined) {
      bill.discount_kobo = Math.round(bill.subtotal_kobo * (dto.discount_percent / 100));
    }

    bill.total_kobo = bill.subtotal_kobo + bill.service_charge_kobo + bill.tax_kobo - bill.discount_kobo;
    if (bill.total_kobo < 0) bill.total_kobo = 0;

    return this.billRepository.save(bill);
  }

  async processPayment(tabId: string, userId: string, userRole: string, paymentDto: ProcessPaymentDto) {
    const tab = await this.tabRepository.findOne({ where: { id: tabId } });
    if (!tab) throw new NotFoundException('Tab not found');

    if (
      tab.waiter_id &&
      userId &&
      tab.waiter_id !== userId &&
      userRole !== 'owner' &&
      userRole !== 'manager'
    ) {
      throw new ForbiddenException('This tab belongs to another waiter');
    }

    const bill = await this.billRepository.findOne({ where: { tab_id: tabId } });
    if (!bill) throw new NotFoundException('Bill not found');

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
      const orders = await manager.getRepository(Order).find({ where: { tab_id: tabId } });

      await this.ingredientService.deductByTab(
        { id: tabId, branch_id: tab.branch_id },
        orders.map(o => ({ menu_item_id: o.menu_item_id, quantity: o.quantity })),
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

      await manager.getRepository(Bill).save(bill);

      await manager.getRepository(Tab).update(tabId, { status: 'paid', closed_at: new Date() });
      await manager.getRepository(Table).update(tab.table_id, { status: TableStatus.AVAILABLE });
    });

    // Generate PDF receipt and upload to Cloudinary
    try {
      const receiptData = await this.buildReceiptData(tabId);
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
      console.error('PDF receipt generation failed (non-blocking):', err.message);
    }

    return bill;
  }

  private async buildReceiptData(tabId: string) {
    const tab = await this.tabRepository.findOne({ where: { id: tabId } });
    if (!tab) throw new NotFoundException('Tab not found');

    const bill = await this.billRepository.findOne({ where: { tab_id: tabId } });
    if (!bill) throw new NotFoundException('Bill not found');

    const orders = await this.orderRepository.find({ where: { tab_id: tabId } });

    const orderItems = [];
    for (const order of orders) {
      const menuItem = await this.menuItemRepository.findOne({ where: { id: order.menu_item_id } });
      orderItems.push({
        ...order,
        menu_item: menuItem,
      });
    }

    const table = await this.tableRepository.findOne({ where: { id: tab.table_id } });
    const waiter = await this.userRepository.findOne({ where: { id: tab.waiter_id } });
    const branch = await this.branchRepository.findOne({ where: { id: tab.branch_id } });
    const business = branch ? await this.businessRepository.findOne({ where: { id: branch.business_id } }) : null;

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

  async getReceipt(tabId: string) {
    return this.buildReceiptData(tabId);
  }

  async getReceiptPdf(tabId: string): Promise<Buffer> {
    const data = await this.buildReceiptData(tabId);
    return this.receiptService.generatePdf(data);
  }
}
