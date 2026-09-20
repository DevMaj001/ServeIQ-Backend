import * as dotenv from 'dotenv';
import {
  MoniepointApiClient,
  MoniepointApiError,
  MoniepointEventStatus,
  MoniepointSubscriptionEvent,
} from '../src/modules/payment/moniepoint-api.client';

/**
 * Moniepoint POS API pre-flight / inspection CLI.
 *
 * Get /v1/introspect is the authoritative source for what an API key can do
 * and — decisively for real-money testing — which environment it is scoped
 * to (SANDBOX | PROD). Local env config (NODE_ENV, a base URL) is NOT a
 * substitute: the key itself declares the environment it is authorized for.
 *
 * Subcommands:
 *   preflight  – verify config + introspect + assert environment/scopes +
 *                confirm the configured webhook subscription is reachable.
 *                Exit code 0 = safe to proceed, 1 = do NOT proceed.
 *   inspect-delivery [eventId]
 *              – list recent FAILED/PENDING deliveries and dump each
 *                delivery attempt's log (status + message) via
 *                GET /v1/webhook-subscription-events/{id}/logs. This is the
 *                only way to know whether `message` distinguishes signature /
 *                auth failures from transient ones (timeout, 5xx, connection
 *                refused) before any auto-resend default is reconsidered.
 *
 * Env:
 *   MONIEPOINT_API_BASE_URL          e.g. https://api.pos.moniepoint.com
 *   MONIEPOINT_API_KEY               Bearer token (API key)
 *   MONIEPOINT_WEBHOOK_SUBSCRIPTION_ID uuid of the subscription in use
 *   MONIEPOINT_EXPECTED_ENVIRONMENT  SANDBOX | PROD — when set, preflight
 *                                    HARD-FAILS if introspect disagrees.
 *   MONIEPOINT_REQUIRED_SCOPES       comma list, default "webhook:read"
 *   MONIEPOINT_INSPECT_WINDOW_HOURS  inspect-delivery window, default 24
 *   MONIEPOINT_INSPECT_LIMIT         max events inspected, default 5
 */

const ARGS = process.argv.slice(2);
const [command, positional] = ARGS;

function env(name: string): string | null {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

function fail(reason: string): never {
  console.log(JSON.stringify({ ok: false, reason }, null, 2));
  process.exit(1);
}

function ok(output: Record<string, any>): never {
  console.log(JSON.stringify({ ok: true, ...output }, null, 2));
  process.exit(0);
}

function runPreflight(client: MoniepointApiClient): Promise<never> {
  return (async () => {
    if (!client.isConfigured) {
      return fail(
        'MoniepointApiClient is not configured — set MONIEPOINT_API_BASE_URL, MONIEPOINT_API_KEY and MONIEPOINT_WEBHOOK_SUBSCRIPTION_ID',
      );
    }

    let info: Awaited<ReturnType<MoniepointApiClient['introspect']>>;
    try {
      info = await client.introspect();
    } catch (err) {
      const status = err instanceof MoniepointApiError ? err.status : null;
      return fail(
        `introspect failed (HTTP ${status ?? 'n/a'}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    if (!info.environment) {
      return fail('introspect did not return an "environment" field');
    }

    const expected = env('MONIEPOINT_EXPECTED_ENVIRONMENT');
    if (expected && info.environment !== expected) {
      return fail(
        `environment mismatch: key is scoped to ${info.environment} but MONIEPOINT_EXPECTED_ENVIRONMENT=${expected} — refusing to proceed`,
      );
    }

    const requiredScopes = (env('MONIEPOINT_REQUIRED_SCOPES') ?? 'webhook:read')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const missingScopes = requiredScopes.filter(
      (s) => !info.scopes?.includes(s),
    );
    if (missingScopes.length) {
      return fail(
        `API key is missing required scope(s): ${missingScopes.join(', ')} (key has: ${(info.scopes ?? []).join(', ') || 'none'})`,
      );
    }

    let subscriptionOk = false;
    let listError: string | null = null;
    try {
      const page = await client.listSubscriptionEvents({ page: 0, size: 1 });
      subscriptionOk = true;
      void page;
    } catch (err) {
      listError =
        err instanceof MoniepointApiError
          ? `HTTP ${err.status}: ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err);
    }
    if (!subscriptionOk) {
      return fail(
        `configured webhook subscription is not reachable: ${listError}`,
      );
    }

    console.log(
      `preflight: environment=${info.environment} — ${info.environment === 'PROD' ? 'REAL-MONEY ENVIRONMENT' : 'sandbox'}. ` +
        `Confirm MONIEPOINT_EXPECTED_ENVIRONMENT=${info.environment} before any test.`,
    );
    return ok({
      environment: info.environment,
      expectedEnvironment: expected,
      scopes: info.scopes,
      missingScopes,
      businesses: info.businesses,
      authMethod: info.authMethod,
      subscriptionReachable: subscriptionOk,
      subscriptionId: process.env.MONIEPOINT_WEBHOOK_SUBSCRIPTION_ID ?? null,
    });
  })();
}

function runInspectDelivery(
  client: MoniepointApiClient,
  eventId: string | undefined,
): Promise<never> {
  return (async () => {
    if (!client.isConfigured) {
      return fail(
        'MoniepointApiClient is not configured — set MONIEPOINT_API_BASE_URL, MONIEPOINT_API_KEY and MONIEPOINT_WEBHOOK_SUBSCRIPTION_ID',
      );
    }

    const windowHours =
      Number(process.env.MONIEPOINT_INSPECT_WINDOW_HOURS) || 24;
    const limit = Number(process.env.MONIEPOINT_INSPECT_LIMIT) || 5;
    const from = new Date(Date.now() - windowHours * 3600_000);
    const events: MoniepointSubscriptionEvent[] = [];
    if (eventId) {
      events.push({
        id: eventId,
        subscriptionId: '',
        status: 'FAILED',
        payload: {},
      });
    } else {
      const statusGroups: MoniepointEventStatus[][] = [['FAILED'], ['PENDING']];
      for (const statuses of statusGroups) {
        const page = await client.listSubscriptionEvents({
          statuses,
          from,
          to: new Date(),
          page: 0,
          size: 100,
        });
        events.push(...page.content);
      }
    }

    console.log(
      `inspecting ${events.length} delivery event(s) within the last ${windowHours}h...`,
    );
    if (events.length === 0) {
      console.log('no FAILED/PENDING deliveries found — nothing to inspect.');
      return ok({ inspected: 0, events: [] });
    }

    const inspected = [];
    for (const event of events.slice(0, limit)) {
      let logs: any[] = [];
      try {
        const page = await client.listEventLogs(event.id, { size: 100 });
        logs = page.content ?? [];
      } catch (err) {
        logs = [
          {
            error:
              err instanceof MoniepointApiError
                ? `HTTP ${err.status}: ${err.message}`
                : err instanceof Error
                  ? err.message
                  : String(err),
          },
        ];
      }
      inspected.push({
        eventId: event.id,
        eventType: event.eventType ?? null,
        status: event.status ?? null,
        retryTimes: event.retryTimes ?? null,
        attempts: logs,
      });
    }
    return ok({ inspected: inspected.length, events: inspected });
  })();
}

async function main(): Promise<never> {
  dotenv.config();

  const client = new MoniepointApiClient();

  if (command === 'preflight' || !command) {
    return runPreflight(client);
  }
  if (command === 'inspect-delivery') {
    return runInspectDelivery(client, positional);
  }
  return fail(
    `unknown subcommand "${command}" — expected "preflight" or "inspect-delivery [eventId]"`,
  );
}

void main();
