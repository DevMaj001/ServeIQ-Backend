import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

/**
 * Per-branch Moniepoint ERP (Channel/ERP push-payment) client credential.
 *
 * Each branch connects its OWN Moniepoint credential (created via the Moniepoint
 * console under POS Terminal Configuration > ERP Integration; environment =
 * SANDBOX or PROD chosen when the credential is created). The client secret is
 * encrypted at rest with EncryptionService (AES-256-GCM, `enc:v1:` prefix) and
 * is NEVER returned by the API.
 *
 * Env var credentials (MONIEPOINT_CLIENT_ID etc.) remain the platform-owned /
 * single-tenant fallback used by MoniepointChannelClient for platform testing.
 * This entity is the multi-tenant record: one per branch.
 */
@Entity('moniepoint_erp_credentials')
export class MoniepointErpCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_moniepoint_erp_credentials_branch_id')
  @Column({ type: 'uuid' })
  branch_id: string;

  @Index('IDX_moniepoint_erp_credentials_business_id')
  @Column({ type: 'uuid' })
  business_id: string;

  @Column()
  client_id: string;

  /** Encrypted with EncryptionService (`enc:v1:` prefix). Never plaintext. */
  @Column({ type: 'text' })
  client_secret_enc: string;

  /** 'SANDBOX' | 'PROD' — matches the environment chosen when the credential was created. */
  @Column({ type: 'varchar', length: 10, default: 'SANDBOX' })
  environment: 'SANDBOX' | 'PROD';

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;
}
