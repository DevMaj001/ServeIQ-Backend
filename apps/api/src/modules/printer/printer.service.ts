import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, FindOptionsWhere } from 'typeorm';
import { Observable, Subject } from 'rxjs';
import { Printer } from './printer.entity';
import { PrintJob } from './print-job.entity';
import { Order } from '../order/entities/order.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Tab } from '../tab/entities/tab.entity';
import { Table } from '../table/entities/table.entity';
import type { ThermalPrinter } from 'node-thermal-printer';
import type { CreatePrinterDto } from './dto/create-printer.dto';
import type { UpdatePrinterDto } from './dto/update-printer.dto';

interface KdsOrderItem {
  id: string;
  name: string;
  qty: number;
  notes?: string | null;
  status: string;
  fulfillment_type?: string | null;
}

interface KdsEvent {
  type: string;
  tab_id: string;
  table_number?: string | number;
  round_number?: number;
  items?: KdsOrderItem[];
  ordered_at?: Date;
  order_ids?: string[];
  order_id?: string;
}

interface ReceiptPrintPayload {
  business_name?: string;
  items?: Array<{ name: string; qty: number; subtotal: number }>;
  total_kobo: number;
  payment_method?: string;
  paid_at?: string | number | Date;
  table_number?: string | number;
}

interface KitchenPrintPayload {
  table_number?: string | number;
  items?: Array<{
    qty: number;
    name: string;
    notes?: string | null;
    fulfillment_type?: string | null;
  }>;
  round_number?: number;
  notes?: string | null;
  waiter_name?: string;
  ordered_at?: string | number | Date;
}

@Injectable()
export class PrinterService {
  private readonly logger = new Logger(PrinterService.name);
  private kdsSubjects = new Map<string, Subject<KdsEvent>>();

  constructor(
    @InjectRepository(Printer)
    private printerRepo: Repository<Printer>,
    @InjectRepository(PrintJob)
    private printJobRepo: Repository<PrintJob>,
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(MenuItem)
    private menuItemRepo: Repository<MenuItem>,
    @InjectRepository(Tab)
    private tabRepo: Repository<Tab>,
    @InjectRepository(Table)
    private tableRepo: Repository<Table>,
  ) {}

  // ── Printer CRUD ──

  async findAll(branchId: string) {
    return this.printerRepo.find({
      where: { branch_id: branchId },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string, branchId: string) {
    const printer = await this.printerRepo.findOne({
      where: { id, branch_id: branchId },
    });
    if (!printer) throw new NotFoundException('Printer not found');
    return printer;
  }

  async create(branchId: string, data: CreatePrinterDto) {
    if (data.is_default) {
      await this.printerRepo.update(
        { branch_id: branchId, is_default: true },
        { is_default: false },
      );
    }
    return this.printerRepo.save(
      this.printerRepo.create({ ...data, branch_id: branchId }),
    );
  }

  async update(id: string, branchId: string, data: UpdatePrinterDto) {
    const printer = await this.findOne(id, branchId);
    if (data.is_default && !printer.is_default) {
      await this.printerRepo.update(
        { branch_id: branchId, is_default: true },
        { is_default: false },
      );
    }
    Object.assign(printer, data);
    return this.printerRepo.save(printer);
  }

  async remove(id: string, branchId: string) {
    const printer = await this.findOne(id, branchId);
    return this.printerRepo.remove(printer);
  }

  // ── Print Queue ──

  async queuePrintJob(
    branchId: string,
    jobType: string,
    payload: unknown,
    printerId?: string,
  ) {
    return this.printJobRepo.save(
      this.printJobRepo.create({
        branch_id: branchId,
        printer_id: printerId,
        job_type: jobType,
        payload,
      }),
    );
  }

  async getPrintJobs(branchId: string, status?: string) {
    const where: FindOptionsWhere<PrintJob> = { branch_id: branchId };
    if (status) where.status = status;
    return this.printJobRepo.find({ where, order: { created_at: 'ASC' } });
  }

  async printJob(branchId: string, jobId: string) {
    const job = await this.printJobRepo.findOne({
      where: { id: jobId, branch_id: branchId },
    });
    if (!job) throw new NotFoundException('Print job not found');

    const printer = job.printer_id
      ? await this.printerRepo.findOne({ where: { id: job.printer_id } })
      : await this.printerRepo.findOne({
          where: { branch_id: branchId, is_default: true },
        });

    if (!printer) throw new BadRequestException('No printer configured');

    try {
      const { ThermalPrinter, PrinterTypes, CharacterSet } =
        await import('node-thermal-printer');
      const escpos = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: `tcp://${printer.ip_address}:${printer.port}`,
        width: printer.character_per_line || 80,
        characterSet: CharacterSet.PC850_MULTILINGUAL,
      });

      const isConnected = await escpos.isPrinterConnected();
      if (!isConnected) {
        throw new Error(
          `Printer ${printer.name} at ${printer.ip_address}:${printer.port} not reachable`,
        );
      }

      if (job.job_type === 'receipt') {
        this.printReceipt(escpos, job.payload as ReceiptPrintPayload);
      } else if (job.job_type === 'kitchen') {
        this.printKitchenTicket(escpos, job.payload as KitchenPrintPayload);
      }

      escpos.cut();
      await escpos.execute();

      job.status = 'printed';
      job.printed_at = new Date();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      job.status = 'failed';
      job.error_message = message;
      job.retry_count += 1;
      this.logger.error(`Print failed for job ${jobId}: ${message}`);
    }

    return this.printJobRepo.save(job);
  }

  private printReceipt(escpos: ThermalPrinter, data: ReceiptPrintPayload) {
    const {
      business_name,
      items,
      total_kobo,
      payment_method,
      paid_at,
      table_number,
    } = data;

    escpos.alignCenter();
    escpos.bold(true);
    escpos.println(business_name || 'ServeIQ');
    escpos.bold(false);
    escpos.println('===============');
    escpos.alignLeft();

    if (table_number) escpos.println(`Table: ${table_number}`);

    for (const item of items || []) {
      escpos.println(
        `${item.name} x${item.qty}  ${(item.subtotal / 100).toFixed(2)}`,
      );
    }

    escpos.println('---------------');
    escpos.bold(true);
    escpos.println(`Total: ₦${(total_kobo / 100).toFixed(2)}`);
    escpos.bold(false);
    escpos.println(`Paid: ${payment_method}`);
    escpos.println(new Date(paid_at as string | number).toLocaleString());
    escpos.println('Thank you!');
  }

  private printKitchenTicket(
    escpos: ThermalPrinter,
    data: KitchenPrintPayload,
  ) {
    const {
      table_number,
      items,
      round_number,
      notes,
      waiter_name,
      ordered_at,
    } = data;

    escpos.setTextSize(1, 1);
    escpos.bold(true);
    escpos.alignCenter();
    escpos.println('=== KITCHEN ORDER ===');
    escpos.bold(false);
    escpos.alignLeft();
    escpos.println(`Table: ${table_number}  Round: ${round_number || 1}`);
    if (waiter_name) escpos.println(`Server: ${waiter_name}`);
    escpos.println('----------------');

    for (const item of items || []) {
      escpos.bold(true);
      const ft = item.fulfillment_type === 'pack' ? '[PACK] ' : '';
      escpos.println(`${ft}${item.qty}x ${item.name}`);
      escpos.bold(false);
      if (item.notes) escpos.println(`  [${item.notes}]`);
    }

    if (notes) {
      escpos.println('----------------');
      escpos.println(`Notes: ${notes}`);
    }

    escpos.println('----------------');
    escpos.println(new Date(ordered_at as string | number).toLocaleString());
  }

  // ── KDS (Kitchen Display System) SSE ──

  subscribeKds(branchId: string): Observable<KdsEvent> {
    if (!this.kdsSubjects.has(branchId)) {
      this.kdsSubjects.set(branchId, new Subject<KdsEvent>());
    }
    return this.kdsSubjects.get(branchId)!.asObservable();
  }

  async sendToKds(branchId: string, tabId: string) {
    const tab = await this.tabRepo.findOne({ where: { id: tabId } });
    if (!tab) return;

    const table = await this.tableRepo.findOne({ where: { id: tab.table_id } });
    const orders = await this.orderRepo.find({
      where: { tab_id: tabId },
      order: { created_at: 'ASC' },
    });
    const items: KdsOrderItem[] = [];
    for (const order of orders) {
      const menuItem = await this.menuItemRepo.findOne({
        where: { id: order.menu_item_id },
      });
      items.push({
        id: order.id,
        name: menuItem?.name || 'Unknown',
        qty: order.quantity,
        notes: order.notes,
        status: 'pending',
        fulfillment_type: order.fulfillment_type,
      });
    }

    const event = {
      type: 'new_order',
      tab_id: tabId,
      table_number: table?.table_number || tab.table_id?.slice(0, 8),
      round_number: orders[0]?.round_number || 1,
      items,
      ordered_at: orders[0]?.created_at,
    };

    const subject = this.kdsSubjects.get(branchId);
    if (subject) {
      subject.next(event);
    }

    await this.queuePrintJob(branchId, 'kitchen', event);
  }

  // ── Order Fired (from KDS) ──

  async fireOrder(branchId: string, tabId: string, orderIds?: string[]) {
    const where: FindOptionsWhere<Order> = { tab_id: tabId };
    if (orderIds) where.id = In(orderIds);
    const orders = await this.orderRepo.find({ where });
    for (const order of orders) {
      await this.orderRepo.update(order.id, {
        round_number: order.round_number + 1,
      });
    }
    const subject = this.kdsSubjects.get(branchId);
    if (subject) {
      subject.next({
        type: 'order_fired',
        tab_id: tabId,
        order_ids: orderIds || orders.map((o) => o.id),
      });
    }
    return { fired: orders.length };
  }

  bumpOrder(branchId: string, tabId: string, orderId: string) {
    const subject = this.kdsSubjects.get(branchId);
    if (subject) {
      subject.next({ type: 'order_bumped', tab_id: tabId, order_id: orderId });
    }
  }
}
