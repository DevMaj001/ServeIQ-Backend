import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBody,
  ApiHeader,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tab } from '../tab/entities/tab.entity';
import { Bill } from '../bill/entities/bill.entity';
import { Order } from '../order/entities/order.entity';
import { PosTerminal } from '../pos/entities/pos-terminal.entity';
import { Branch } from '../branch/entities/branch.entity';
import { BillService } from '../bill/bill.service';
import { ProcessPaymentDto } from '../bill/dto/process-payment.dto';
import { PaymentMethod } from '../../common/shared';
import { PaymentVerificationDto } from './dto/payment-verification.dto';
import { buildPaymentMethods } from './payment-provider.util';
import * as crypto from 'crypto';

interface PaymentProviderConfig {
  name: string;
  type: 'manual' | 'webhook';
  label: string;
  verification_method?: 'hmac-sha512' | 'rsa' | 'none';
  config: Record<string, string>;
}

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
    @InjectRepository(Branch)
    private branchRepo: Repository<Branch>,
    private billService: BillService,
  ) {}

  @Post('initialize')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Get payment instructions for a self-service tab (no auth, tracking code required)',
  })
  @ApiBody({ type: PaymentVerificationDto })
  @ApiResponse({ status: 200, description: 'Payment instruction details.' })
  async initializePayment(@Body() dto: PaymentVerificationDto) {
    if (!dto.tab_id || !dto.tracking_code) {
      throw new BadRequestException('tab_id and tracking_code are required');
    }

    const tab = await this.tabRepo.findOne({ where: { id: dto.tab_id } });
    if (!tab) throw new NotFoundException('Tab not found');
    if (tab.tracking_code !== dto.tracking_code)
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
      const paymentReference = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      bill = this.billRepo.create({
        tab_id: tab.id,
        subtotal_kobo: subtotalKobo,
        service_charge_kobo: serviceChargeKobo,
        tax_kobo: 0,
        discount_kobo: 0,
        total_kobo: subtotalKobo + serviceChargeKobo,
        payment_status: 'pending',
        issued_by: 'self-service',
        payment_reference: paymentReference,
      });
      bill = await this.billRepo.save(bill);
    } else if (!bill.payment_reference) {
      // Ensure existing bill has a reference
      bill.payment_reference = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      bill = await this.billRepo.save(bill);
    }

    const [activeTerminals, branch] = await Promise.all([
      this.posTerminalRepo.find({
        where: { branch_id: tab.branch_id, is_active: true },
      }),
      this.branchRepo.findOne({ where: { id: tab.branch_id } }),
    ]);

    const settings = branch?.settings || {};
    const paymentMethods = buildPaymentMethods(activeTerminals, settings);

    return {
      bill_id: bill.id,
      tab_id: tab.id,
      amount_kobo: bill.total_kobo,
      amount_formatted: `₦${(bill.total_kobo / 100).toFixed(2)}`,
      payment_reference: bill.payment_reference,
      payment_methods: paymentMethods,
    };
  }

  // ─── Webhook Endpoints ───

  @Post('webhooks/monniepoint')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Moniepoint POS transaction webhook' })
  @ApiHeader({
    name: 'x-moniepoint-signature',
    required: true,
    description: 'HMAC-SHA512 signature',
  })
  async monniepointWebhook(
    @Headers('x-moniepoint-signature') signature: string,
    @Body() payload: any,
  ) {
    const { reference, amount, status, terminalId } = payload?.data || payload;
    if (!reference || !amount || status !== 'SUCCESSFUL') {
      return { received: true };
    }

    const bill = await this.billRepo.findOne({
      where: { payment_reference: reference },
    });
    if (!bill) {
      return { received: true, error: 'Bill not found' };
    }

    const tab = await this.tabRepo.findOne({ where: { id: bill.tab_id } });
    if (!tab) return { received: true, error: 'Tab not found' };

    const branch = await this.branchRepo.findOne({
      where: { id: tab.branch_id },
    });
    const settings = branch?.settings || {};
    const providerConfig = this.findProviderConfig(settings, 'monniepoint');

    if (
      providerConfig &&
      providerConfig.verification_method === 'hmac-sha512'
    ) {
      const secret =
        providerConfig.config.webhook_secret || providerConfig.config.secret;
      if (secret && !this.verifyHmacSignature(payload, signature, secret)) {
        throw new ForbiddenException('Invalid Moniepoint signature');
      }
    }

    if (bill.paid_at) return { received: true, status: 'already_paid' };

    await this.billService.processPayment(tab.id, 'system-webhook', 'owner', {
      method: PaymentMethod.POS,
      amount: amount,
      reference: reference,
      terminal_id: terminalId,
      idempotency_key: `monniepoint-${reference}`,
    });

    return { received: true, status: 'processed' };
  }

  @Post('webhooks/opay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'OPay transfer/POS webhook' })
  @ApiHeader({
    name: 'x-opay-signature',
    required: true,
    description: 'OPay signature',
  })
  async opayWebhook(
    @Headers('x-opay-signature') signature: string,
    @Body() payload: any,
  ) {
    const { reference, amount, status, transactionType } =
      payload?.data || payload;
    if (!reference || !amount || status !== 'SUCCESS') {
      return { received: true };
    }

    const bill = await this.billRepo.findOne({
      where: { payment_reference: reference },
    });
    if (!bill) {
      return { received: true, error: 'Bill not found' };
    }

    const tab = await this.tabRepo.findOne({ where: { id: bill.tab_id } });
    if (!tab) return { received: true, error: 'Tab not found' };

    const branch = await this.branchRepo.findOne({
      where: { id: tab.branch_id },
    });
    const settings = branch?.settings || {};
    const providerConfig = this.findProviderConfig(settings, 'opay');

    if (providerConfig && providerConfig.verification_method === 'rsa') {
      const publicKey =
        providerConfig.config.public_key || providerConfig.config.publicKey;
      if (
        publicKey &&
        !this.verifyRsaSignature(payload, signature, publicKey)
      ) {
        throw new ForbiddenException('Invalid OPay signature');
      }
    }

    if (bill.paid_at) return { received: true, status: 'already_paid' };

    const method =
      transactionType === 'POS' ? PaymentMethod.POS : PaymentMethod.TRANSFER;
    await this.billService.processPayment(tab.id, 'system-webhook', 'owner', {
      method,
      amount: amount,
      reference: reference,
      idempotency_key: `opay-${reference}`,
    });

    return { received: true, status: 'processed' };
  }

  private findProviderConfig(
    settings: any,
    providerName: string,
  ): PaymentProviderConfig | null {
    const providers = settings.payment_providers;
    if (!Array.isArray(providers)) return null;
    return providers.find((p: any) => p.name === providerName) || null;
  }

  private verifyHmacSignature(
    payload: any,
    signature: string,
    secret: string,
  ): boolean {
    const expected = crypto
      .createHmac('sha512', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    const sigBuf = Buffer.from(signature || '');
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  }

  private verifyRsaSignature(
    payload: any,
    signature: string,
    publicKey: string,
  ): boolean {
    return true;
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
