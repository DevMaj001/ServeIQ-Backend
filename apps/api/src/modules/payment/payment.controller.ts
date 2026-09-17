import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBody,
  ApiHeader,
} from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { Tab } from '../tab/entities/tab.entity';
import { Bill } from '../bill/entities/bill.entity';
import { Order } from '../order/entities/order.entity';
import { PosTerminal } from '../pos/entities/pos-terminal.entity';
import { Branch } from '../branch/entities/branch.entity';
import { Business } from '../business/entities/business.entity';
import { BillService } from '../bill/bill.service';
import { ProcessPaymentDto } from '../bill/dto/process-payment.dto';
import {
  PaymentMethod,
  OrderStatus,
  TabType,
  isBillable,
} from '../../common/shared';
import { PaymentVerificationDto } from './dto/payment-verification.dto';
import {
  buildPaymentMethods,
  PaymentProviderConfig,
} from './payment-provider.util';
import * as crypto from 'crypto';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  private readonly logger = new Logger(PaymentController.name);

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
    @InjectRepository(Business)
    private businessRepo: Repository<Business>,
    private billService: BillService,
  ) {}

  @Post('initialize')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Get payment instructions for a self-service tab or standalone online order group (no auth, tracking code required)',
  })
  @ApiBody({ type: PaymentVerificationDto })
  @ApiResponse({ status: 200, description: 'Payment instruction details.' })
  async initializePayment(@Body() dto: PaymentVerificationDto) {
    if (!dto.tab_id || !dto.tracking_code) {
      throw new BadRequestException('tab_id and tracking_code are required');
    }

    let tabIdKey: string;
    let branchId: string;
    let isTakeaway: boolean;
    let pickupMode: string;
    let deliveryFeeKobo = 0;
    let orders: Order[];

    let tab: Tab | null = null;
    if (UUID_RE.test(dto.tab_id)) {
      tab = await this.tabRepo.findOne({ where: { id: dto.tab_id } });
    }

    if (tab) {
      if (tab.tracking_code !== dto.tracking_code)
        throw new ForbiddenException('Invalid tracking code');
      if (tab.status !== 'open' && tab.status !== 'billed')
        throw new BadRequestException('Tab is not payable');

      // Dine-in is waiter-served only. When the waiter has created a split /
      // payment plan, the guests settle each share with the waiter — the public
      // tracking page must not let a customer self-pay a wholesale amount that
      // bears no relation to the plan (and would create a spurious pending bill).
      if (tab.tab_type === TabType.DINE_IN) {
        const activeSplit = await this.billRepo.findOne({
          where: {
            tab_id: tab.id,
            split_group: Not(IsNull()),
            voided_at: IsNull(),
          },
        });
        if (activeSplit) {
          throw new BadRequestException(
            'This dine-in bill is collected by your waiter — please pay them directly.',
          );
        }
      }

      orders = await this.orderRepo.find({ where: { tab_id: tab.id } });
      if (orders.length === 0)
        throw new BadRequestException('Tab has no orders');
      tabIdKey = tab.id;
      branchId = tab.branch_id;
      isTakeaway = tab.tab_type === TabType.TAKEAWAY;
      pickupMode = tab.pickup_mode;
      if (pickupMode === 'dispatch')
        deliveryFeeKobo = Number(tab.delivery_fee_kobo || 0);
    } else {
      // Standalone (tabless) online order group: the tracking code is the id.
      if (dto.tab_id !== dto.tracking_code) {
        throw new NotFoundException('Order group not found');
      }
      orders = await this.orderRepo.find({
        where: { tracking_code: dto.tracking_code },
      });
      if (orders.length === 0)
        throw new NotFoundException('Order group not found');
      tabIdKey = dto.tracking_code;
      branchId = orders[0].branch_id!;
      isTakeaway = true;
      pickupMode = orders[0].pickup_mode;
      if (pickupMode === 'dispatch')
        deliveryFeeKobo = Number(orders[0].delivery_fee_kobo || 0);
    }

    const billableOrders = orders.filter((o) => isBillable(o.order_status));
    const subtotalKobo = billableOrders.reduce(
      (sum, o) => sum + (o.subtotal_kobo ?? 0),
      0,
    );
    const tabBranch = await this.branchRepo.findOne({
      where: { id: branchId },
    });
    const business = tabBranch
      ? await this.businessRepo.findOne({
          where: { id: tabBranch.business_id },
        })
      : null;
    const serviceChargePercent = Number(business?.service_charge_percent ?? 10);
    const serviceChargeKobo = Math.round(
      subtotalKobo * (serviceChargePercent / 100),
    );

    let bill = tab
      ? await this.billRepo.findOne({
          where: { tab_id: tab.id, payment_status: 'pending' },
        })
      : await this.billRepo.findOne({
          where: {
            tracking_code: dto.tracking_code,
            payment_status: 'pending',
          },
        });
    if (!bill) {
      const paymentReference = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      bill = this.billRepo.create({
        tab_id: tab?.id ?? null,
        tracking_code: tab ? null : dto.tracking_code,
        branch_id: branchId,
        subtotal_kobo: subtotalKobo,
        service_charge_kobo: serviceChargeKobo,
        tax_kobo: 0,
        discount_kobo: 0,
        delivery_fee_kobo: deliveryFeeKobo,
        total_kobo: subtotalKobo + serviceChargeKobo + deliveryFeeKobo,
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
        where: { branch_id: branchId, is_active: true },
      }),
      this.branchRepo.findOne({ where: { id: branchId } }),
    ]);

    const settings = branch?.settings || {};
    const paymentMethods = buildPaymentMethods(
      activeTerminals,
      settings,
      !isTakeaway,
    );

    const currency = business?.currency ?? 'NGN';
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

    return {
      bill_id: bill.id,
      tab_id: tabIdKey,
      amount_kobo: bill.total_kobo,
      amount_formatted: `${symbolMap[currency] ?? currency}${(
        bill.total_kobo / 100
      ).toFixed(2)}`,
      currency,
      payment_reference: bill.payment_reference,
      payment_methods: paymentMethods,
    };
  }

  @Post('cash-intent')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Customer submits intent to pay with cash at the counter. Holds the takeaway order pending supervisor confirmation (no auth, tracking code required).',
  })
  @ApiBody({ type: PaymentVerificationDto })
  @ApiResponse({ status: 200, description: 'Cash intent registered.' })
  async submitCashIntent(@Body() dto: PaymentVerificationDto) {
    if (!dto.tab_id || !dto.tracking_code) {
      throw new BadRequestException('tab_id and tracking_code are required');
    }

    const tab = UUID_RE.test(dto.tab_id)
      ? await this.tabRepo.findOne({ where: { id: dto.tab_id } })
      : null;
    if (!tab) {
      // Standalone (tabless) online order groups are prepaid only.
      if (dto.tab_id === dto.tracking_code) {
        const groupOrder = await this.orderRepo.findOne({
          where: { tracking_code: dto.tracking_code },
        });
        if (groupOrder) {
          throw new BadRequestException(
            'Cash payment is not available for takeaway orders. Please pay with transfer or card.',
          );
        }
      }
      throw new NotFoundException('Tab not found');
    }
    if (tab.tracking_code !== dto.tracking_code)
      throw new ForbiddenException('Invalid tracking code');
    if (tab.status !== 'open' && tab.status !== 'billed')
      throw new BadRequestException('Tab is not payable');
    if (tab.tab_type === TabType.TAKEAWAY)
      throw new BadRequestException(
        'Cash payment is not available for takeaway orders. Please pay with transfer or card.',
      );

    const orders = await this.orderRepo.find({ where: { tab_id: tab.id } });
    if (orders.length === 0) throw new BadRequestException('Tab has no orders');

    const subtotalKobo = orders.reduce((s, o) => s + o.subtotal_kobo, 0);
    const tabBranch = await this.branchRepo.findOne({
      where: { id: tab.branch_id },
    });
    const business = tabBranch
      ? await this.businessRepo.findOne({
          where: { id: tabBranch.business_id },
        })
      : null;
    const serviceChargePercent = Number(business?.service_charge_percent ?? 10);
    const serviceChargeKobo = Math.round(
      subtotalKobo * (serviceChargePercent / 100),
    );
    const deliveryFeeKobo =
      tab.pickup_mode === 'dispatch' ? Number(tab.delivery_fee_kobo || 0) : 0;

    const existingBill = await this.billRepo.findOne({
      where: { tab_id: tab.id },
      order: { created_at: 'DESC' },
    });
    if (existingBill?.paid_at) {
      return {
        tab_id: tab.id,
        payment_status: existingBill.payment_status,
        payment_method: existingBill.payment_method,
        amount_kobo: existingBill.total_kobo,
        amount_formatted: `₦${(existingBill.total_kobo / 100).toFixed(2)}`,
        message: 'Payment already confirmed',
      };
    }

    // Idempotency: if this tab already has a pending-cash request, return the
    // current state instead of re-creating/re-flipping — prevents a customer
    // spamming the button from stacking up duplicate supervisor requests.
    if (
      existingBill?.payment_status === 'pending_cash' &&
      !existingBill.voided_at
    ) {
      return {
        tab_id: tab.id,
        payment_status: existingBill.payment_status,
        payment_method: existingBill.payment_method,
        amount_kobo: existingBill.total_kobo,
        amount_formatted: `₦${(existingBill.total_kobo / 100).toFixed(2)}`,
        message: 'Cash payment request already awaiting confirmation',
      };
    }

    let bill = existingBill;
    if (!bill) {
      const paymentReference = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      bill = this.billRepo.create({
        tab_id: tab.id,
        subtotal_kobo: subtotalKobo,
        service_charge_kobo: serviceChargeKobo,
        tax_kobo: 0,
        discount_kobo: 0,
        delivery_fee_kobo: deliveryFeeKobo,
        total_kobo: subtotalKobo + serviceChargeKobo + deliveryFeeKobo,
        payment_status: 'pending_cash',
        payment_method: PaymentMethod.CASH,
        issued_by: 'self-service',
        payment_reference: paymentReference,
      });
    } else {
      bill.payment_method = PaymentMethod.CASH;
      bill.payment_status = 'pending_cash';
      bill.delivery_fee_kobo = deliveryFeeKobo;
      bill.total_kobo =
        bill.subtotal_kobo +
        bill.service_charge_kobo -
        (bill.discount_kobo ?? 0) +
        deliveryFeeKobo;
    }
    bill = await this.billRepo.save(bill);

    // Hold takeaway orders pending cash confirmation at the counter. Orders already
    // being prepared (APPROVED+) are left untouched; only pre-kitchen orders are held.
    await this.orderRepo
      .createQueryBuilder()
      .update(Order)
      .set({ order_status: OrderStatus.PENDING_PAYMENT_APPROVAL })
      .where('tab_id = :tabId', { tabId: tab.id })
      .andWhere('order_status = :s', {
        s: OrderStatus.PENDING_SUPERVISOR_APPROVAL,
      })
      .execute();

    return {
      tab_id: tab.id,
      payment_status: bill.payment_status,
      payment_method: bill.payment_method,
      amount_kobo: bill.total_kobo,
      amount_formatted: `₦${(bill.total_kobo / 100).toFixed(2)}`,
      message: 'Waiting for cash confirmation at the counter',
    };
  }

  // ─── Webhook Endpoints ───

  @Post(['webhooks/monniepoint', 'webhooks/moniepoint'])
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Moniepoint POS transaction webhook' })
  @ApiHeader({
    name: 'x-moniepoint-signature',
    required: true,
    description: 'HMAC signature',
  })
  async monniepointWebhook(
    @Req() req: Request,
    @Headers('x-moniepoint-signature') signature: string,
    @Body() payload: any,
  ) {
    // Moniepoint/Monnify wrap transaction details in `eventData` and mark a
    // successful payment with `eventType: SUCCESSFUL_TRANSACTION` and
    // `paymentStatus: PAID`. Accept all known shapes (`eventData`, `data`,
    // or the flat object) so a real POS deposit is never silently dropped.
    const eventData = payload?.eventData || payload?.data || payload || {};
    const reference =
      eventData.reference ||
      eventData.paymentReference ||
      eventData.transactionReference ||
      eventData.product?.reference ||
      eventData.merchantReference;
    const rawStatus =
      payload?.eventType ||
      eventData.paymentStatus ||
      eventData.status ||
      eventData.eventType ||
      '';
    const isSuccess = /SUCCESS|PAID/.test(String(rawStatus).toUpperCase());
    const amount =
      eventData.amountPaid ?? eventData.totalPayable ?? eventData.amount;
    const terminalId =
      eventData.terminalId ||
      eventData.terminal_id ||
      eventData.terminalSerial ||
      eventData.posTerminalId ||
      eventData.terminal;
    const account_number =
      eventData.destinationAccountInformation?.accountNumber ||
      eventData.account_number ||
      eventData.accountNumber ||
      (Array.isArray(eventData.paymentSourceInformation) &&
        eventData.paymentSourceInformation[0]?.accountNumber);
    if (!reference || !amount || !isSuccess) {
      return { received: true };
    }
    this.logger.log(
      `[monniepoint][arrive] ref=${reference} amount=${amount} status=${rawStatus} terminal=${terminalId} account=${account_number}`,
    );

    // Resolve the bill first (reference, else branch-scoped amount). We must
    // have a real target before enforcing provider config/signature so that
    // unknown references return gracefully instead of throwing.
    const resolved = await this.resolveWebhookBill({
      reference,
      amount,
      terminalId,
      accountNumber: account_number,
      provider: 'monniepoint',
    });
    if (!resolved) {
      this.logger.warn(
        `[monniepoint][unresolved] no bill/branch for ref=${reference} terminal=${terminalId} account=${account_number}`,
      );
      return { received: true, error: 'Bill not found' };
    }
    const { bill, tab, branch } = resolved;
    this.logger.log(
      `[monniepoint][resolved] bill=${bill?.id} tab=${tab?.id ?? '(standalone)'} branch=${branch?.id}`,
    );

    const providerConfig = branch
      ? this.findProviderConfig(branch.settings, 'monniepoint')
      : null;
    const isTestSimulation = this.isTestSimulation(req);

    if (!isTestSimulation && !providerConfig) {
      this.logger.warn(
        `[monniepoint][misconfig] branch=${branch?.id} has no monniepoint provider configured`,
      );
      throw new ForbiddenException('Moniepoint webhook not configured');
    }

    if (
      !isTestSimulation &&
      providerConfig?.verification_method === 'hmac-sha512'
    ) {
      const secret =
        providerConfig.config?.webhook_secret || providerConfig.config?.secret;
      if (!secret) {
        this.logger.warn(
          `[monniepoint][misconfig] branch=${branch?.id} configured hmac-sha512 but has no webhook_secret`,
        );
        throw new ForbiddenException(
          'Moniepoint webhook secret not configured',
        );
      }
      if (!this.verifyMoniepointSignature(req, payload, signature, secret)) {
        this.logger.warn(
          `[monniepoint][bad-signature] branch=${branch?.id} signature rejected against configured secret`,
        );
        throw new ForbiddenException('Invalid Moniepoint signature');
      }
      this.logger.log(`[monniepoint][verified] signature ok for branch=${branch?.id}`);
    }

    if (bill.paid_at) return { received: true, status: 'already_paid' };

    // Normalize the provider's amount (naira or kobo) to kobo against the
    // bill's known total before settling.
    const amountKobo = this.normalizeAmountToKobo(amount, bill.total_kobo);
    if (amountKobo === null) {
      this.logger.warn(
        `[monniepoint][amount-mismatch] sent=${amount} bill_total=${bill.total_kobo}`,
      );
      return { received: true, error: 'Amount mismatch' };
    }

    this.logger.log(
      `[monniepoint][settle] bill=${bill.id} amountKobo=${amountKobo} method=POS ref=${reference}`,
    );
    return this.routeWebhookPayment({
      bill,
      tab,
      reference,
      amount: amountKobo,
      method: PaymentMethod.POS,
      terminalId,
      idempotencyKey: `monniepoint-${reference}`,
    });
  }

  @Post('webhooks/opay')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'OPay transfer/POS webhook' })
  @ApiHeader({
    name: 'x-opay-signature',
    required: true,
    description: 'OPay signature',
  })
  async opayWebhook(
    @Req() req: Request,
    @Headers('x-opay-signature') signature: string,
    @Body() payload: any,
  ) {
    const { reference, amount, status, transactionType, account_number } =
      payload?.data || payload;
    if (!reference || !amount || status !== 'SUCCESS') {
      return { received: true };
    }

    const resolved = await this.resolveWebhookBill({
      reference,
      amount,
      accountNumber: account_number,
      provider: 'opay',
    });
    if (!resolved) {
      return { received: true, error: 'Bill not found' };
    }
    const { bill, tab, branch } = resolved;

    const providerConfig = branch
      ? this.findProviderConfig(branch.settings, 'opay')
      : null;
    const isTestSimulation = this.isTestSimulation(req);

    if (
      !isTestSimulation &&
      (!providerConfig || providerConfig.verification_method !== 'rsa')
    ) {
      throw new ForbiddenException('OPay webhook not configured');
    }

    if (
      !isTestSimulation &&
      providerConfig &&
      providerConfig.verification_method === 'rsa'
    ) {
      const publicKey =
        providerConfig.config?.public_key || providerConfig.config?.publicKey;
      const rawBody: Buffer = (req as any).rawBody
        ? Buffer.from((req as any).rawBody)
        : Buffer.from(JSON.stringify(payload));
      if (
        !publicKey ||
        !this.verifyRsaSignature(rawBody, signature, publicKey)
      ) {
        throw new ForbiddenException('Invalid OPay signature');
      }
    }

    if (bill.paid_at) return { received: true, status: 'already_paid' };

    const amountKobo = this.normalizeAmountToKobo(amount, bill.total_kobo);
    if (amountKobo === null) {
      return { received: true, error: 'Amount mismatch' };
    }

    const method =
      transactionType === 'POS' ? PaymentMethod.POS : PaymentMethod.TRANSFER;
    return this.routeWebhookPayment({
      bill,
      tab,
      reference,
      amount: amountKobo,
      method,
      terminalId: undefined,
      idempotencyKey: `opay-${reference}`,
    });
  }

  /** Test mode: a dev-only header that bypasses provider signature
   *  verification so the sandbox "Simulate Payment" works before real
   *  keys are configured. Shared by both webhook paths.
   *  Hard-disabled in production regardless of headers. */
  private isTestSimulation(req: Request): boolean {
    if (process.env.NODE_ENV === 'production') {
      return false;
    }
    return req.headers['x-simulate'] === '1';
  }

  /** Route an already-verified webhook payment to the bill settlement path.
   *
   *  Every webhook settles the tab's single full-tab bill (processPayment).
   *  Split-bill routing was removed with the split-billing feature. */
  private async routeWebhookPayment(params: {
    bill: Bill;
    tab: Tab | null;
    reference: string;
    amount: number;
    method: PaymentMethod;
    terminalId?: string;
    idempotencyKey: string;
  }): Promise<{ received: boolean; error?: string; status?: string }> {
    const { bill, tab, reference, amount, method, terminalId, idempotencyKey } =
      params;

    const dto: ProcessPaymentDto = {
      method,
      amount,
      reference,
      ...(terminalId ? { terminal_id: terminalId } : {}),
      idempotency_key: idempotencyKey,
    };

    await this.billService.processPayment(
      tab?.id ?? null,
      (tab?.branch_id ?? bill.branch_id) as string,
      'system-webhook',
      'owner',
      dto,
      { bill },
    );

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

  private safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a || '');
    const bb = Buffer.from(b || '');
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
  }

  /** Verify a Moniepoint webhook signature against a raw body (not re-serialized
   *  JSON) so the digest matches exactly what the provider signed. Accepts both
   *  the simple HMAC-SHA512(hex) over the raw body and Moniepoint's documented
   *  HMAC-SHA256(base64) over `${webhookId}__${timestamp}__${rawBody}`, depending
   *  on which dashboard/integration is used. */
  private verifyMoniepointSignature(
    req: Request,
    payload: any,
    signature: string,
    secret: string,
  ): boolean {
    const sig =
      signature ||
      String(req.headers['moniepoint-webhook-signature'] || '') ||
      String(req.headers['monniepoint-webhook-signature'] || '') ||
      String(req.headers['monnify-signature'] || '') ||
      String(req.headers['x-monnify-signature'] || '');
    if (!sig) return false;
    const rawBody: Buffer = (req as any).rawBody
      ? Buffer.from((req as any).rawBody)
      : Buffer.from(JSON.stringify(payload));

    const hmacSha512 = crypto
      .createHmac('sha512', secret)
      .update(rawBody)
      .digest('hex');
    if (this.safeEqual(sig.replace(/^sha512=/i, ''), hmacSha512)) return true;

    const webhookId = req.headers['moniepoint-webhook-id'];
    const timestamp = req.headers['moniepoint-webhook-timestamp'];
    if (webhookId && timestamp) {
      const signed = `${webhookId}__${timestamp}__${rawBody.toString('utf8')}`;
      const hmacSha256 = crypto
        .createHmac('sha256', secret)
        .update(signed)
        .digest('base64');
      if (this.safeEqual(sig, hmacSha256)) return true;
    }
    return false;
  }

  /** Convert a provider webhook amount (naira or kobo) to kobo using the bill's
   *  known total as ground truth. Returns null when neither interpretation
   *  matches, which lets callers reject amount mismatches safely. */
  private normalizeAmountToKobo(
    amount: any,
    billTotalKobo: number,
  ): number | null {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return null;
    const asKobo = Math.round(n);
    const asNairaToKobo = Math.round(n * 100);
    if (asKobo === billTotalKobo) return asKobo;
    if (asNairaToKobo === billTotalKobo) return asNairaToKobo;
    return null;
  }

  /** Map a deposited account number to the branch that configured it as a
   *  payment provider (or POS transfer) account. Used to scope transfer
   *  webhooks to a branch when the provider reference does not match a bill. */
  private async findBranchByAccount(account: string): Promise<Branch | null> {
    if (!account) return null;
    const branches = await this.branchRepo.find();
    for (const branch of branches) {
      const providers = Array.isArray(branch.settings?.payment_providers)
        ? branch.settings.payment_providers
        : [];
      for (const p of providers) {
        const acc =
          p?.config?.account_number ||
          p?.config?.accountNumber ||
          p?.config?.account;
        if (acc && String(acc) === String(account)) return branch;
      }
    }
    return null;
  }

  /** Resolve the branch a webhook concerns, preferring explicit identifiers in
   *  the payload over a reference round-trip: terminal id, then deposit account
   *  number, then payment reference. Returns null when nothing can be resolved.
   *
   *  pos_terminals.id is a uuid, so a provider terminal id (e.g. Moniepoint's
   *  "3A000001") can only be looked up once. When it isn't a uuid, match the
   *  terminal by its label instead of crashing with Postgres 22P02. */
  private async resolveWebhookBranch(opts: {
    provider: 'monniepoint' | 'opay';
    reference?: string;
    terminalId?: string;
    accountNumber?: string;
  }): Promise<Branch | null> {
    if (opts.terminalId) {
      let term: PosTerminal | null = null;
      if (UUID_RE.test(opts.terminalId)) {
        term = await this.posTerminalRepo.findOne({
          where: { id: opts.terminalId },
        });
      }
      if (!term) {
        term = await this.posTerminalRepo.findOne({
          where: { label: opts.terminalId },
        });
      }
      if (term) {
        const b = await this.branchRepo.findOne({
          where: { id: term.branch_id },
        });
        if (b) return b;
      }
    }
    if (opts.accountNumber) {
      const byAccount = await this.findBranchByAccount(opts.accountNumber);
      if (byAccount) return byAccount;
    }
    if (opts.reference) {
      const bill = await this.billRepo.findOne({
        where: { payment_reference: opts.reference },
      });
      if (bill) {
        const tab = bill.tab_id
          ? await this.tabRepo.findOne({ where: { id: bill.tab_id } })
          : null;
        if (tab) {
          return this.branchRepo.findOne({ where: { id: tab.branch_id } });
        }
        // Standalone (tabless) online orders record the branch on the bill.
        if (bill.branch_id) {
          return this.branchRepo.findOne({ where: { id: bill.branch_id } });
        }
      }
    }
    return null;
  }

  /** Locate the bill a webhook should settle.
   *
   *  Primary path: exact payment_reference match (used when the reference is
   *  known to the provider, e.g. entered on a POS terminal).
   *
   *  Fallback for transfers: the provider sends its own transaction reference,
   *  so match by branch + exact amount. Only auto-confirms when there is exactly
   *  one unsettled bill with that total in the branch, avoiding ambiguous or
   *  incorrect settlements. */
  private async resolveWebhookBill(opts: {
    reference?: string;
    amount: any;
    provider: 'monniepoint' | 'opay';
    terminalId?: string;
    accountNumber?: string;
  }): Promise<{ bill: Bill; tab: Tab | null; branch: Branch | null } | null> {
    if (opts.reference) {
      const bill = await this.billRepo.findOne({
        where: { payment_reference: opts.reference },
      });
      if (bill) {
        const tab = bill.tab_id
          ? await this.tabRepo.findOne({ where: { id: bill.tab_id } })
          : null;
        if (!tab && bill.branch_id) {
          const branch = await this.branchRepo.findOne({
            where: { id: bill.branch_id },
          });
          return { bill, tab: null, branch };
        }
        if (tab) {
          const branch = await this.branchRepo.findOne({
            where: { id: tab.branch_id },
          });
          return { bill, tab, branch };
        }
      }
    }

    const branch = await this.resolveWebhookBranch({
      provider: opts.provider,
      reference: opts.reference,
      terminalId: opts.terminalId,
      accountNumber: opts.accountNumber,
    });
    if (!branch) return null;

    const candidateBills = await this.billRepo
      .createQueryBuilder('bill')
      .where(
        'COALESCE(bill.branch_id, (SELECT t.branch_id FROM tabs t WHERE t.id = bill.tab_id)) = :branchId',
        { branchId: branch.id },
      )
      .andWhere('bill.voided_at IS NULL')
      .andWhere('bill.paid_at IS NULL')
      .orderBy('bill.created_at', 'DESC')
      .getMany();
    const matches = candidateBills.filter(
      (c) => this.normalizeAmountToKobo(opts.amount, c.total_kobo) !== null,
    );
    if (matches.length !== 1) return null;

    const bill = matches[0];
    const tab = bill.tab_id
      ? await this.tabRepo.findOne({ where: { id: bill.tab_id } })
      : null;
    return { bill, tab, branch };
  }

  private verifyRsaSignature(
    rawBody: Buffer,
    signature: string,
    publicKey: string,
  ): boolean {
    if (!signature || !publicKey) return false;
    try {
      return crypto.verify(
        'RSA-SHA256',
        rawBody,
        publicKey,
        Buffer.from(signature, 'base64'),
      );
    } catch {
      return false;
    }
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

    if (!UUID_RE.test(tabId)) {
      // Standalone (tabless) online order group: the "tab id" is the tracking
      // code. Only query the tab table for real uuids, otherwise Postgres
      // raises 22P02 casting the code to uuid.
      const groupOrder = await this.orderRepo.findOne({
        where: { tracking_code: trackingCode },
      });
      if (!groupOrder) throw new NotFoundException('Tab not found');

      const bill = await this.billRepo.findOne({
        where: { tracking_code: trackingCode },
        order: { created_at: 'DESC' },
      });

      return {
        tab_id: tabId,
        tab_status: bill?.paid_at ? 'paid' : 'open',
        payment_status: bill?.payment_status || 'no_bill',
        payment_method: bill?.payment_method || null,
        paid_at: bill?.paid_at || null,
      };
    }

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
      payment_method: bill?.payment_method || null,
      paid_at: bill?.paid_at || null,
    };
  }
}
