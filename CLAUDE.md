# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Note: a `CLAUDE.md` exists at `~/Downloads/CLAUDE.md` describing a "Sarva Tech" marketing site. It is **unrelated to this project** and must be ignored here.

---

## 1. What this is

**ServeIQ** — a cloud restaurant/bar/hotel management and POS backend for the Nigerian market. NestJS + PostgreSQL + TypeORM + Socket.IO.

This repo is **backend only**. The frontends (customer menu, waiter app, owner dashboard, admin panel) live in a separate repository (`DennisMajestie/serveIQ`, deployed to Vercel). Deployed API: `https://serveiq-backend.onrender.com`, Swagger at `/api/docs` (non-production only).

npm workspaces monorepo with a single workspace: `apps/api`. There is **no Nx** despite what `ARCHITECTURAL_AUDIT.md` claims, and the `@hospitality/shared` path alias in `tsconfig.json` points at a `libs/` directory that does not exist.

---

## 2. Commands

All commands run from the repo root unless noted. Node 18+; the `-w apps/api` suffix targets the workspace.

```bash
npm install                              # installs all workspaces

npm run start:api                        # dev server, watch mode (also: npm run start:dev -w apps/api)
npm run build -w apps/api                # nest build -> apps/api/dist
npm run start:prod -w apps/api           # node dist/main

npm run lint                             # eslint --fix over apps/api
npm run format                           # prettier over apps/**/*.{ts,md}
```

### Tests

```bash
npm run test -w apps/api                 # unit tests (jest, rootDir=src, *.spec.ts)
npm run test:cov -w apps/api
npm run test -w apps/api -- bill.calculation        # single suite by path fragment
npm run test -w apps/api -- -t "applies service charge"   # single test by name

npm run test:e2e -w apps/api             # test/*.e2e-spec.ts (mocked DataSource)
TEST_DATABASE_URL=postgresql://... npm run test:e2e -w apps/api -- real-db
```

`test/real-db.e2e-spec.ts` boots the whole AppModule against a real Postgres. It self-guards: it refuses to run if the URL looks like production (`supabase.co`, `render.com`, `neon.tech`) and skips entirely when the env var is unset. It covers register → tables → menu → tab → order → bill → pay → receipt, plus a cross-business data-leakage assertion.

### Database

```bash
npm run migration:generate -w apps/api -- src/database/migrations/<Name>
npm run migration:run -w apps/api
npm run migration:revert -w apps/api
npm run seed -w apps/api                 # idempotent base seed
npm run seed:demo-history -w apps/api    # demo data for staging
```

### Payments preflight

```bash
npm run moniepoint:preflight -w apps/api  # must exit 0 before any real-money Moniepoint test
npm run moniepoint:inspect -w apps/api    # dump recent failed/pending webhook deliveries
```

The API key itself declares SANDBOX vs PROD — not `NODE_ENV`, not the base URL. The preflight hard-fails on an environment or scope mismatch. Treat a non-zero exit as a blocker.

---

## 3. Architecture

### Request pipeline (`apps/api/src/main.ts`)

`validateProductionEnv()` runs before `NestFactory.create`, so a misconfigured production deploy reports every missing var at once. Then: helmet → cookie-parser → global prefix `api` → URI versioning (default `v1`, so all routes are `/api/v1/...`) → whitelist `ValidationPipe` → `TransformInterceptor` + `ClassSerializerInterceptor` → `HttpExceptionFilter`.

**Every response is wrapped** as `{ success: true, data: <payload> }` by `TransformInterceptor`. Opt out per handler with `@SkipTransform()` (`src/common/decorators/skip-transform.decorator.ts`) — needed for raw streams, PDFs and webhook acks.

### Module layout

`apps/api/src/modules/<domain>/` — one folder per domain, each with `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`, `entities/`. ~40 modules. `src/common/` holds guards, decorators, filters, interceptors, the shared enum file, and cross-cutting services (audit, encryption, logger).

`src/common/shared.ts` is the **single source of truth for lifecycle enums and billing predicates**. Read it before touching order or bill logic.

### The core lifecycle

```
Table → Tab → Order (one row per line item) → Bill → payment on the Bill
```

- **`Tab`** is both the customer session and the order container. `TabStatus`: `open | billed | paid | voided`. Dine-in tabs occupy a table; takeaway tabs have `table_id = null`.
- **`Order` is one row per line item**, not per ticket. It carries two status columns: `status` (legacy/group, default `'open'`) and **`order_status`, which is the real state machine**. Every transition in `order.service.ts` is guarded by an explicit "from" check.
- **There is no `Payment` entity.** `src/modules/payment/` is provider integration only. Payment state lives on the `Bill` (`payment_status`, `paid_at`, `payment_reference`, `idempotency_key`, …).
- `BillService.generateBill` sets the tab to `billed`; `BillService.processPayment` sets it to `paid`, closes it and releases the table — all in one transaction.

Key services: `tab.service.ts` (open/transfer/merge/void), `order.service.ts` (items + state machine, ~23 realtime emits), `bill.service.ts` (all money math and settlement), `ingredient.service.ts` (stock ledger).

### Money

All monetary values are **integer minor units (kobo)** in columns suffixed `_kobo`. `decimal.js` is a dependency but is **imported nowhere** — do not start using it piecemeal. Rates on `businesses` are `numeric` (`tax_rate` 7.5, `service_charge_percent` 10, `vip_surcharge_percent`). `currency` is a display string only; there is no FX arithmetic.

**All bill math lives in one module: `src/modules/bill/bill-totals.ts`** (`computeBillTotals`, `recomputeBillTotal`, `resolveBillRates`). `BillService.generateBill`/`applyDiscount`, the self-service checkout (`payment.controller.ts`), and the public tracking views (`customer.service.ts`) all call it — never re-implement the formula inline. Canonical order of application — every percentage applies to the **subtotal**, never compounded:

1. `subtotal` = sum of `order.subtotal_kobo` over **`isBillable()`** orders only
2. `service_charge = round(subtotal * pct/100)`
3. `tax = round(subtotal * rate/100)` — on subtotal, **not** on subtotal + service
4. `delivery_fee` only when `pickup_mode === 'dispatch'`
5. `total = max(0, subtotal + service + tax + delivery − discount)`

The math is locked by golden-case tests in `bill.calculation.spec.ts` (50 scenarios), `billing.calculations.spec.ts`, and `bill-totals.spec.ts`. Run them after any change to totals.

### Auth and multi-tenancy

JWT (`Authorization: Bearer` or the `access_token` cookie). Payload: `{ sub, email, role, role_id, businessId, branchId, pin_token_version, staff_token_version }`. Three login paths, all under `/api/v1/auth`: `login` (owner/admin, email+password), `waiter-login` (staff PIN, preceded by `resolve-business`), and riders — who use `waiter-login` too, there is no separate rider login. Token-version claims give branch-wide and per-user session revocation.

**Tenancy is enforced per-query in services, not by a guard.** `BranchScopeGuard` and the `@BranchId()` decorator exist but are used by **zero** controllers — dead code, despite `API_ARCHITECTURE.md` calling the guard "non-negotiable". The real pattern: the controller reads `req.user.branchId` / `req.user.businessId` and passes it explicitly into the service, which puts it in every `where` clause. Where an endpoint deliberately accepts a `branch_id` query param (multi-branch owners), the service must verify that branch belongs to `req.user.businessId` before using it — see `DeliveryService.listByBranch` and `RiderService.update` for the pattern.

Authorization runs two parallel systems: legacy `@Roles()` (`UserRole` enum in `shared.ts`) and PBAC `@RequirePermissions()` (codes in `modules/role/permission-codes.ts`, seeded by `role-seed.service.ts`). `PermissionsGuard` requires **all** listed codes and bypasses for role name `'Owner'`/`'Super Admin'`. Roles are **global rows, not per-business**.

Only two guards are global (`APP_GUARD`): `ThrottlerGuard` (300 req/60s) and `SubscriptionGuard`. `JwtAuthGuard`, `RolesGuard` and `PermissionsGuard` are applied per controller/handler.

### Realtime (`modules/gateway/`)

Two Socket.IO namespaces: `/realtime` (staff, JWT required at handshake) and `/public` (anonymous guests, ownership proven by tracking code). Rooms are branch-scoped: `branch:<id>`, `managers:<id>`, `riders:<id>`, `tables:<id>`, `orders:<id>`, `dashboard:<id>`, plus `tab:<id>` / `tracking:<code>` on the public side.

To emit: inject **`RealtimeService`** (GatewayModule is `@Global()`) and call a typed helper, or `getPublicServer()` from `gateway.constants.ts` for customer events. Never inject the gateway class directly — the server is stashed on `globalThis` deliberately to avoid circular DI.

The Redis adapter attaches only when `REDIS_URL` is set. Without it the app runs single-instance; **multi-instance deploys break silently**.

### Payments

- **Paystack** — subscriptions/billing only, not guest payments. Webhook `POST /api/v1/webhooks/paystack`, HMAC-SHA512 over `req.rawBody` (enabled by `rawBody: true` in `main.ts`).
- **Guest payment webhooks** live under `/api/v1/public/payments/webhooks/`: dedicated hardened routes for Moniepoint (`/moniepoint` and the live-in-production misspelling `/monniepoint` — do not remove it) and OPay (`/opay`), plus a **generic `/:provider` route** for providers onboarded through the super-admin catalogue (`platform_payment_providers`, CRUD at `/admin/payment-providers`). Every route follows the same order: resolve the **branch** from payload metadata first, verify the signature against that branch's config, only then resolve the bill. Unverifiable deliveries get 403, never a response that leaks bill existence.
- **Verification strategies** are pure functions in `src/modules/payment/webhook-verification.ts` (`hmac-sha512`, Moniepoint's timestamped `hmac-sha256`, `rsa`, Stripe-style `t=,v1=`), all timing-safe, all fail-closed. **`verification_method: 'none'` is rejected for webhook providers** — an unverified webhook never settles money. Locked by `webhook-verification.spec.ts` and `payment-security.spec.ts`.
- **Every delivery is logged** to the append-only `webhook_events` ledger (`WebhookEventsService` — `record()` never throws, `hasSettledPayload()` fails open). It powers replay dedupe (a byte-identical verified+settled payload short-circuits as `duplicate` before touching bills), the audit trail, and the superadmin views `GET /admin/webhook-events` and `GET /admin/webhook-events/health`.
- **Provider secrets are encrypted at rest** (`enc:v1:` via `EncryptionService`; legacy plaintext still decrypts passthrough) in both `branches.settings.payment_providers[].config` and the platform catalogue. Helpers in `src/modules/payment/provider-secrets.ts`. API responses only ever contain a mask (`••••` + last 4); a masked value posted back on an update means "unchanged" and is dropped before merge. Branch GET/PATCH responses are sanitized in `branch.controller.ts` (`toResponse`) — never return raw `branch.settings` from a new endpoint.
- Settlement idempotency is unchanged and two-layer: fast-path lookup on `bills.idempotency_key` (`<provider>-<reference>`) plus the **atomic conditional UPDATE** (`WHERE id = ? AND paid_at IS NULL AND idempotency_key IS NULL`) inside the settlement transaction.
- `x-simulate` bypass is hard-disabled when `NODE_ENV=production` and additionally requires `ENABLE_WEBHOOK_SIMULATION=true`. Never enable it outside local dev.
- Onboarding a new provider that follows a standard pattern is **config-only**: superadmin creates it in the catalogue (name, label, `type: 'webhook'`, verification method, optional `signature_header` / `webhook_id_header` / `timestamp_header` overrides in `config`), the branch owner enters the secret/public key + deposit `account_number` in branch settings, and the provider posts to `/api/v1/public/payments/webhooks/<name>`. Only genuinely bespoke payload shapes need code.

### Background work

**No Bull queues exist.** `@nestjs/bull` and `bull` are installed but unused; Redis serves only the Socket.IO adapter. Four crons, all in-process: order prep-timer expiry (30s), subscription expiry (daily), and two Moniepoint reconciliation jobs (5 min). `ScheduleModule.forRoot()` is registered **once**, in `subscription.module.ts` — every other cron depends on it. There is no distributed lock, so running more than one instance duplicates every job.

### Migrations — one canonical registry

All migrations are enumerated **once**, in `src/database/migrations/index.ts` (`ALL_MIGRATIONS`), imported by both the runtime connection (`app.module.ts`, `migrationsRun: true`) and the CLI data source (`data-source.ts`). A new migration must be imported and appended there in timestamp order; `src/database/migrations.registry.spec.ts` fails the suite if any file in the migrations directory is missing from the array (or registered without a file).

History, in case old docs mention it: before 2026-09 `app.module.ts` hand-listed 55 of 78 migrations while the CLI resolved all of them by glob, so 23 files never ran at boot. The production DB (checked directly) had all 78 recorded via the old CLI start-command era, so unification re-ran nothing. New **entities** must still be added to the `entities` array in `app.module.ts`. `synchronize: false` always.

### Deployment

`render.yaml`: build `cd apps/api && npm install && npm run build`, start `cd apps/api && node dist/main.js`. Note the start command does **not** run `migration:run:prod`, contradicting the comment in `main.ts` and `README.md` — migrations apply only through `migrationsRun: true` at app init. `vercel.json` rewrites `/api/(.*)` to the Render host for the frontends.

Health: `GET /api/v1/health` (liveness), `GET /api/v1/health/ready` (readiness, does `SELECT 1`).

---

## 4. Conventions

- Files kebab-case, classes PascalCase, DB tables and columns snake_case, endpoints kebab-case, env vars SCREAMING_SNAKE.
- Controllers handle HTTP only; business logic lives in services. DTOs validated with class-validator. Endpoints documented with `@ApiTags` / `@ApiOperation`.
- UUID primary keys. Soft delete (`deleted_at`) on financial records — no hard deletes.
- Prices are **snapshotted** onto the order row at write time (including VIP surcharge and modifiers). Never re-derive a total from the current menu price.
- Every financial mutation writes an `audit_log` entry.
- Never expose password hashes in responses.
- TypeScript is **not** fully strict: `strictNullChecks` and `noImplicitAny` are on, but `strict: true` is not set and `@typescript-eslint/no-explicit-any` is off — contrary to the "strict mode, no any" claim in `PROJECT_BIBLE.md` §19.

### Adding an endpoint

1. `@UseGuards(JwtAuthGuard)` on the controller class, `@ApiBearerAuth('access-token')` for Swagger.
2. Per handler, `@UseGuards(RolesGuard, PermissionsGuard)` **together with** `@Roles(...)` / `@RequirePermissions(...)`. Metadata decorators without the matching guard in scope are **silently inert** — this mistake already exists in the codebase (e.g. `rider.controller.ts` `findAll`).
3. Take the tenant key only from `req.user.branchId` / `req.user.businessId` — never from a body, query param or `x-branch-id` header — and thread it into every `where` clause.
4. A new permission code must be added to `permission-codes.ts` **and** `role-seed.service.ts` `DEFAULT_ROLES` **and** a migration (template: `1812000000000-AddManageShiftsPermission`), or existing roles can never receive it.
5. Public routes need an explicit `@Throttle()`, an entry in `SubscriptionGuard`'s `EXCLUDED_PREFIXES`, and a secret-bearing credential (tracking code, confirmation code, or webhook signature). There is no `@Public()` decorator — "public" just means no guard was attached, which makes accidental exposure easy.

---

## 5. Invariants not to break

1. Sum order rows only through `isBillable()`; gate payment only through `statusBlocksPayment()`. Both live in `common/shared.ts`.
2. All money stays integer kobo; percentages apply to subtotal and go through `Math.round`; totals floor at 0.
3. `paid_at` is set in exactly one place — the conditional-UPDATE claim inside `BillService.processPayment`. Settlement, stock deduction and the tab/table transition stay in that one transaction.
4. A tab becomes `paid` only with a paid bill. Releasing the table belongs to the transaction that pays or voids.
5. Stock deduction is **delta-based** against `stock_movements` keyed by tab id (bill id for standalone orders), via `IngredientService.deductByTab`. It is called twice by design (at order creation and at settlement) and is idempotent by that delta rule.
6. Webhook handlers verify against `req.rawBody` with `timingSafeEqual`, resolve the branch before touching bills, and pass `idempotency_key = <provider>-<reference>`. Return `200 {received:true}` for business-level rejections (unknown bill, amount mismatch) and `403` only for unverifiable deliveries — the distinction controls whether the provider retries.
7. New `sync` operations must be idempotent on replay and delegate to the owning service rather than writing entities directly.

---

## 6. Known divergences between docs and code

The markdown docs at the repo root are extensive but **stale in load-bearing ways**. Verify against code before trusting them.

- **Split payments are decommissioned.** `README.md` leads with "per-guest split payments with item-level allocation", and the `bills` table still has `split_group` / `allocation_type` / `allocation_config`. But **nothing writes those columns**; there is no create-split endpoint and no per-guest entity. Only read-and-invalidate logic remains, operating on legacy rows. `split_bill` / `split_table` permission codes gate nothing.
- `BranchScopeGuard` / `@BranchId()` are documented as mandatory, used nowhere (see §3).
- Super-admin enforcement layer (2026-09): `JwtStrategy` now enforces `user.is_active`, branch and business `is_active` on EVERY request — suspension cuts access immediately, not at token expiry (see `admin-enforcement.spec.ts`). Admin session commands: `POST /admin/businesses/:id/force-logout`, `POST /admin/users/:id/force-logout`, `PATCH /admin/users/:id/status`, `GET /admin/users` (cross-tenant search, safe fields). Suspending a business (`PATCH /admin/businesses/:id` with `is_active:false`) automatically bumps every branch's `staff_token_version`, revokes refresh tokens, disconnects live sockets (`RealtimeService.disconnectBranch`), and writes audit entries. Impersonation tokens are 15-minute, carry `impersonator_id`, carry the target's token versions (revocable like any session), and mint an `admin.impersonate` audit entry — impersonating a suspended tenant is blocked by design. `forgot-password` no longer returns the reset token in production (account-takeover fix); the flow is disabled until an email provider exists — there is currently NO email/SMS channel anywhere in the platform.
- Security hardening (2026-09 audit): `POST /auth/setup-super-admin` now requires `SUPERADMIN_SETUP_TOKEN` (unset = 404) and refuses once any superadmin exists; offline-sync replay (`sync.service.ts`) is branch-scoped with the caller's real identity (never `payload.branch_id` or a hardcoded role); role mutations are superadmin-only until roles are tenanted per business; subscription `admin/*` routes are superadmin-gated (`PermissionsGuard` now bypasses for the `superadmin` JWT claim — superadmins have no `role_id`); rider payouts run in a transaction with a conditional claim; the old `AppService` boot-DDL became migration `1880000000001`; printer/KDS, menu-modifier options, departments, order-item adds, and rider ledgers are all branch/business-scoped; public routes carry per-route `@Throttle`s; `ENCRYPTION_KEY` is required at boot in production; the readiness probe returns 503 when the DB is down (`healthCheckPath` in render.yaml); Sentry capture lives inside `HttpExceptionFilter` (a separate global filter would shadow it); all outbound HTTP calls have timeouts; bank account numbers are masked in logs.
- Fixed in 2026-09 (old docs may still describe them): the self-service checkout charging without VAT while the tracking page displayed VAT-inclusive totals; cash-intent counting cancelled orders and erasing `tax_kobo` from waiter-issued bills; the staff gateway reading `payload.branch_id` instead of the JWT's `branchId` (every socket landed in a shared `branch:undefined` room and real branch rooms had no members — see `gateway.gateway.spec.ts`); the migration registry divergence (see §3); OPay webhooks verifying *after* bill resolution with no replay guard or alerts; webhook secrets stored plaintext and readable by any staff token; and `verification_method: 'none'` silently skipping webhook signature verification (now fails closed).
- `API_ARCHITECTURE.md` says access tokens expire in 15 minutes; `JWT_EXPIRES_IN` defaults to **24h**. Only the cookie maxAge is 15 minutes.
- `API_ARCHITECTURE.md` documents per-tier rate limits (20/min public, 200/min authenticated); the global throttler is **300/min** and several public routes have no per-route throttle.
- `AUTHORIZATION_AUDIT.md` (July 2025) describes a `platformRole` JWT claim and ~49 permissions. Neither matches: there is no `platformRole`, and there are ~80 codes. Its "critical" legacy-fallback finding is already fixed.
- `ARCHITECTURAL_AUDIT.md` (July 2026) items S4/S15 ("no event bus", "no WebSocket") are stale — the gateway and Redis adapter now exist.
- `MASTER_CHECKLIST.md` has an accurate "STATUS REALITY CHECK" header block; the checkboxes below it are not maintained. Trust the header, not the boxes.
- `PROJECT_BIBLE.md` §19 claims strict mode and no `any`; neither is enforced (see §4).

---

## 7. Working-tree state

`git status` shows ~327 modified files. **Most of that is CRLF→LF line-ending noise from the zip extraction, not real edits** — `git diff --ignore-cr-at-eol` reduces it to the substantive changes: two deleted CI workflow files (`.github/workflows/ci.yml`, `load-test.yml`) plus the 2026-09 production-readiness fixes (migration registry, tenancy checks, gateway branch claim, shared bill math). Use `--ignore-cr-at-eol` when diffing, and be careful not to commit the whitespace churn alongside real changes.

Two remotes: `origin` (`DevMaj001/ServeIQ-Backend`) and `dennis-origin` (`DennisMajestie/ServeIQ-Backend`, the deployed one). Current branch `main`, one commit ahead of `dennis-origin/master`.
