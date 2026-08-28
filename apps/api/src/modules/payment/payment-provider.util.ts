import { PosTerminal } from '../pos/entities/pos-terminal.entity';

export interface PaymentProviderConfig {
  name: string;
  label?: string;
  type?: 'manual' | 'webhook';
  verification_method?: 'hmac-sha512' | 'rsa' | 'none';
  config?: Record<string, any>;
}

export const POS_TERMINAL_PROVIDER = 'monniepoint';

export interface CustomerPaymentMethod {
  type: 'terminal' | 'transfer' | 'cash';
  id?: string;
  label?: string;
  account_number?: string | null;
  has_transfer?: boolean;
  auto_confirm?: boolean;
  provider?: string;
  /** Cash is confirmed by a supervisor at the counter, not by a gateway. */
  requires_counter_confirmation?: boolean;
}

export function getConfiguredProviders(settings: any): PaymentProviderConfig[] {
  return Array.isArray(settings?.payment_providers) ? settings.payment_providers : [];
}

export function getActiveProvider(settings: any): PaymentProviderConfig | null {
  const active = settings?.payment_provider;
  if (!active || active === 'manual') return null;
  return getConfiguredProviders(settings).find((p) => p?.name === active) || null;
}

/** Providers the owner has enabled. Falls back to the legacy single
 *  `payment_provider` field. 'manual' is never a webhook provider. */
export function getEnabledProviders(settings: any): PaymentProviderConfig[] {
  const configured = getConfiguredProviders(settings);
  const enabledNames: string[] = Array.isArray(settings?.enabled_providers)
    ? settings.enabled_providers
    : settings?.payment_provider && settings.payment_provider !== 'manual'
      ? [settings.payment_provider]
      : [];
  return configured.filter((p) => enabledNames.includes(p?.name));
}

export function isProviderConfigured(provider?: PaymentProviderConfig | null): boolean {
  if (!provider) return false;
  const cfg = provider.config || {};
  if (provider.type === 'webhook') {
    if (provider.verification_method === 'rsa') {
      return !!(cfg.public_key || cfg.publicKey);
    }
    return !!(cfg.webhook_secret || cfg.secret);
  }
  return true;
}

export function providerTransferAccount(provider?: PaymentProviderConfig | null): string | null {
  if (!provider) return null;
  const cfg = provider.config || {};
  return cfg.account_number || cfg.accountNumber || cfg.account || null;
}

export function buildPaymentMethods(
  activeTerminals: PosTerminal[],
  settings: any,
): CustomerPaymentMethod[] {
  const enabledProviders = getEnabledProviders(settings);
  const terminalProvider = enabledProviders.find((p) => p?.name === POS_TERMINAL_PROVIDER) || null;

  const methods: CustomerPaymentMethod[] = activeTerminals.map((t) => ({
    type: 'terminal',
    id: t.id,
    label: t.label,
    account_number: t.account_number || null,
    has_transfer: !!t.account_number,
    provider: POS_TERMINAL_PROVIDER,
    auto_confirm: isEnabledProvider(settings, POS_TERMINAL_PROVIDER) && isProviderConfigured(terminalProvider),
  }));

  // Every enabled webhook provider with a transfer account gets its own
  // method (e.g. Moniepoint AND OPay), each auto-confirming via its own
  // webhook when configured.
  for (const provider of enabledProviders) {
    if (provider.type !== 'webhook') continue;
    const account = providerTransferAccount(provider);
    if (!account) continue;
    const existing = methods.find((m) => m.provider === provider.name);
    if (existing) {
      existing.auto_confirm = isProviderConfigured(provider);
      continue;
    }
    methods.push({
      type: 'transfer',
      id: `webhook-${provider.name}`,
      label: `${provider.label || provider.name} Bank Transfer`,
      account_number: account,
      has_transfer: true,
      auto_confirm: isProviderConfigured(provider),
      provider: provider.name,
    });
  }

  methods.push({ type: 'cash', requires_counter_confirmation: true });
  return methods;
}

/** Whether a provider name is present in the branch's enabled list. */
export function isEnabledProvider(settings: any, providerName: string): boolean {
  const enabledNames: string[] = Array.isArray(settings?.enabled_providers)
    ? settings.enabled_providers
    : settings?.payment_provider && settings.payment_provider !== 'manual'
      ? [settings.payment_provider]
      : [];
  return enabledNames.includes(providerName);
}