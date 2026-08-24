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
 * ENCRYPTION_KEY is intentionally NOT required here: EncryptionService falls
 * back to JWT_SECRET in production (with a warning), so a missing dedicated
 * ENCRYPTION_KEY must not block boot on its own.
 */
const REQUIRED_PROD_ENV: readonly string[] = [
  'DATABASE_URL',
  'JWT_SECRET',
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
