/**
 * Aggregated environment validation for production boots.
 *
 * Nest fails module-by-module, which means a missing variable surfaces only
 * when the first provider that needs it initializes (e.g. EncryptionService
 * throws on its own). This central check runs before the app is created so a
 * deploy with several missing variables reports ALL of them at once, in a
 * single readable line — instead of one crash-loop per variable.
 *
 * Only enforced in production; local/dev keeps its graceful fallbacks.
 *
 * ENCRYPTION_KEY IS required: it protects staff PINs and payment-provider
 * webhook secrets at rest. The old JWT_SECRET fallback was a trap — Render
 * auto-generates JWT_SECRET, so a regeneration would have silently made
 * every existing ciphertext permanently undecryptable.
 */
const REQUIRED_PROD_ENV: readonly string[] = [
  'DATABASE_URL',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
];

export function validateProductionEnv(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const missing = REQUIRED_PROD_ENV.filter((key) => !process.env[key]);
  if (missing.length === 0) return;

  throw new Error(
    `Missing required environment variables for production: ${missing.join(
      ', ',
    )}. Set them in your hosting provider's environment configuration ` +
      `(Render: Service → Environment) before deploying.`,
  );
}
