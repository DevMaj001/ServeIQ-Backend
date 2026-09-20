import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type MoniepointErpPushStatus =
  'pending' | 'paid' | 'declined' | 'expired' | 'cancelled';

/**
 * Tracks one Moniepoint ERP (Channel push-payment) push and its outcome.
 *
 * Completion signal model: when the guest pays at the terminal, Moniepoint
 * emits a POS transaction event that arrives at our existing
 * `moniepointWebhook` endpoint, which settles the linked bill by merchant
 * reference. The scheduled reconciler watches this row:
 *   - linked bill paid  -> mark `paid`
 *   - POS feed lookup (`getMerchantTransaction`) reports failure -> `declined`
 *   - no signal within MONIEPOINT_PUSH_STALE_MINUTES -> `expired` (guest never
 *     paid; a fresh push with a new reference is required)
 *
 * `merchant_reference` equals the linked bill's `payment_reference` so the
 * existing webhook settlement path resolves the bill without new routing.
 */
@Entity('moniepoint_erp_pushes')
export class MoniepointErpPush {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_moniepoint_erp_pushes_business_id')
  @Column({ type: 'uuid' })
  business_id: string;

  @Index('IDX_moniepoint_erp_pushes_branch_id')
  @Column({ type: 'uuid' })
  branch_id: string;

  @Column({ type: 'uuid', nullable: true })
  bill_id: string | null;

  @Index('IDX_moniepoint_erp_pushes_branch_ref')
  @Column({ type: 'varchar', length: 100 })
  merchant_reference: string;

  @Column({ type: 'varchar', length: 100 })
  terminal_serial: string;

  /** Amount in minor units (kobo), verbatim from the push request. */
  @Column({ type: 'integer' })
  amount_kobo: number;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: MoniepointErpPushStatus;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @CreateDateColumn()
  pushed_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  paid_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;
}
