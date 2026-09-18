import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  EncryptionService,
  ENC_PREFIX,
} from '../../common/services/encryption.service';
import {
  MoniepointChannelClient,
  MoniepointChannelClientConfig,
} from './moniepoint-channel.client';
import { MoniepointErpCredential } from './entities/moniepoint-erp-credential.entity';
import {
  MoniepointErpPush,
  MoniepointErpPushStatus,
} from './entities/moniepoint-erp-push.entity';
import { PosTerminal } from '../pos/entities/pos-terminal.entity';
import { Bill } from '../bill/entities/bill.entity';

/** The Channel/ERP API is served from a single base URL; the environment
 *  (SANDBOX|PROD) is declared by which credential is used, not the host. */
export const MONIEPOINT_CHANNEL_BASE_URL = 'https://channel.moniepoint.com';

export interface EnrollMoniepointErpDto {
  clientId: string;
  clientSecret: string;
  environment?: 'SANDBOX' | 'PROD';
  isActive?: boolean;
}

export interface UpdateMoniepointErpDto {
  clientSecret?: string;
  environment?: 'SANDBOX' | 'PROD';
  isActive?: boolean;
}

export interface MoniepointErpCredentialView {
  id: string;
  branchId: string;
  environment: 'SANDBOX' | 'PROD';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Push request as accepted by the service. `merchantReference` is optional
 *  because a linked bill provides it (bill payment reference). */
export interface PushPaymentInput {
  terminalSerial: string;
  amount: number;
  merchantReference?: string;
  transactionType?: 'PURCHASE';
  paymentMethod?: 'CARD_PURCHASE' | 'POS_TRANSFER' | 'ANY';
}

export interface MoniepointErpPushView {
  id: string;
  billId: string | null;
  merchantReference: string;
  terminalSerial: string;
  amountKobo: number;
  status: MoniepointErpPushStatus;
  error: string | null;
  pushedAt: Date;
  paidAt: Date | null;
  /** True when the push was already recorded and is returned without re-invoking the API. */
  duplicate?: boolean;
  /** Live "has the linked bill been settled by the webhook yet?" flag. */
  settled?: boolean;
}

const REF_COUNTER_RE_FALLBACK = (attempts: number) => attempts + 1;

/**
 * Per-tenant Moniepoint ERP credential resolver + push tracker.
 *
 * Each branch connects its OWN Moniepoint credential (multi-tenant ERP
 * integration). The client secret is stored ENCRYPTED (EncryptionService) and
 * is decrypted only inside this service to build a per-branch
 * MoniepointChannelClient. The secret is never returned by any read path.
 *
 * Pushes are persisted in `moniepoint_erp_pushes` for idempotency and
 * reconciliation. When linked to a bill, the merchant reference is the bill's
 * `payment_reference` so the existing Moniepoint webhook settlement path
 * resolves the bill when the guest completes the transaction. A terminated
 * push (declined/expired) with the same reference cannot be re-pushed —
 * Moniepoint treats the reference as used — so retries derive a suffixed
 * reference from the bill. The reconciliation scheduler turns the rows into
 * paid/declined/expired states from the POS events feed.
 *
 * Scope discipline: every method requires branchId AND businessId so a tenant
 * can never touch another tenant's credential or push history.
 */
@Injectable()
export class MoniepointErpService {
  private readonly logger = new Logger(MoniepointErpService.name);

  constructor(
    @InjectRepository(MoniepointErpCredential)
    private readonly credentialRepository: Repository<MoniepointErpCredential>,
    @InjectRepository(MoniepointErpPush)
    private readonly pushRepository: Repository<MoniepointErpPush>,
    @InjectRepository(PosTerminal)
    private readonly terminalRepository: Repository<PosTerminal>,
    @InjectRepository(Bill)
    private readonly billRepository: Repository<Bill>,
    private readonly encryptionService: EncryptionService,
  ) {}

  /** Enroll the branch's Moniepoint credential (creates or replaces). */
  async upsertCredential(
    businessId: string,
    branchId: string,
    dto: EnrollMoniepointErpDto,
  ): Promise<MoniepointErpCredentialView> {
    if (!dto.clientId?.trim() || !dto.clientSecret?.trim()) {
      throw new BadRequestException(
        'clientId and clientSecret are required to enroll a Moniepoint ERP credential',
      );
    }
    const secretEnc = this.encryptionService.encrypt(dto.clientSecret);
    if (!secretEnc) {
      throw new BadRequestException('clientSecret could not be encrypted');
    }

    const existing = await this.credentialRepository.findOne({
      where: { branch_id: branchId },
    });
    const credential =
      existing ??
      this.credentialRepository.create({
        branch_id: branchId,
        business_id: businessId,
      });

    credential.business_id = businessId;
    credential.client_id = dto.clientId.trim();
    credential.client_secret_enc = secretEnc;
    credential.environment = dto.environment ?? 'SANDBOX';
    credential.is_active = dto.isActive ?? true;

    const saved = await this.credentialRepository.save(credential);
    return this.toView(saved);
  }

  /** Read the branch's credential WITHOUT the secret (for status screens). */
  async getCredential(
    businessId: string,
    branchId: string,
  ): Promise<MoniepointErpCredentialView | null> {
    const credential = await this.findScoped(businessId, branchId);
    return credential ? this.toView(credential) : null;
  }

  /** Rotate the secret / change environment / activate without replacing clientId. */
  async updateCredential(
    businessId: string,
    branchId: string,
    dto: UpdateMoniepointErpDto,
  ): Promise<MoniepointErpCredentialView> {
    const credential = await this.findScoped(businessId, branchId);
    if (!credential) {
      throw new NotFoundException(
        'No Moniepoint ERP credential enrolled for this branch',
      );
    }

    if (dto.clientSecret !== undefined) {
      if (!String(dto.clientSecret).trim()) {
        throw new BadRequestException('clientSecret cannot be empty');
      }
      const secretEnc = this.encryptionService.encrypt(dto.clientSecret);
      if (!secretEnc) {
        throw new BadRequestException('clientSecret could not be encrypted');
      }
      credential.client_secret_enc = secretEnc;
    }
    if (dto.environment !== undefined) {
      credential.environment = dto.environment;
    }
    if (dto.isActive !== undefined) {
      credential.is_active = dto.isActive;
    }

    const saved = await this.credentialRepository.save(credential);
    return this.toView(saved);
  }

  /** Resolve a branch-bound Channel client, or null when not enrolled. */
  async resolveClient(
    businessId: string,
    branchId: string,
  ): Promise<MoniepointChannelClient | null> {
    const credential = await this.findScoped(businessId, branchId);
    if (!credential || !credential.is_active) return null;

    const clientSecret = this.encryptionService.decrypt(
      credential.client_secret_enc,
    );
    // decrypt() returns the raw value unchanged when the value isn't `enc:v1:`
    // prefixed OR when decryption fails — a still-prefixed result means the
    // stored ciphertext could not be decrypted.
    if (!clientSecret || clientSecret.startsWith(ENC_PREFIX)) {
      this.logger.warn(
        `Branch ${branchId} credential secret is not decryptable (bad ciphertext). Re-enroll to fix.`,
      );
      throw new ConflictException(
        'Moniepoint ERP credential secret is corrupted — re-enroll the credential',
      );
    }

    return new MoniepointChannelClient(
      this.toClientConfig(credential.client_id, clientSecret),
    );
  }

  /**
   * Push a payment request to a branch's terminal via its own Moniepoint
   * credential, persisting a push row for reconciliation.
   *
   * Tenant isolation: the terminal serial must belong to the requesting
   * branch (a tenant can never push to another tenant's terminal).
   *
   * Idempotency: pushing the same merchant reference twice returns the
   * existing pending/paid push without re-invoking the API. A terminated push
   * refuses to reuse the burnt reference (or derives a suffixed retry
   * reference when the push is linked to a bill).
   */
  async pushPayment(
    businessId: string,
    branchId: string,
    request: PushPaymentInput,
    options: { billId?: string } = {},
  ): Promise<MoniepointErpPushView> {
    const client = await this.resolveClient(businessId, branchId);
    if (!client) {
      throw new NotFoundException(
        'This branch has no active Moniepoint ERP credential — enroll one before pushing payments',
      );
    }

    const serial = String(request.terminalSerial ?? '').trim();
    if (!serial) {
      throw new BadRequestException('terminalSerial is required');
    }
    const terminal = await this.terminalRepository.findOne({
      where: { branch_id: branchId, serial_number: serial },
    });
    if (!terminal || !terminal.is_active) {
      throw new NotFoundException(
        `No active POS terminal with serial "${serial}" belongs to this branch`,
      );
    }

    const { bill, baseRef } = await this.resolveBillContext(
      branchId,
      request,
      options.billId,
    );

    // Dedup loop: reuse a pending/paid push, or derive a fresh retry
    // reference when the previous one is burnt server-side.
    let reference = baseRef;
    for (;;) {
      const existing = await this.pushRepository.findOne({
        where: { branch_id: branchId, merchant_reference: reference },
      });
      if (!existing) break;
      if (existing.status === 'pending' || existing.status === 'paid') {
        return this.toPushView(existing, { duplicate: true });
      }
      if (!bill?.payment_reference) {
        throw new ConflictException(
          'Merchant reference was already used for this tenant and cannot be re-pushed — provide a new merchantReference',
        );
      }
      const attempts = await this.pushRepository.count({
        where: { branch_id: branchId, bill_id: bill.id },
      });
      reference = `${bill.payment_reference}-R${REF_COUNTER_RE_FALLBACK(
        attempts,
      )}`;
    }

    await client.pushPayment({
      terminalSerial: serial,
      amount: request.amount,
      merchantReference: reference,
      transactionType: 'PURCHASE',
      paymentMethod: request.paymentMethod,
    });

    const row = this.pushRepository.create({
      business_id: businessId,
      branch_id: branchId,
      bill_id: bill?.id ?? null,
      merchant_reference: reference,
      terminal_serial: serial,
      amount_kobo: Math.round(request.amount),
      status: 'pending',
      paid_at: null,
    });
    const saved = await this.pushRepository.save(row);
    return this.toPushView(saved);
  }

  /** Branch-scoped push history (latest first). Optional bill/status filters. */
  async listPushes(
    businessId: string,
    branchId: string,
    filter: { billId?: string; status?: string } = {},
  ): Promise<MoniepointErpPushView[]> {
    const where: Record<string, any> = {
      business_id: businessId,
      branch_id: branchId,
    };
    if (filter.billId) where.bill_id = filter.billId;
    const status = String(filter.status ?? '').trim();
    if (
      status === 'pending' ||
      status === 'paid' ||
      status === 'declined' ||
      status === 'expired' ||
      status === 'cancelled'
    ) {
      where.status = status;
    }

    const rows = await this.pushRepository.find({
      where,
      order: { pushed_at: 'DESC' },
      take: 100,
    });

    const billIds = rows
      .map((r) => r.bill_id)
      .filter((id): id is string => Boolean(id));
    const bills = billIds.length
      ? await this.billRepository.find({ where: { id: In(billIds) } })
      : [];
    const paidByBill = new Map(bills.map((b) => [b.id, Boolean(b.paid_at)]));

    return rows.map((r) =>
      this.toPushView(r, {
        settled: r.bill_id ? (paidByBill.get(r.bill_id) ?? false) : undefined,
      }),
    );
  }

  private async resolveBillContext(
    branchId: string,
    request: PushPaymentInput,
    billId?: string,
  ): Promise<{ bill: Bill | null; baseRef: string }> {
    if (billId) {
      const bill = await this.billRepository.findOne({
        where: { id: billId },
      });
      if (!bill || bill.branch_id !== branchId) {
        throw new NotFoundException('Bill not found for this branch');
      }
      if (bill.paid_at) {
        throw new BadRequestException(
          'Cannot push a payment for an already-paid bill',
        );
      }
      if (!bill.payment_reference) {
        bill.payment_reference = `PAY-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 8)
          .toUpperCase()}`;
        await this.billRepository.save(bill);
      }
      return { bill, baseRef: bill.payment_reference };
    }
    const ref = String(request.merchantReference ?? '').trim();
    if (!ref) {
      throw new BadRequestException(
        'merchantReference is required when no billId is provided',
      );
    }
    return { bill: null, baseRef: ref };
  }

  private toClientConfig(
    clientId: string,
    clientSecret: string,
  ): MoniepointChannelClientConfig {
    return {
      baseUrl: MONIEPOINT_CHANNEL_BASE_URL,
      clientId,
      clientSecret,
    };
  }

  private async findScoped(businessId: string, branchId: string) {
    return this.credentialRepository.findOne({
      where: { branch_id: branchId, business_id: businessId },
    });
  }

  private toView(c: MoniepointErpCredential): MoniepointErpCredentialView {
    return {
      id: c.id,
      branchId: c.branch_id,
      environment: c.environment,
      isActive: c.is_active,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    };
  }

  private toPushView(
    p: MoniepointErpPush,
    opts: { duplicate?: boolean; settled?: boolean } = {},
  ): MoniepointErpPushView {
    return {
      id: p.id,
      billId: p.bill_id,
      merchantReference: p.merchant_reference,
      terminalSerial: p.terminal_serial,
      amountKobo: p.amount_kobo,
      status: p.status,
      error: p.error,
      pushedAt: p.pushed_at,
      paidAt: p.paid_at,
      ...(opts.duplicate ? { duplicate: true } : {}),
      ...(opts.settled !== undefined ? { settled: opts.settled } : {}),
    };
  }
}
