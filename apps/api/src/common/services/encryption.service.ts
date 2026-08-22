import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

export const ENC_PREFIX = 'enc:v1:';

/**
 * Field-level encryption at rest using AES-256-GCM. The key is derived
 * deterministically from ENCRYPTION_KEY so the value is stable across
 * restarts and deployments. Values that were written before this service
 * existed (plaintext) are returned as-is.
 *
 * Production requires an explicit ENCRYPTION_KEY and refuses to boot
 * without one — deriving from JWT_SECRET breaks silently when that
 * secret rotates.
 */
@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor() {
    const secret = process.env.ENCRYPTION_KEY;
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'ENCRYPTION_KEY is required in production. Set it to a long random value (use the current JWT_SECRET value once to keep existing ciphertext decryptable), then never rotate it casually.',
        );
      }
      this.key = crypto.createHash('sha256').update('serveiq-dev-key').digest();
      return;
    }
    this.key = crypto.createHash('sha256').update(secret).digest();
  }

  encrypt(plaintext: string | null | undefined): string | null {
    if (!plaintext) return null;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return (
      ENC_PREFIX +
      Buffer.concat([iv, tag, encrypted]).toString('base64')
    );
  }

  decrypt(value: string | null | undefined): string | null {
    if (!value || typeof value !== 'string') return value ?? null;
    if (!value.startsWith(ENC_PREFIX)) return value;
    try {
      const raw = Buffer.from(value.slice(ENC_PREFIX.length), 'base64');
      const iv = raw.subarray(0, 12);
      const tag = raw.subarray(12, 28);
      const data = raw.subarray(28);
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString(
        'utf8',
      );
    } catch {
      return value;
    }
  }
}