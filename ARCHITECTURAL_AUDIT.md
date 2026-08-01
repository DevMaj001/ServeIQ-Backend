# ServeIQ — Architectural Audit Report
## Customer Session Feasibility Analysis

> **Version:** 1.0  
> **Date:** July 28, 2026  
> **Type:** Read-Only Codebase Audit — No code modified  
> **Scope:** `apps/api/src` — 31 feature modules, 21 entities, full API surface  
> **Methodology:** 5-checkpoint structured audit tracing Tab → Customer Session migration path

---

## Table of Contents

1. [Section A — System Architecture](#section-a--system-architecture)
2. [Section B — Module Inventory](#section-b--module-inventory)
3. [Section C — Entity Inventory](#section-c--entity-inventory)
4. [Section D — Customer Journey](#section-d--customer-journey)
5. [Section E — Tab Semantics](#section-e--tab-semantics)
6. [Section F — Table Dependency Audit](#section-f--table-dependency-audit)
7. [Section G — Order Domain](#section-g--order-domain)
8. [Section H — Order Item Domain](#section-h--order-item-domain)
9. [Section I — Kitchen Domain](#section-i--kitchen-domain)
10. [Section J — Payment Domain](#section-j--payment-domain)
11. [Section K — Customer Tracking Domain](#section-k--customer-tracking-domain)
12. [Section L — Notification & Event Architecture](#section-l--notification--event-architecture)
13. [Section M — Reporting Model](#section-m--reporting-model)
14. [Section N — Business Rules](#section-n--business-rules)
15. [Section O — API Contract](#section-o--api-contract)
16. [Section P — Dependency Graph](#section-p--dependency-graph)
17. [Section Q — Feasibility Assessment](#section-q--feasibility-assessment)
18. [Section R — Blast Radius](#section-r--blast-radius)
19. [Section S — Technical Debt Catalog](#section-s--technical-debt-catalog)
20. [Section T — Final Recommendations](#section-t--final-recommendations)

---

## Section A — System Architecture

### Stack

| Component | Technology | Notes |
|---|---|---|
| Runtime | Node.js (NestJS v11) | Monorepo with Nx |
| Language | TypeScript (strict) | |
| Database | PostgreSQL 17.6 (Supabase) | Connection via Supabase pooler |
| ORM | TypeORM | DataSource pattern, migrations in `typeorm/migrations/` |
| Auth | JWT (access 15m + refresh 7d) | HttpOnly cookies + Bearer header |
| Validation | class-validator + ValidationPipe | whitelist: true, forbidNonWhitelisted: true |
| API Docs | Swagger (@nestjs/swagger) | Mounted at `/api/docs` |
| Rate Limiting | @nestjs/throttler (ThrottlerGuard global) | |
| CORS | Enabled (credentials: true) | |

### Module Organization

- 31 feature modules, all flat under `src/modules/`
- No domain subdirectories (no `modules/orders/`, `modules/payments/`, etc.)
- `src/common/` contains shared enums, guards, decorators, base services

### Guard Stack (order of application)

1. **ThrottlerGuard** — global rate limiting
2. **SubscriptionGuard** — global; evaluates subscription per `branch_id`; returns 402 on expired/missing
3. **JwtAuthGuard** — per-route; extracts and validates access token
4. **RolesGuard** — per-route; checks `user.role` string against `@Roles()` decorator
5. **PermissionsGuard** — per-route; queries `roles` + `role_permissions` + `permissions` tables via `user.role_id`; PBAC model — but `role_id` is nullable on `users` table

### Missing Architecture

- **No WebSocket / real-time** — no Gateway files found
- **No event bus** — no RabbitMQ, Redis pub-sub, or NestJS EventEmitter
- **No queue system** — no Bull, Bee, or similar background job processor
- **Offline sync** — `SyncModule` exists with `SyncService`, `SyncController`, `sync_queue` entity; stores pending mutations with `entity_type`, `entity_id`, `operation`, `payload`; includes conflict resolution retry logic

### File Structure Summary

```
apps/api/src/
├── main.ts                    — Bootstrap (helmet, cookieParser, ValidationPipe, Swagger)
├── app.module.ts              — Root module (registers 31 modules + global guards)
├── common/
│   ├── shared.ts              — Enums (OrderStatus, TabStatus, UserRole, PaymentMethod, StockMovementType)
│   ├── guards/
│   │   ├── roles.guard.ts     — String-based role check
│   │   ├── permissions.guard.ts — PBAC (role_id → permissions table)
│   │   ├── subscription.guard.ts — Global subscription check
│   │   └── jwt-auth.guard.ts
│   ├── decorators/
│   │   ├── roles.decorator.ts
│   │   └── permissions.decorator.ts
│   └── services/
│       └── audit.service.ts   — Central audit logging
├── modules/
│   ├── auth/                  — Register, login, waiter-login, refresh, etc.
│   ├── admin/                 — Business-wide stats (getStats)
│   ├── advertisement/         — Ad management
│   ├── ai/                    — AI module shell
│   ├── audit/                 — Audit log queries
│   ├── bill/                  — Generate, pay, split, discount
│   ├── branch/                — Branch CRUD
│   ├── business/              — Business CRUD
│   ├── dashboard/             — Reporting endpoints
│   ├── department/            — Department CRUD
│   ├── health/                — Health check
│   ├── ingredient/            — Stock management, variance, bestsellers
│   ├── menu/                  — Menu item CRUD
│   ├── menu-category/         — Category CRUD
│   ├── menu-modifier/         — Modifier groups/options
│   ├── notification/          — DB-persisted notifications (polled)
│   ├── order/                 — Order lifecycle + scheduler
│   ├── pos/                   — POS terminal management
│   ├── printer/               — Thermal print + KDS SSE
│   ├── public/                — Public menu endpoint (no auth)
│   ├── role/                  — Roles + permissions CRUD
│   ├── shift/                 — Shift open/close + summary
│   ├── subscription/          — Paystack subscription management
│   ├── sync/                  — Offline sync queue
│   ├── tab/                   — Tab lifecycle + transfers + voids
│   ├── table/                 — Table CRUD
│   ├── tracking/              — Public tracking endpoint (5-char code)
│   ├── unit/                  — Measurement units
│   ├── upload/                — Cloudinary file upload
│   └── user/                  — User CRUD
```

---

## Section B — Module Inventory

### Auth Module

| Item | File |
|---|---|
| Controller | `auth.controller.ts` — 12 endpoints |
| Service | `auth.service.ts` — register, login, waiter-login, refresh, forgot/reset-password, email verification, super-admin setup, impersonate |
| DTOs | `register.dto.ts`, `login.dto.ts`, `waiter-login.dto.ts`, `activate.dto.ts`, `refresh.dto.ts`, `logout.dto.ts`, `forgot-password.dto.ts`, `reset-password.dto.ts`, `resolve-business-code.dto.ts` |
| Guards | `jwt-auth.guard.ts`, `jwt-refresh.guard.ts`, `local-auth.guard.ts`, `ws-auth.guard.ts` |
| Strategies | `jwt.strategy.ts`, `jwt-refresh.strategy.ts`, `local.strategy.ts` |

### Tab Module

| Item | File |
|---|---|
| Controller | `tab.controller.ts` — 7 endpoints |
| Service | `tab.service.ts` — openTab, findOne, findAllByBranch, getTabWaiters, closeTab, transferTab, voidTab, update, remove |
| Entity | `tab.entity.ts` |
| DTOs | `open-tab.dto.ts`, `update-tab.dto.ts` |

### Order Module

| Item | File |
|---|---|
| Controller | `order.controller.ts` — 9 endpoints |
| Service | `order.service.ts` — addOrderItems, approve, decline, confirmPickup, deliver, expireTimers, findPending/Preparing/ReadyByBranch |
| Entity | `order.entity.ts` |
| DTOs | `create-order.dto.ts`, `approve-order.dto.ts`, `decline-order.dto.ts`, `update-order.dto.ts` |
| Scheduler | `order.scheduler.ts` — 30s cron for timer expiry |

### Bill Module

| Item | File |
|---|---|
| Controller | `bill.controller.ts` — 9 endpoints |
| Service | `bill.service.ts` — generateBill, processPayment, splitEvenly, splitByItem, applyDiscount |
| Entity | `bill.entity.ts` |

### Full Module Map (31 modules)

Auth, Admin, Advertisement, AI, Audit, Bill, Branch, Business, Dashboard, Department, Health, Ingredient, Menu, MenuCategory, MenuModifier, Notification, Order, POS, Printer, PublicMenu, Role, Shift, Subscription, Sync, Tab, Table, Tracking, Unit, Upload, User

---

## Section C — Entity Inventory

### Tab Entity (`tab.entity.ts`)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| branch_id | UUID | FK → branches.id, NOT NULL | |
| table_id | UUID | FK → tables.id, **NOT NULL** | Ground Truth |
| waiter_id | UUID | FK → users.id, **NOT NULL** | Ground Truth |
| shift_id | UUID | FK → shifts.id, NOT NULL | |
| customer_name | VARCHAR | nullable | Free-text, no FK |
| party_size | INT | nullable | |
| status | ENUM | open / billed / paid / voided | |
| tab_number | VARCHAR | NOT NULL | e.g. TAB-1712345678000 |
| notes | TEXT | nullable | |
| opened_at | TIMESTAMP | NOT NULL | |
| closed_at | TIMESTAMP | nullable | |
| created_at | TIMESTAMP | default now | |
| updated_at | TIMESTAMP | default now | |

### Order Entity (`order.entity.ts`)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| tab_id | UUID | FK → tabs.id, NOT NULL | |
| menu_item_id | UUID | FK → menu_items.id, NOT NULL | |
| quantity | INT | NOT NULL | |
| unit_price_kobo | INT | NOT NULL | |
| subtotal_kobo | INT | NOT NULL | |
| round_number | INT | default 1 | |
| order_status | VARCHAR | NOT NULL, default PENDING_SUPERVISOR_APPROVAL | |
| tracking_code | VARCHAR(5) | nullable, unique | Per-item code |
| tracking_generated_at | TIMESTAMP | nullable | |
| modifiers | JSONB | nullable | |
| assigned_department | UUID | nullable | |
| estimated_preparation_time_seconds | INT | nullable | |
| timer_started_at | TIMESTAMP | nullable | |
| timer_ends_at | TIMESTAMP | nullable | |
| actual_ready_time | TIMESTAMP | nullable | |
| approved_by | UUID | nullable | |
| approved_at | TIMESTAMP | nullable | |
| declined_by | UUID | nullable | |
| declined_at | TIMESTAMP | nullable | |
| decline_reason | TEXT | nullable | |
| delivered_by_supervisor | UUID | nullable | |
| delivered_at | TIMESTAMP | nullable | |
| preparing_at | TIMESTAMP | nullable | |
| voice_transcription | TEXT | nullable | |
| created_by | UUID | nullable | |
| notes | TEXT | nullable | |
| created_at | TIMESTAMP | default now | |
| updated_at | TIMESTAMP | default now | |

### Bill Entity (`bill.entity.ts`)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| tab_id | UUID | FK → tabs.id, NOT NULL | |
| branch_id | UUID | FK → branches.id, NOT NULL | |
| subtotal_kobo | INT | NOT NULL | |
| discount_kobo | INT | default 0 | |
| total_kobo | INT | NOT NULL | |
| payment_method | VARCHAR | cash / transfer / pos / card | |
| payment_ref | VARCHAR | nullable | |
| paid_at | TIMESTAMP | nullable | |
| idempotency_key | VARCHAR | nullable | Deduplication |
| created_by | UUID | NOT NULL | |
| created_at | TIMESTAMP | default now | |

### Complete Entity List (21 entities)

Tab, Order, Bill, User, Business, Branch, Table, Shift, MenuItem, MenuCategory, MenuModifier, MenuModifierOption, Department, Printer, StockMovement, Supplier, IngredientCategory, Notification, Subscription, SyncQueue, AuditLog

---

## Section D — Customer Journey (Current)

```
Customer arrives → Waiter assigns table → openTab()
  → Waiter takes order → addOrderItems() → PENDING_SUPERVISOR_APPROVAL
  → Supervisor approves → approve() → APPROVED + timer starts
  → Kitchen prepares (cron: every 30s checks timer_ends_at)
  → Timer expires → READY_FOR_PICKUP (auto, no Chef action)
  → Waiter picks up → confirmPickup() → OUT_FOR_DELIVERY
  → Waiter delivers → deliver() → DELIVERED
  → Customer requests bill → generateBill()
  → Customer pays → processPayment() → Bill recorded
  → Waiter closes tab → closeTab() → Tab PAID, Table AVAILABLE
```

### Critical Observations

- Chef has no dedicated endpoints — no "start preparing" or "mark complete"
- Orders created as `PENDING_SUPERVISOR_APPROVAL` — no self-approval for waiters
- `preparing_at` timestamp is set to `approved_at` (hack, acknowledged in code comment)
- `ASSIGNED_TO_DEPARTMENT`, `PREPARING`, `COMPLETED` statuses never set by any code path

---

## Section E — Tab Semantics

**Tab = dine-in session bound to a physical table.**

| Property | Current | Implication |
|---|---|---|
| `table_id NOT NULL` | Hard requirement | Every tab requires a physical table |
| `waiter_id NOT NULL` | Hard requirement | Every tab assigned to a waiter |
| Status values | `open → billed → paid` or `voided` | No concept of "pending" or "reserved" |
| Status enum | `TabStatus` in `shared.ts` | OPEN, BILLED, PAID, VOIDED |
| No `tab_type` | No discriminator | All tabs are implicitly dine-in |
| No `customer_id` | `customer_name` free-text | No customer identity/history |

Tab serves as: order container, billing unit, and table occupancy tracker simultaneously.

---

## Section F — Table Dependency Audit

### 46 references to `table_id` across the codebase

**Hard requirements (would crash without table_id):**

| Location | File | Line | Expression |
|---|---|---|---|
| Entity constraint | `tab.entity.ts` | — | `@Column({ nullable: false })` |
| DTO validation | `open-tab.dto.ts` | 6-8 | `@IsNotEmpty() @IsString() table_id` |
| TabService.openTab | `tab.service.ts` | 74 | `update(Table, savedTab.table_id, { status: OCCUPIED })` |
| TabService.findOne | `tab.service.ts` | 108 | `findOne({ where: { id: tab.table_id } })` |
| TabService.closeTab | `tab.service.ts` | 204 | `update(Table, tab.table_id, { status: AVAILABLE })` |
| TabService.voidTab | `tab.service.ts` | 286 | `tableRepo.update(tab.table_id, { status: AVAILABLE })` |
| TabService.transferTab | `tab.service.ts` | 239-241 | Multiple table_id reads/writes |
| TableService.release | `table.service.ts` | — | `update(tab.table_id, { status: AVAILABLE })` |

**Soft requirements (would return null, not crash):**

| Location | File | Line | Expression |
|---|---|---|---|
| Order dashboard SQL | `order.service.ts` | 351 | `t.table_id::text AS "tableId"` |
| Order dashboard SQL | `order.service.ts` | 352 | `tbl.table_number AS "tableNumber"` |
| Dashboard.overview | `dashboard.service.ts` | — | `occupiedTables = count where status=OCCUPIED` |
| Dashboard.tableVelocity | `dashboard.service.ts` | — | `GROUP BY t.table_id` |
| Printer receipt | `printer.service.ts` | — | Reads `tab.table.table_number` |
| Bill receipt | `bill.service.ts` | — | Reads `tab.table_id` for receipt |

**Migration effort: Medium.** Making `table_id` nullable requires:
1. Entity change (`@Column({ nullable: true })`)
2. DB migration (`ALTER TABLE tabs ALTER COLUMN table_id DROP NOT NULL`)
3. Guard clauses in all 7 hard reference locations
4. DTO change (`@IsOptional()` on `table_id`)
5. Frontend null handling for table display

---

## Section G — Order Domain

### Order Status Lifecycle (9 states defined, 6 actively used)

```
PENDING_SUPERVISOR_APPROVAL → APPROVED → READY_FOR_PICKUP → OUT_FOR_DELIVERY → DELIVERED
                              ↓
                         DECLINED
```

**States never set by code:** `ASSIGNED_TO_DEPARTMENT`, `PREPARING`, `COMPLETED`

### Stock Deduction

- Deduction happens at **two points**: order placement (`deductByTab` in `addOrderItems`) and payment (`processPayment` calls `deductByTab` again)
- Second call is idempotent — checks if `ORDER_CONSUMPTION` movement already exists for that order + tab combination
- Uses `pessimistic_write` lock on menu items during deduction

### Key Files

| File | Function |
|---|---|
| `order.service.ts:36-86` | `addOrderItems` — creates orders, deducts stock |
| `order.service.ts:153-211` | `approve` — assigns department, starts timer, generates tracking |
| `order.service.ts:213-244` | `decline` — sets DECLINED status |
| `order.service.ts:246-273` | `confirmPickup` — sets OUT_FOR_DELIVERY |
| `order.service.ts:275-304` | `deliver` — sets DELIVERED |
| `order.service.ts:434-453` | `expireTimers` — cron: APPROVED → READY_FOR_PICKUP |

---

## Section H — Order Item Domain

**Order IS the line item. There is no order header entity.**

- Each `Order` row = one `menu_item_id` + `quantity`
- No `OrderHeader` or `OrderGroup` entity
- No `fulfillment_type` field (dine-in serve vs takeaway pack)
- Per-item lifecycle enables implicit partial completion (some items READY, others still APPROVED)

### Implication for Takeaway

- Every line item in a takeaway order would need the same `fulfillment_type` — either set at order creation from `tab.tab_type`, or added per-item
- Per-item tracking codes are problematic: a customer ordering 5 items gets 5 different tracking codes

---

## Section I — Kitchen Domain

### Timer-Based Auto-Advance

- Cron job in `order.scheduler.ts` runs every 30 seconds
- Queries: `order_status: APPROVED AND timer_ends_at <= now()`
- Transitions: `APPROVED → READY_FOR_PICKUP`
- Sets `actual_ready_time` timestamp

### KDS (Kitchen Display System)

- `PrinterService` maintains in-memory RxJS `Subject` for order updates
- SSE endpoint streams order events to KDS clients
- Events are **lost on server restart** (in-memory, no persistence)

### Chef Role

- `UserRole.CHEF` exists in enum but has **zero dedicated endpoints**
- No "start preparing" or "mark complete" endpoints
- Comment in `order.service.ts:179-182` acknowledges this as a V1.2 gap

### Printer Support

- Thermal printer integration via `PrinterModule`
- Receipt and order-ticket printing
- Printer entity stores configuration per branch

---

## Section J — Payment Domain

### Bill Flow

```
generateBill(tabId)
  → Calculates subtotal from all DELIVERED orders on tab
  → Creates bill record with subtotal_kobo = 0
  → Returns bill with total_kobo computed from orders

processPayment(tabId, method, amount, ref)
  → Creates bill with payment details
  → Records payment method (cash/transfer/pos/card)
  → Deducts stock (idempotent 2nd pass)
  → Does NOT update tab status (closeTab is separate)

splitEvenly / splitByItem(tabId)
  → Creates multiple bill records for one tab
  → tab_id FK on Bill enables grouping

applyDiscount(tabId, type, value)
  → Updates discount_kobo on bill
  → Type: percentage or fixed
```

### Key Observations

- **No online payment gateway for orders** — Paystack is only used for subscription payments
- **"Payment = Recording"** — no verification/capture flow. Staff records method + reference; no webhook confirmation
- **Idempotency via `idempotency_key`** — prevents duplicate payment recording
- **`closeTab` does not verify bill was generated or paid** — can close unpaid tab

---

## Section K — Customer Tracking Domain

### Tracking Code System

- 5-character alphanumeric code (uppercase letters + digits)
- Generated in `TrackingService.generateUniqueCode()` — loops until unique
- Generated at order **approval** time (not at creation)
- Stored on individual `Order` rows (per-item)
- `tracking_generated_at` timestamp set alongside code

### Public Tracking Endpoint

```
GET /api/v1/tracking/:code
  → No authentication required
  → Rate limited: 20 requests/minute
  → Returns: order details, tab info, branch info, bill info
  → Designed for customer self-service
```

### Gaps

- **No QR generation** — product name implies QR codes but none are generated
- **Per-item tracking is cumbersome** — customer wants one code per order/session, not per line item

---

## Section L — Notification & Event Architecture

### Notification Types (7 defined, 2 actively used)

| Type | Used? | Trigger |
|---|---|---|
| `ORDER_PENDING_APPROVAL` | ❌ | — |
| `ORDER_APPROVED` | ✅ | `order.service.ts:202-208` |
| `ORDER_PREPARING` | ❌ | — |
| `ORDER_READY` | ✅ | `order.scheduler.ts` |
| `ORDER_DECLINED` | ❌ | — |
| `PAYMENT_RECEIVED` | ❌ | — |
| `TABLE_ASSIGNED` | ❌ | — |

### Notification Architecture

- **DB-persisted** — notifications stored in `notifications` table
- **Polled** — clients query `GET /notifications` endpoint
- **No push** — no WebSocket, no Firebase, no SSE for notification delivery
- **Branch-scoped** — filtered by `branch_id`

### Event Architecture for KDS

- In-memory RxJS `Subject` in `PrinterService`
- Order updates published to Subject on: create, approve, decline, pickup, deliver
- SSE endpoint (`/printer/orders/stream`) subscribes to Subject
- **Events lost on restart** — no persistence layer

---

## Section M — Reporting Model

### Dashboard Endpoints (5 in `DashboardService`)

| Report | Endpoint | Table-Dependent? |
|---|---|---|
| Branch Overview | `GET /dashboard/overview` | Yes — `occupiedTables = count(status=OCCUPIED)` |
| Waiter Performance | `GET /dashboard/waiter-performance` | No — grouped by waiter_id |
| Sales Report | `GET /dashboard/sales` | No — by payment method |
| Peak Hours | `GET /dashboard/peak-hours` | No — by creation hour |
| Top Items | `GET /dashboard/top-items` | No — by menu_item_id |
| Table Velocity | `GET /dashboard/table-velocity` | Yes — `GROUP BY t.table_id` |
| Peak Efficiency | `GET /dashboard/peak-efficiency` | No — by hour |

### Admin Reports (`AdminService`)

- `getStats()` — business-wide: businesses, branches, users, revenue, subscriptions
- No table dependency

### Ingredient Reports (`IngredientService`)

- `bestsellers` — paid tabs by branch, aggregated by menu_item_id. No table dependency.
- `stockVariance`, `audit`, `dailyTally` — stock ledger. No table dependency.

### Shift Reports (`ShiftService`)

- `getShiftSummary` — by branch + date range. Joins Tab for branch scoping only. No direct table_id dependency.

---

## Section N — Business Rules

### 15 Rules Identified, 12 Enforced, 3 Gaps

| # | Rule | Enforced In | Status |
|---|---|---|---|
| 1 | Only one active Tab per table | `tab.service.ts:44-56` | ✅ |
| 2 | Cannot order without active Tab | `order.service.ts:51-54` | ⚠️ Partial — doesn't check tab is open |
| 3 | Cannot bill closed Tab | `bill.service.ts:46-61` | ⚠️ Partial — doesn't check tab status |
| 4 | Cannot pay twice (idempotency) | `bill.service.ts:134-141` | ✅ |
| 5 | Cannot assign occupied table | `tab.service.ts:44-56` | ✅ |
| 6 | Cannot pickup before Ready | `order.service.ts:255` | ✅ |
| 7 | Cannot deliver before Pickup/Ready | `order.service.ts:284` | ✅ |
| 8 | Cannot close unpaid bill | `tab.service.ts:199-207` | ❌ No check |
| 9 | Cannot remove order after approval | `order.service.ts:131-134` | ❌ No check |
| 10 | Cannot void paid tab | `tab.service.ts:255-257` | ✅ |
| 11 | Cannot approve declined order | `order.service.ts:162-163` | ✅ |
| 12 | Waiter can only access own tab | `tab.service.ts:97-106` | ✅ |
| 13 | Cannot split voided/paid tab | `bill.service.ts:237-239` | ❌ No check |
| 14 | Stock cannot go negative | `ingredient.service.ts:278-282` | ✅ |
| 15 | Must have open shift to open tab | `tab.service.ts:36-41` | ✅ |

### Critical Gaps

**Gap 1 — `addOrderItems` does not check tab status:**
```typescript
// order.service.ts:51-54
const tab = await this.tabRepository.findOne({ where: { id: tabId } });
if (!tab) throw new NotFoundException('Tab not found');
// No check: if (tab.status !== 'open') throw ...
```
This means orders can be added to `billed`, `paid`, or `voided` tabs.

**Gap 2 — `closeTab` does not verify bill exists:**
```typescript
// tab.service.ts:199-207
await queryRunner.manager.update(Tab, id, { status: 'paid', closed_at: new Date() });
await queryRunner.manager.update(Table, tab.table_id, { status: AVAILABLE });
```
No check that a bill was generated or paid before closing.

**Gap 3 — `removeOrder` does not check order status:**
```typescript
// order.service.ts:131-134
const order = await this.findOne(id, branchId);
await this.orderRepository.remove(order);
```
A Supervisor can delete an approved order without constraint.

---

## Section O — API Contract

### 31 Controllers, ~80 Endpoints

#### Auth (12 endpoints)

| Method | Route | Auth | Rate Limit |
|---|---|---|---|
| POST | `/auth/register` | None | 5/60s |
| POST | `/auth/login` | None | 5/60s |
| POST | `/auth/waiter-login` | None | 5/60s |
| POST | `/auth/refresh` | None | 10/60s |
| POST | `/auth/logout` | None | — |
| POST | `/auth/forgot-password` | None | 3/3600s |
| POST | `/auth/reset-password` | None | 3/3600s |
| POST | `/auth/send-verification` | JWT | — |
| POST | `/auth/verify-email` | JWT | — |
| POST | `/auth/setup-super-admin` | None | 3/3600s |
| POST | `/auth/resolve-business` | None | 10/60s |
| POST | `/auth/impersonate` | JWT | — |

#### Tabs (7 endpoints)

| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/tabs` | JWT | Paginated, filter by status/waiter |
| GET | `/tabs/waiter-list` | JWT | Waiter dropdown |
| POST | `/tabs/open` | JWT | **Requires `table_id`** |
| GET | `/tabs/:id` | JWT | Includes table, waiter, orders |
| POST | `/tabs/:id/close` | JWT | Marks paid + frees table |
| POST | `/tabs/:id/transfer` | JWT | Supervisor+ |
| POST | `/tabs/:id/void` | JWT | Supervisor+, stock reversal |

#### Orders (9 endpoints)

| Method | Route | Auth | Notes |
|---|---|---|---|
| POST | `/orders/tab/:tabId` | JWT | Add items |
| GET | `/orders/pending` | JWT | Pending approval (grouped by tab) |
| GET | `/orders/preparing` | JWT | Approved + in progress |
| GET | `/orders/ready-for-pickup` | JWT | Ready items |
| GET | `/orders/tab/:tabId` | JWT | Items by tab |
| PATCH | `/orders/:id` | JWT | Modify quantity/modifiers |
| DELETE | `/orders/:id` | JWT | **No status check** |
| POST | `/orders/:id/approve` | JWT | Supervisor+ |
| POST | `/orders/:id/decline` | JWT | Supervisor+ |
| POST | `/orders/:id/confirm-pickup` | JWT | → OUT_FOR_DELIVERY |
| POST | `/orders/:id/deliver` | JWT | → DELIVERED |

#### Bills (9 endpoints)

| Method | Route | Auth | Notes |
|---|---|---|---|
| POST | `/bills/tab/:tabId/generate` | JWT | |
| POST | `/bills/tab/:tabId/pay` | JWT | Record payment |
| POST | `/bills/tab/:tabId/apply-discount` | JWT | |
| POST | `/bills/tab/:tabId/split-evenly` | JWT | |
| POST | `/bills/tab/:tabId/split-by-item` | JWT | |
| GET | `/bills/tab/:tabId/splits` | JWT | |
| POST | `/bills/tab/:tabId/splits/:billId/pay` | JWT | |
| GET | `/bills/tab/:tabId/receipt` | JWT | JSON |
| GET | `/bills/tab/:tabId/receipt/pdf` | JWT | PDF |

### Breaking Change Risk Assessment

| Change | Risk | Mitigation |
|---|---|---|
| `POST /tabs/open` DTO `table_id` → optional | HIGH | Frontend always sends it; adding `@IsOptional()` is backward-compatible for new tabs |
| `GET /tabs/:id` response `table` → may be null | MEDIUM | Frontend must handle `table: null` |
| `GET /orders/pending|preparing|ready` response `tableNumber` → null | MEDIUM | Dashboard UI must show "Walk-in" for null |
| `POST /orders/tab/:tabId` same route for all session types | LOW | Route works regardless — tab is just the container |

---

## Section P — Dependency Graph

### Core Dependency Chains

```
Branch → Business
Branch → Subscription
User → Business, Branch, Role
Table → Branch
Tab → Branch, Table, Shift, Waiter(User)
Order → Tab, MenuItem (→ Tab → Branch for scoping)
Bill → Tab (→ Branch, → Table for status update)
Bill → Order (via Tab grouping, not direct FK)
StockMovement → Branch, MenuItem, Tab (via reference_id)
Shift → Branch
Notification → Branch
SyncQueue → (various via payload)
```

### Coupling Analysis

| Entity | Incoming Dependencies | Coupling Level |
|---|---|---|
| **Tab** | Order, Bill, StockMovement, Printer, Dashboard, Sync | **Highest — 6+ modules** |
| Branch | Tab, Order, Bill, User, Table, Menu, Shift, Notification, Subscription | Very high |
| Order | Bill (via Tab), Dashboard, Ingredient, Notification, Printer, Tracking | High |
| Table | Tab, Dashboard, TableService | Medium |

### Critical Dependency: Table → Tab → Bill

- Table status (`OCCUPIED`/`AVAILABLE`) is entirely managed through Tab lifecycle
- `openTab()` → Table becomes OCCUPIED
- `closeTab()` → Table becomes AVAILABLE
- `voidTab()` → Table becomes AVAILABLE
- `transferTab()` → Old table AVAILABLE, new table OCCUPIED
- No way to mark a table available without going through tab lifecycle
- For takeaway: a session that doesn't use a table must not interfere with this flow

---

## Section Q — Feasibility Assessment

### Stage-by-Stage Analysis

| Stage | Current | Desired | Mismatch | Complexity |
|---|---|---|---|---|
| Customer Arrives | No arrival event | Arrival → type selection | **Mismatch** | New domain (Session) |
| Choose Experience | Implicitly dine-in (table) | Dine-in / Walk-in / Future Delivery | **Mismatch** | Medium |
| Open Session | `POST /tabs/open` requires `table_id` | Open session without table | **Mismatch** | Medium |
| Assign Table | Required at open | Optional (dine-in only) | **Mismatch** | Medium |
| Order | `POST /orders/tab/:tabId` | Order against session | **Low mismatch** | Low — same route works |
| Approval | Supervisor per-item | Same | **None** | — |
| Kitchen → Ready | Auto-timer expiry | Same | **None** | — |
| Pickup | Supervisor confirms | Waiter serves OR counter packs | **Mismatch** | Medium (fulfillment_type) |
| Serve vs Pack | Only "serve" path | Both paths | **Mismatch** | Medium (packaging concept) |
| Continue Ordering | Supported | Same | **None** | — |
| Request Bill | `POST /bills/tab/:tabId/generate` | Same | **None** | — |
| Payment | Staff records | Same | **Low** | Table skip |
| Close Session | Updates table available | Session closed (table optional) | **Mismatch** | Low |
| Customer Identity | Free-text `customer_name` | Proper Customer entity | **Mismatch** | High (new entity) |
| Tracking | Per-item tracking code | Per-session tracking | **Mismatch** | Low |

### Overall Assessment

**The current Tab can evolve into a Customer Session with moderate changes:**

- **Entity changes + DB migration**: Make `table_id` and `waiter_id` nullable, add `tab_type` enum (dine_in, walkin_takeaway), add `fulfillment_type` to Order
- **New domain object**: Customer entity, packaging/takeaway bag concept
- **New endpoints**: Chef "mark as preparing", takeaway-specific fulfillment
- **Service refactor**: Conditional skip of table status updates when `tab_type != dine_in`
- **Breaking changes**: `POST /tabs/open` DTO, API responses with `table`

**7 out of 15 stages have zero or low mismatch** — the migration is feasible as an evolution, not a rewrite.

---

## Section R — Blast Radius

### If `table_id` Is Made Nullable on Tab

**Direct failures (would crash at runtime):**

| File | Line | Expression | Failure Mode |
|---|---|---|---|
| `tab.service.ts` | 74 | `update(Table, savedTab.table_id, { status: OCCUPIED })` | `table_id` is undefined — WHERE clause matches nothing, table never marked OCCUPIED |
| `tab.service.ts` | 108 | `findOne({ where: { id: tab.table_id } })` | Returns null — response includes `table: null` (fine if frontend handles) |
| `tab.service.ts` | 204 | `update(Table, tab.table_id, { status: AVAILABLE })` | Same as #74 — table never freed |
| `tab.service.ts` | 286 | `tableRepo.update(tab.table_id, ...)` | Same — void reversal can't free table |
| `tab.service.ts` | 239-241 | Transfer table operations | Transfer is meaningless for takeaway |
| `bill.service.ts` | 83-87 | Reads `tab.table_id` to free table | Would need null guard |

**Non-crashing null returns:**

| Location | Field | Impact |
|---|---|---|
| `order.service.ts:351-352` | `tableId`, `tableNumber` | Dashboard SQL returns null for these columns |
| `printer.service.ts` | `table_number` | Receipt would show null/empty |
| `bill.service.ts` | `table_id` | Receipt would show null table |

### If `waiter_id` Is Made Nullable on Tab

| File | Line | Expression | Failure Mode |
|---|---|---|---|
| `tab.service.ts` | 97-106 | Waiter ownership check | `tab.waiter_id` is null → ownership checks skip (any waiter can access) |
| `tab.service.ts` | 160-178 | `getTabWaiters` | Already handles null (`IS NOT NULL` in query) |
| `order.service.ts` | 319-322 | Waiter filter | `t.waiter_id = $N` — already handles via optional WHERE |

### Recommended Approach (Lowest Blast Radius)

1. Make `table_id` and `waiter_id` nullable in entity + migration
2. Guard all table-level operations with `if (!tab.table_id) return`
3. Keep `OpenTabDto.table_id` as-is for dine-in; add `tab_type` field to DTO to conditionally require `table_id`
4. Frontend: update tab card/list to conditionally render "(Walk-in)" instead of table number

---

## Section S — Technical Debt Catalog

### Critical (Blocks Customer Session Migration)

| # | Debt | Location | Impact | Fix |
|---|---|---|---|---|
| S1 | Tab is both session and order container | `Tab` entity + service | No way to have session without dine-in table | Add `tab_type` discriminator |
| S2 | Order IS the line item (no header) | `Order` entity | Cannot track per-order fulfillment type | Add `fulfillment_type` or `OrderHeader` |
| S3 | PBAC migration incomplete (`role_id` nullable) | `users` table | PermissionsGuard can't evaluate for users without role_id | Complete DB migration |
| S4 | No event bus | Event system | Notifications DB-polled; KDS events in-memory RxJS | Introduce pub-sub (Redis) |
| S5 | No customer identity | No `Customer` entity | Can't track repeat customers or loyalty | New `Customer` entity |

### High

| # | Debt | Location | Evidence |
|---|---|---|---|
| S6 | Double stock deduction | `order.service.ts:78` + `bill.service.ts` | Deducted at order AND payment. Second call idempotent but wasteful. |
| S7 | Business rules not enforced | Several services | `addOrderItems` doesn't check tab open; `closeTab` doesn't verify bill paid; `splitEvenly` doesn't check tab status |
| S8 | No Chef endpoints | Chef role defined, no routes restricted | `preparing_at` = `approved_at` with hack comment |
| S9 | Role entity not integrated | `Role` module | Entity exists but `RolesGuard` uses `user.role` string, not Role entity |
| S10 | N+1 queries in `findByTab` | `tab.service.ts:108-116` | Individual queries for table, waiter, orders — should use JOIN |
| S11 | Hard-coded table status | `tab.service.ts:74,204,239-241,286` | Table OCCUPIED/AVAILABLE entirely managed through Tab lifecycle |
| S12 | Per-item tracking codes | `order.service.ts:171` | Each line item gets own 5-char code; customer wants one per order |

### Medium

| # | Debt | Location | Evidence |
|---|---|---|---|
| S13 | Unused order states | `shared.ts` | `ASSIGNED_TO_DEPARTMENT`, `PREPARING`, `COMPLETED` never set |
| S14 | Unused notification types | `notification.entity.ts` | 5 of 7 types have zero subscriptions |
| S15 | No WebSocket | No gateway file | All updates require polling or manual refresh |
| S16 | No QR generation | `tracking.service.ts` | QR code never generated despite product mentions |
| S17 | No hourly rental / time-based billing | `Tab` entity | No duration tracking |
| S18 | Admin service in API app | `admin.service.ts` | Admin endpoints alongside customer-facing API |

---

## Section T — Final Recommendations

### Phase 1 — Foundation (1-2 weeks)

1. **Add `tab_type` enum** to Tab: `dine_in`, `walkin_takeaway`. Default `dine_in` for backward compatibility.
2. **Make `table_id` and `waiter_id` nullable** in entity + migration. Create DB migration: `ALTER TABLE tabs ALTER COLUMN table_id DROP NOT NULL, ALTER COLUMN waiter_id DROP NOT NULL`.
3. **Guard all table operations**: In `tab.service.ts`, wrap `update(Table, ...)` with `if (!tab.table_id) return` in `openTab`, `closeTab`, `voidTab`, `transferTab`.
4. **Add `tab_type` to `OpenTabDto`** as optional (default `dine_in`). For `walkin_takeaway`, skip table existence/status checks.
5. **Add `fulfillment_type` to Order**: `serve` (waiter brings to table) or `pack` (counter pickup). Default `serve`.

### Phase 2 — Takeaway Flow (1 week)

6. **Create `POST /tabs/open-takeaway`** endpoint or add `tab_type` branch to existing `openTab`.
7. **Update dashboard SQL** (`order.service.ts:324-395`): `COALESCE(tbl.table_number, 'TAKEAWAY')` for `tableNumber`.
8. **Add pack flow order status**: `PACKED` between `READY_FOR_PICKUP` and `DELIVERED`.
9. **Update notification**: Trigger `ORDER_READY` with `fulfillment_type` so KDS shows "Pack" vs "Serve".

### Phase 3 — Customer Identity (1-2 weeks)

10. **Create `Customer` entity**: `id, business_id, name, phone, email, visit_count, last_visit, created_at`.
11. **Add `customer_id FK nullable` to Tab**.
12. **Create `POST /customers` endpoint** for creating/retrieving customer by phone.
13. **Update tracking**: Move tracking code from Order (per-item) to Tab (per-session).

### Phase 4 — Maturity (2-4 weeks)

14. **Complete PBAC migration**: `users.role_id NOT NULL`, remove `user.role` string column, wire PermissionsGuard as primary auth.
15. **Introduce event bus** (Redis pub-sub): Replace in-memory RxJS OrderSubjects, enable push notifications.
16. **Add WebSocket gateway**: Real-time KDS updates, order status push, bill notifications.
17. **Build Chef endpoints**: `POST /orders/:id/start-preparing`, `POST /orders/:id/mark-completed`.
18. **Add Customer-facing portal** (separate module): QR code generation, order tracking page, payment link generation.

### Architecture Decision Record

**Decision 1: Tab → Session rename or not?**
- *Option A*: Rename `Tab` → `Session` everywhere. Clean semantics but massive refactor across 31 modules.
- *Option B (Recommended)*: Keep `Tab` as DB/physical entity name, add a `TabSessionView` or service-layer abstraction returning "Session" semantics. Rename later when codebase stabilizes.

**Decision 2: Order header or fulfillment_type on Order?**
- *Option A*: Add `OrderHeader` entity (one header → many line items). Closest to POS standard but requires changing entire order creation, approval, and billing flow.
- *Option B (Recommended)*: Add `fulfillment_type` per line item. Consistent with current "Order is the line item" pattern.

**Decision 3: Single session model or separate?**
- *Option A*: One `Session` type with nullable table_id, waiter_id, customer_id, order_type.
- *Option B (Recommended)*: Single `Tab` entity with `tab_type` discriminator + service-layer abstractions (`DineInTabService`, `TakeawayTabService`) inheriting from `BaseTabService`. Keeps schema simple while enabling type-specific business rules.

---

*End of Architectural Audit — 20 Sections Complete*

*Generated: July 28, 2026*