import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tab } from '../tab/entities/tab.entity';
import { Bill } from '../bill/entities/bill.entity';
import { Order } from '../order/entities/order.entity';
import { PosTerminal } from '../pos/entities/pos-terminal.entity';

@ApiTags('Customer Payments')
@Controller('public/payments')
export class PaymentController {
  constructor(
    @InjectRepository(Tab)
    private tabRepo: Repository<Tab>,
    @InjectRepository(Bill)
    private billRepo: Repository<Bill>,
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(PosTerminal)
    private posTerminalRepo: Repository<PosTerminal>,
  ) {}

  @Post('initialize')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Get payment instructions for a self-service tab (no auth, tracking code required)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['tab_id', 'tracking_code'],
      properties: {
        tab_id: { type: 'string' },
        tracking_code: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Payment instruction details.' })
  async initializePayment(
    @Body() body: { tab_id: string; tracking_code: string },
  ) {
    if (!body.tab_id || !body.tracking_code) {
      throw new BadRequestException('tab_id and tracking_code are required');
    }

    const tab = await this.tabRepo.findOne({ where: { id: body.tab_id } });
    if (!tab) throw new NotFoundException('Tab not found');
    if (tab.tracking_code !== body.tracking_code)
      throw new ForbiddenException('Invalid tracking code');
    if (tab.status !== 'open' && tab.status !== 'billed')
      throw new BadRequestException('Tab is not payable');

    const orders = await this.orderRepo.find({ where: { tab_id: tab.id } });
    if (orders.length === 0) throw new BadRequestException('Tab has no orders');

    const subtotalKobo = orders.reduce((sum, o) => sum + o.subtotal_kobo, 0);
    const serviceChargeKobo = Math.round(subtotalKobo * 0.1);

    let bill = await this.billRepo.findOne({
      where: { tab_id: tab.id, payment_status: 'pending' },
    });
    if (!bill) {
      bill = this.billRepo.create({
        tab_id: tab.id,
        subtotal_kobo: subtotalKobo,
        service_charge_kobo: serviceChargeKobo,
        tax_kobo: 0,
        discount_kobo: 0,
        total_kobo: subtotalKobo + serviceChargeKobo,
        payment_status: 'pending',
        issued_by: 'self-service',
      });
      bill = await this.billRepo.save(bill);
    }

    const activeTerminals = await this.posTerminalRepo.find({
      where: { branch_id: tab.branch_id, is_active: true },
    });

    const paymentMethods: any[] = [];

    const transferTerminal = activeTerminals.find((t) => t.account_number);
    if (transferTerminal) {
      paymentMethods.push({
        type: 'transfer',
        label: transferTerminal.label,
        account_number: transferTerminal.account_number,
      });
    }

    if (activeTerminals.length > 0) {
      paymentMethods.push({
        type: 'pos',
        terminals: activeTerminals.map((t) => ({ id: t.id, label: t.label })),
      });
    }

    paymentMethods.push({ type: 'cash' });

    return {
      bill_id: bill.id,
      tab_id: tab.id,
      amount_kobo: bill.total_kobo,
      amount_formatted: `₦${(bill.total_kobo / 100).toFixed(2)}`,
      payment_methods: paymentMethods,
    };
  }

  @Get('status')
  @ApiOperation({ summary: 'Check payment status for a self-service tab' })
  @ApiQuery({ name: 'tab_id', required: true })
  @ApiQuery({ name: 'tracking_code', required: true })
  @ApiResponse({ status: 200, description: 'Payment status.' })
  async paymentStatus(
    @Query('tab_id') tabId: string,
    @Query('tracking_code') trackingCode: string,
  ) {
    if (!tabId || !trackingCode)
      throw new BadRequestException('tab_id and tracking_code are required');

    const tab = await this.tabRepo.findOne({ where: { id: tabId } });
    if (!tab) throw new NotFoundException('Tab not found');
    if (tab.tracking_code !== trackingCode)
      throw new ForbiddenException('Invalid tracking code');

    const bill = await this.billRepo.findOne({
      where: { tab_id: tabId },
      order: { created_at: 'DESC' },
    });

    return {
      tab_id: tab.id,
      tab_status: tab.status,
      payment_status: bill?.payment_status || 'no_bill',
      paid_at: bill?.paid_at || null,
    };
  }
}
