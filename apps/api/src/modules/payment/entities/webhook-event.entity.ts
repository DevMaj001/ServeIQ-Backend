import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type WebhookSignatureStatus =
  'verified' | 'invalid' | 'unverifiable' | 'not-configured' | 'simulated';

export type WebhookOutcome =
  | 'settled'
  | 'already_paid'
  | 'duplicate'
  | 'no_bill'
  | 'amount_mismatch'
  | 'ignored'
  | 'rejected'
  | 'error';

/**
 * Append-only ledger of every inbound payment webhook delivery.
 *
 * This is the audit trail and observability source for the money pipeline:
 * one row per delivery, whatever happened to it. It also powers replay
 * dedupe (payload_hash of a previously verified+settled delivery) and the
 * super-admin provider-health view. It is NOT the settlement idempotency
 * mechanism — that remains the conditional-UPDATE claim on bills.
 */
@Entity('webhook_events')
@Index(['provider', 'created_at'])
@Index(['branch_id', 'created_at'])
@Index(['payload_hash'])
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  provider: string;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reference: string | null;

  @Column({ type: 'integer', nullable: true })
  amount_kobo: number | null;

  @Column({ type: 'uuid', nullable: true })
  bill_id: string | null;

  /** sha256 hex of the raw request body. */
  @Column({ type: 'char', length: 64 })
  payload_hash: string;

  @Column({ type: 'varchar', length: 20 })
  signature_status: WebhookSignatureStatus;

  @Column({ type: 'varchar', length: 20 })
  outcome: WebhookOutcome;

  @Column({ type: 'smallint', default: 200 })
  http_status: number;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  /** Parsed payload for debugging; truncated upstream, may be null. */
  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, any> | null;

  @CreateDateColumn()
  created_at: Date;
}
