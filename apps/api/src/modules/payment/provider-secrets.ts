import {
  EncryptionService,
  ENC_PREFIX,
} from '../../common/services/encryption.service';

/**
 * Handling rules for payment-provider config secrets.
 *
 * - At rest they are AES-256-GCM encrypted (enc:v1: prefix) inside
 *   branches.settings.payment_providers[].config and
 *   platform_payment_providers.config.
 * - API responses never contain a usable secret: sensitive values are
 *   replaced with a mask that keeps the last 4 characters for recognition.
 * - A masked value posted back on an update means "unchanged" and must be
 *   dropped before merging, so a settings round-trip can never overwrite a
 *   real secret with its mask.
 * - RSA public keys and deposit account numbers are not secrets and stay
 *   readable — the webhook pipeline needs branch staff to be able to see
 *   and share them.
 */

export const SENSITIVE_PROVIDER_CONFIG_KEYS = [
  'webhook_secret',
  'secret',
  'api_key',
  'apiKey',
  'client_secret',
  'clientSecret',
  'private_key',
  'privateKey',
] as const;

export const SECRET_MASK_PREFIX = '••••';

export function isSensitiveConfigKey(key: string): boolean {
  return (SENSITIVE_PROVIDER_CONFIG_KEYS as readonly string[]).includes(key);
}

export function isMaskedSecret(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    (value.startsWith(SECRET_MASK_PREFIX) || /^\*{4}/.test(value))
  );
}

/** Remove masked (i.e. unchanged) sensitive values from an incoming config
 *  payload so a merge keeps the stored secret. */
export function stripMaskedSecrets(
  config: Record<string, any> | undefined | null,
): Record<string, any> | undefined | null {
  if (!config || typeof config !== 'object') return config;
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(config)) {
    if (isSensitiveConfigKey(key) && isMaskedSecret(value)) continue;
    out[key] = value;
  }
  return out;
}

/** Encrypt sensitive values in place-of (returns a new object). Values that
 *  are already encrypted (enc:v1:) are left untouched. */
export function encryptSensitiveConfig(
  config: Record<string, any> | undefined | null,
  enc: EncryptionService,
): Record<string, any> | undefined | null {
  if (!config || typeof config !== 'object') return config;
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(config)) {
    if (
      isSensitiveConfigKey(key) &&
      typeof value === 'string' &&
      value !== '' &&
      !value.startsWith(ENC_PREFIX)
    ) {
      out[key] = enc.encrypt(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Replace sensitive values with a recognition mask (last 4 chars of the
 *  plaintext). Never returns the encrypted blob either — ciphertext plus a
 *  known key derivation is still worth hiding from staff tokens. */
export function maskSensitiveConfig(
  config: Record<string, any> | undefined | null,
  enc: EncryptionService,
): Record<string, any> | undefined | null {
  if (!config || typeof config !== 'object') return config;
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(config)) {
    if (
      isSensitiveConfigKey(key) &&
      typeof value === 'string' &&
      value !== ''
    ) {
      const plain = enc.decrypt(value) ?? '';
      out[key] = SECRET_MASK_PREFIX + plain.slice(-4);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Deep-copied branch settings with every provider secret masked — the only
 *  form of settings that may leave the API. */
export function sanitizeSettingsForResponse(
  settings: Record<string, any> | undefined | null,
  enc: EncryptionService,
): Record<string, any> | undefined | null {
  if (!settings || typeof settings !== 'object') return settings;
  const copy = JSON.parse(JSON.stringify(settings)) as Record<string, any>;
  if (Array.isArray(copy.payment_providers)) {
    copy.payment_providers = copy.payment_providers.map((p: any) =>
      p && typeof p === 'object'
        ? { ...p, config: maskSensitiveConfig(p.config, enc) }
        : p,
    );
  }
  return copy;
}
