# ServeIQ — Master Development Checklist
> **Generated:** June 2026 | **Source of Truth:** Project Bible v1.0
> **Stack:** NestJS · PostgreSQL · TypeORM · Angular (Admin) · Ionic + Capacitor (Waiter Mobile)
> **Rule:** Every task below must pass the non-negotiables: UUID PKs · integer kobo · UTC timestamps · soft deletes only · branch_id scope on every query

---

## PHASE 0 — PROJECT SETUP & INFRASTRUCTURE

### 0.1 Repository & Monorepo
- [ ] Initialise Git monorepo (e.g. `serveiq/`)
- [ ] Create `apps/api` — NestJS backend
- [ ] Create `apps/admin` — Angular standalone web app
- [ ] Create `apps/waiter` — Ionic + Capacitor mobile app
- [ ] Create `libs/shared` — shared types, DTOs, constants
- [ ] Add `.gitignore`, `README.md`, `CONTRIBUTING.md`
- [ ] Configure ESLint + Prettier (TypeScript strict mode)
- [ ] Set up Husky pre-commit hooks (lint + format)

### 0.2 Backend Bootstrap (NestJS)
- [ ] Scaffold NestJS project with TypeScript strict mode
- [ ] Install & configure TypeORM with PostgreSQL driver
- [ ] Install `class-validator` + `class-transformer` for DTO validation
- [ ] Set up global `ValidationPipe` (whitelist: true, forbidNonWhitelisted: true)
- [ ] Configure environment variables via `@nestjs/config` + `.env` files
- [ ] Set up environment files: `.env.development`, `.env.staging`, `.env.production`
- [ ] Configure CORS policy
- [ ] Set up global response envelope interceptor (`{ success, data, meta }`)
- [ ] Set up global HTTP exception filter (standardised error format)
- [ ] Set up rate limiting (`@nestjs/throttler`): 200 req/min auth, 20 req/min public, 30 req/min reports
- [ ] Configure Swagger/OpenAPI (`@nestjs/swagger`) on `/api/docs`
- [ ] Set up versioned routing prefix (`/api/v1`)
- [ ] Set up background job processing (`@nestjs/bull`) with Redis
- [ ] Configure Cloudinary for product image optimization (V2 prep)
- [ ] Set up health-check endpoint (`GET /health`)

### 0.3 Database Setup
- [ ] Provision PostgreSQL instance (local dev + staging)
- [ ] Configure TypeORM DataSource with connection pooling
- [ ] Enable UUID extension (`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`)
- [ ] Set up TypeORM migrations folder (`src/database/migrations/`)
- [ ] Write and run initial migration (all V1 tables)
- [ ] Set up seed script for dev environment (1 business, 1 branch, sample menu)
- [ ] Verify all indexes exist post-migration

### 0.4 Frontend Bootstrap (Angular Admin)
- [ ] Scaffold Angular 17+ standalone project
- [ ] Install Angular Material or chosen UI library
- [ ] Configure environment files (`environment.ts`, `environment.prod.ts`)
- [ ] Set up HTTP interceptor for JWT token attachment
- [ ] Set up HTTP interceptor for 401 → auto-refresh token
- [ ] Set up routing with lazy-loaded feature modules
- [ ] Set up AuthGuard for protected routes
- [ ] Set up RoleGuard for role-restricted pages

### 0.5 Mobile App Bootstrap (Ionic + Capacitor)
- [ ] Scaffold Ionic 7 + Angular project
- [ ] Add Capacitor for iOS and Android targets
- [ ] Install `@capacitor-community/sqlite` for offline SQLite
- [ ] Configure deep linking and app scheme
- [ ] Set up environment config for API base URL
- [ ] Set up HTTP interceptors (JWT, refresh, offline queue)
- [ ] Set up network status detection service
- [ ] Configure Capacitor plugins: Camera (receipt), Bluetooth (printer V2)

### 0.6 CI/CD & Hosting
- [x] Set up GitHub Actions pipeline: lint → test → build on PR
- [ ] Configure Railway or Render for NestJS backend deployment
- [ ] Configure Vercel for Angular admin deployment
- [ ] Set up staging environment auto-deploy on `main` merge
- [ ] Set up production deploy on tagged release
- [ ] Configure environment secrets in CI/CD provider

---

## PHASE 1 — BACKEND: CORE API (V1)

### 1.1 Database Entities & Migrations
- [ ] **Migration 001** — Create `businesses` table (UUID PK, name, slug UNIQUE, type ENUM, owner_id, email, phone, address, currency, subscription_plan, is_active, timestamps, deleted_at)
- [ ] **Migration 002** — Create `branches` table (UUID PK, business_id FK, name, address, phone, settings JSONB, is_active, timestamps, deleted_at) + index on `business_id`
- [ ] **Migration 003** — Create `users` table (UUID PK, business_id FK, branch_id FK, full_name, email, phone, password_hash, role enum, is_active, email_verified_at, last_login_at, invited_by FK, timestamps, deleted_at) + indexes on business_id, branch_id, role
- [ ] **Migration 004** — Create `tables` table (UUID PK, branch_id FK, table_number, label, capacity, status enum, timestamps, deleted_at) + unique (branch_id, table_number) + indexes
- [ ] **Migration 005** — Create `menu_items` table (UUID PK, branch_id FK, name, category, price_kobo INTEGER NOT NULL, unit, sku, barcode, image_url, is_available, created_by FK, timestamps, deleted_at) + indexes on branch_id, category
- [ ] **Migration 006** — Create `tabs` table (UUID PK, branch_id FK, table_id FK, waiter_id FK, cashier_id FK, tab_number UNIQUE, customer_name, party_size, status enum, notes, opened_at, billed_at, closed_at, timestamps) + composite index (branch_id, status) + indexes on waiter_id, table_id, opened_at
- [ ] **Migration 007** — Create `orders` table (UUID PK, tab_id FK, menu_item_id FK, quantity > 0, unit_price_kobo INTEGER, subtotal_kobo GENERATED ALWAYS AS (quantity * unit_price_kobo) STORED, round_number, voice_transcription, notes, created_by FK, timestamps) + indexes on tab_id, menu_item_id, created_at
- [ ] **Migration 008** — Create `bills` table (UUID PK, tab_id FK UNIQUE, subtotal_kobo, service_charge_kobo, discount_kobo, total_kobo, payment_method enum, payment_reference, paid_at, issued_by FK, receipt_url, timestamps) + indexes on tab_id, paid_at, payment_method
- [ ] Verify all constraints (CHECKs, NOT NULLs, UNIQUEs) are enforced at DB level
- [ ] Verify no float types used for any monetary column

### 1.2 Auth Module
- [ ] `POST /auth/register` — register business owner, create business + default "Main Branch" + owner user record
- [ ] Email verification: send OTP/link on register
- [ ] `POST /auth/verify-email` — verify email with OTP/link
- [ ] `POST /auth/login` — validate credentials, return JWT access token (15m) + set HTTP-only refresh cookie (7d)
- [ ] `POST /auth/refresh` — validate refresh cookie, issue new access token
- [ ] `POST /auth/logout` — invalidate refresh token (delete from store or blacklist)
- [ ] `POST /auth/forgot-password` — send reset email
- [ ] `POST /auth/reset-password` — validate reset token, hash new password
- [ ] Implement `JwtStrategy` (Passport) — extract and validate JWT payload
- [ ] Implement `JwtAuthGuard` — protect all non-public routes
- [ ] Implement `RolesGuard` + `@Roles()` decorator — RBAC enforcement
- [ ] Implement `BranchScopeGuard` — inject and validate branch_id on all branch-scoped routes
- [ ] Store refresh tokens (Redis or DB table)
- [ ] Hash passwords with bcrypt (rounds: 12)
- [ ] Implement login lockout logic (5 failed attempts → 15m lockout)
- [ ] Unit tests: login, register, refresh, logout flows

### 1.3 Business Module
- [ ] `POST /businesses` — create business (owner only, called from registration flow)
- [ ] `GET /businesses/:id` — get business details (owner only)
- [ ] `PATCH /businesses/:id` — update business info (name, address, logo, currency)
- [ ] `GET /businesses/:id/stats` — high-level stats: total branches, total staff, today's revenue across all branches

### 1.4 Branch Module
- [ ] `POST /branches` — create branch (scoped to authenticated owner's business)
- [ ] `GET /branches` — list branches for current business
- [ ] `GET /branches/:id` — get branch details
- [ ] `PATCH /branches/:id` — update branch
- [ ] `DELETE /branches/:id` — soft delete (set deleted_at, is_active: false)
- [ ] Validate: branch belongs to authenticated user's business on every operation

### 1.5 User Management Module
- [ ] `POST /users/invite` — invite staff by email + role; send invite email with setup link
- [ ] `GET /users` — list users scoped to branch/business (with role filter)
- [ ] `GET /users/me` — get own profile
- [ ] `PATCH /users/me` — update own profile (name, phone, password)
- [ ] `GET /users/:id` — get staff member profile (manager/owner only)
- [ ] `PATCH /users/:id` — update staff member
- [ ] `PATCH /users/:id/deactivate` — deactivate user (soft, is_active: false)
- [ ] Role validation: owner can create manager/waiter/cashier; manager can create waiter

### 1.6 Table Module
- [ ] `POST /tables` — create table (branch-scoped, owner/manager only)
- [ ] `GET /tables` — list tables for branch (includes current status)
- [ ] `GET /tables/:id` — get table with active tab summary if occupied
- [ ] `PATCH /tables/:id` — update table (label, capacity)
- [ ] `PATCH /tables/:id/status` — manual status update (manager override)
- [ ] `DELETE /tables/:id` — soft delete (only if no open tabs)
- [ ] Enforce unique table_number per branch at service layer

### 1.7 Menu Items Module
- [ ] `POST /menu-items` — create item (branch-scoped, owner/manager only)
- [ ] `GET /menu-items` — list items (filterable by category, is_available)
- [ ] `GET /menu-items/:id` — get single item
- [ ] `PATCH /menu-items/:id` — update item (price change only affects future orders)
- [ ] `PATCH /menu-items/:id/toggle` — toggle availability (is_available flip)
- [ ] `DELETE /menu-items/:id` — soft delete (set deleted_at)
- [ ] Price changes must NOT update existing order rows — snapshot is immutable

### 1.8 Tab Module
- [ ] `POST /tabs` — open new tab (validate: table is available, no existing open tab on table; auto-generate tab_number TAB-YYYY-NNNNN; set table status to 'occupied')
- [ ] `GET /tabs` — list tabs (filterable: status, waiter_id, date_from, date_to)
- [ ] `GET /tabs/active` — all currently open tabs in branch
- [ ] `GET /tabs/:id` — get tab with all orders grouped by round
- [ ] `PATCH /tabs/:id` — update tab metadata (notes, customer_name, party_size)
- [ ] `POST /tabs/:id/void` — void tab (manager only, requires reason, audit log entry, set table back to available)
- [ ] Tab number generation: sequential per branch per year, zero-padded (TAB-2026-00001)
- [ ] Enforce: only one open tab per table at a time (409 TAB_ALREADY_OPEN)

### 1.9 Order Module
- [ ] `POST /tabs/:tabId/orders` — add order items to tab (validate: tab is open, items are available, quantities > 0; snapshot unit_price_kobo from menu_items.price_kobo at time of order; auto-assign round_number)
- [ ] Round number logic: auto-increment round if last order on tab > 10 minutes ago, OR if waiter explicitly starts new round
- [ ] `GET /tabs/:tabId/orders` — get all orders on tab grouped by round
- [ ] `PATCH /orders/:id` — update quantity (only while tab status = 'open'; log change)
- [ ] `DELETE /orders/:id` — remove order item (only while tab open; manager audit trail required)
- [ ] Validate: tab belongs to authenticated user's branch (`BranchScopeGuard`)
- [ ] Enforce: unit_price_kobo is ALWAYS the snapshot value, never re-fetched from menu_items on update

### 1.10 Billing Module
- [ ] `POST /tabs/:tabId/bill` — generate bill (sum all orders.subtotal_kobo; apply service_charge_percent; apply discount_kobo; set tab status to 'billed'; record billed_at)
- [ ] Validate: tab must be 'open' to generate bill (400 TAB_NOT_OPEN)
- [ ] Validate: bill cannot already exist for tab (409 BILL_ALREADY_GENERATED)
- [ ] `GET /tabs/:tabId/bill` — get generated bill with full itemised breakdown
- [ ] `POST /bills/:id/pay` — mark bill as paid (record payment_method, payment_reference, paid_at; set tab status to 'paid'; set table status to 'available')
- [ ] Validate: payment_method is required; transfer/POS require payment_reference
- [ ] Validate: bill not already paid (409 PAYMENT_ALREADY_RECORDED)
- [ ] `GET /bills/:id/receipt` — generate and return PDF receipt
- [ ] PDF receipt must include: business name + logo, branch name + address + phone, receipt number (RCT-YYYY-NNNNN), tab number, table number, waiter name, date/time, all items with qty + unit price + subtotal, service charge (if any), discount (if any), grand total, payment method
- [ ] Store generated receipt PDF to file storage (S3/R2) and save URL to bills.receipt_url

### 1.11 Dashboard & Reports Module
- [ ] `GET /dashboard/branch` — branch overview: open table count, occupied table count, today's revenue (sum paid bills), open tab count, closed tab count today
- [ ] `GET /dashboard/waiters` — waiter performance: name, tabs_closed today, total_sales_naira today
- [ ] `GET /reports/sales` — sales report (filter: date_from, date_to, waiter_id): total revenue, transaction count, average bill, breakdown by payment method
- [ ] `GET /reports/items` — top items report (filter: date range): item name, category, total_sold, revenue
- [ ] `GET /reports/export` — export sales report as PDF
- [ ] Real-time WebSocket gateway: emit `tab.opened`, `tab.closed`, `tab.updated` events to branch room
- [ ] Dashboard subscribes to branch room; updates without refresh

### 1.12 Cross-Cutting Concerns
- [ ] Audit log: on every void, order delete, bill generation, payment — log (entity, entity_id, action, user_id, payload, timestamp)
- [ ] Implement `AuditService` injectable across modules
- [ ] All monetary arithmetic done in integer kobo throughout; convert to Naira only in response DTOs
- [ ] Global pagination: all list endpoints support `page` + `per_page` query params; return `meta` in response
- [ ] Implement `BranchScopeGuard` — read branch_id from JWT payload, reject if user's branch_id ≠ requested resource's branch_id
- [ ] Write unit tests for: billing calculation, tab state machine, order round logic
- [ ] Write e2e tests for: full order flow (open tab → add orders → generate bill → pay → receipt)

---

## PHASE 2 — ADMIN WEB APP (Angular)

### 2.1 Auth & Onboarding
- [ ] Screen: Register Business (business name, type, owner name, email, password, phone, address)
- [ ] Screen: Email Verification (enter OTP or click link)
- [ ] Screen: Login (email + password)
- [ ] Onboarding wizard: Step 1 — Branch setup; Step 2 — Add tables; Step 3 — Add menu items; Step 4 — Invite staff
- [ ] JWT token handling: store access token in memory, refresh token in HTTP-only cookie
- [ ] Auto-refresh token on 401 response (silent)
- [ ] Redirect to login on auth failure

### 2.2 Dashboard Screen
- [ ] KPI cards: Total Revenue Today, Open Tabs, Closed Tabs Today, Total Orders Today
- [ ] Table grid: all tables with colour-coded status (Green = Available, Red = Occupied, Yellow = Reserved)
- [ ] Click occupied table → modal showing active tab summary (waiter, items, running total, time open)
- [ ] Waiter performance panel: name, tabs, sales (today)
- [ ] Real-time updates via Socket.IO subscription to branch room
- [ ] Auto-reconnect on WebSocket disconnect

### 2.3 Tables Management Screen
- [ ] List all tables for branch (table number, label, capacity, status)
- [ ] Create table form (table number, label, capacity)
- [ ] Edit table inline
- [ ] Soft delete table (disabled if open tab exists)
- [ ] Manual status override (manager only)

### 2.4 Menu Management Screen
- [ ] Category tabs / filter (All, Drinks, Food, Spirits, Wine, etc.)
- [ ] List menu items with availability toggle
- [ ] Create item form (name, category, price in ₦ — stored as kobo, unit, image upload optional)
- [ ] Edit item (price update shows "applies to new orders only" warning)
- [ ] Toggle item availability (available / unavailable)
- [ ] Soft delete item

### 2.5 Staff Management Screen
- [ ] List all staff (name, role, branch, status)
- [ ] Invite staff form (email + role selection)
- [ ] View staff profile
- [ ] Deactivate / reactivate staff

### 2.6 Tab Detail Screen (Read-Only)
- [ ] Accessible from Dashboard or report drill-down
- [ ] Shows: tab number, table, waiter, customer name, party size, opened at
- [ ] Itemised order list grouped by round with timestamps
- [ ] Bill summary (subtotal, service charge, discount, total)
- [ ] Payment method + reference + paid at
- [ ] Void tab button (manager only) — requires reason input

### 2.7 Reports Screen
- [ ] Date range picker (presets: Today, Yesterday, This Week, This Month, Custom)
- [ ] Sales report table: date, revenue, transactions, avg bill
- [ ] Filter by waiter
- [ ] Top items chart (bar or table)
- [ ] Export to PDF button
- [ ] Waiter breakdown table

### 2.8 Settings Screen
- [ ] Update business profile (name, address, logo upload, currency)
- [ ] Update branch details
- [ ] Change password

---

## PHASE 3 — WAITER MOBILE APP (Ionic + Capacitor)

### 3.1 Auth
- [ ] Screen: Login (email/phone + password; large touch targets ≥ 44px)
- [ ] Biometric login (Face ID / fingerprint) via Capacitor — optional convenience
- [ ] Show branch name on successful login
- [ ] Auto-refresh JWT silently in background

### 3.2 Tables Overview Screen
- [ ] Full-screen colour-coded table grid (Green = Available, Red = Occupied, Yellow = Reserved)
- [ ] Display table number + customer name (if set) on occupied tables
- [ ] Running total badge on occupied tables
- [ ] Offline mode banner when network unavailable
- [ ] Pull-to-refresh

### 3.3 Open Tab Flow
- [ ] Tap Available table → Open Tab modal
- [ ] Fields: Customer Name (optional), Party Size (optional, default 1)
- [ ] Submit → create tab via API (or queue if offline) → navigate to Tab Detail
- [ ] Show generated tab number on success

### 3.4 Tab Detail / Active Order Screen
- [ ] Header: tab number, table, time open (live counter), running total
- [ ] Order list grouped by round with round timestamp
- [ ] Each item: name, qty, unit price, subtotal
- [ ] FAB or button: Add Items
- [ ] Button: Start New Round (explicit)
- [ ] Button: Generate Bill (locks tab from further item edits)
- [ ] Swipe-to-delete order item (only while tab open; requires confirmation)
- [ ] Edit quantity inline (only while tab open)

### 3.5 Menu Browse & Item Selection Screen
- [ ] Category filter tabs at top
- [ ] Search bar (name search)
- [ ] Item cards: name, price, unit, availability indicator
- [ ] Tap item → add to order with qty = 1; show qty adjuster (+/-)
- [ ] Cart summary bar at bottom: N items, ₦X total
- [ ] Confirm & Add to Tab button
- [ ] Unavailable items shown as greyed out, non-tappable

### 3.6 Running Bill View
- [ ] Itemised by round (Round 1 — timestamp, items; Round 2 — timestamp, items)
- [ ] Subtotal per round
- [ ] Grand total prominently displayed
- [ ] Service charge row (if applicable)
- [ ] Designed to be legible when shown to customer on phone screen

### 3.7 Payment Recording Screen
- [ ] Payment method selector: Cash · Bank Transfer · Card · POS Terminal
- [ ] Reference number field (required for Transfer and POS)
- [ ] Total amount display (large, prominent)
- [ ] Confirm Payment button → close tab → navigate to Receipt screen

### 3.8 Receipt Screen
- [ ] Formatted receipt matching spec (business name, branch, receipt no, tab no, table, waiter, date/time, itemised list, total, payment method)
- [ ] Download as PDF button
- [ ] Share via WhatsApp / messaging button
- [ ] Print via Bluetooth thermal printer button (if printer paired)
- [ ] "Done" button → return to Tables Overview

### 3.9 Tab History Screen
- [ ] Own tabs only (waiter cannot see other waiters' history)
- [ ] Filter: Today, This Week, This Month
- [ ] List: tab number, table, opened at, total, status
- [ ] Tap tab → read-only Tab Detail view

### 3.10 Transfer Tab Flow
- [ ] From Tab Detail: "Transfer Tab" option
- [ ] Show list of Available tables
- [ ] Confirm transfer → API call → original table becomes Available, tab moves to new table
- [ ] Audit log entry created

---

## PHASE 4 — OFFLINE SYNC ENGINE

### 4.1 Local Storage (SQLite via Capacitor)
- [ ] Create local schema mirroring key V1 entities: `pending_orders`, `pending_tabs`, `sync_queue`
- [ ] `sync_queue` table: id, entity_type, action (create/update), payload JSON, created_at, attempts, status
- [ ] On any mutating action (open tab, add order, close tab): write to SQLite AND add to sync_queue
- [ ] Read-path: show local SQLite data when offline (tabs + orders)

### 4.2 Network Detection & Sync Service
- [ ] Network status service using Capacitor Network plugin
- [ ] On network change → offline: show "Offline Mode" banner, continue using local data
- [ ] On network return → online: hide banner, trigger sync
- [ ] Background sync: process sync_queue sequentially (FIFO)
- [ ] On each sync item: POST to API; on 2xx → mark as synced; on 4xx → mark as failed + log error; on 5xx / timeout → retry (max 3 attempts, exponential backoff)
- [ ] Conflict resolution: server authority wins; timestamp used for ordering

### 4.3 Offline UX
- [ ] "Saved locally — will sync when connected" toast on every offline mutation
- [ ] Sync status indicator: number of pending items in queue
- [ ] On sync complete: toast "All orders synced"
- [ ] On sync error: toast with retry option

---

## PHASE 5 — SECURITY & QUALITY ASSURANCE

### 5.1 Security
- [ ] All API endpoints require JWT (except `/auth/register`, `/auth/login`, `/auth/verify-email`, `/auth/refresh`)
- [ ] `BranchScopeGuard` applied to all branch-data endpoints — no cross-branch data leakage
- [ ] Validate: waiter can only access their assigned branch
- [ ] Validate: manager can only access their business's branches
- [ ] Owner can only access their own business
- [ ] Rate limiting active on all endpoints
- [ ] SQL injection protection via TypeORM parameterised queries (no raw string concatenation)
- [ ] Input sanitisation via `class-validator` on all DTOs
- [ ] Helmet middleware for HTTP security headers
- [ ] HTTPS enforced in staging + production
- [ ] Secrets (DB passwords, JWT secret, S3 keys) never in source code — environment only
- [ ] Security test: cross-business data leakage (waiter from Business A cannot see Business B data)

### 5.2 Testing
- [ ] Unit tests: `AuthService`, `TabService` (state machine), `BillingService` (calculation accuracy), `OrderService` (price snapshot logic)
- [ ] Integration tests: database round-trips for all modules
- [ ] E2E test: full waiter flow (register → login → open tab → add 3 items → generate bill → pay → verify receipt totals)
- [ ] E2E test: manager dashboard real-time update on tab close
- [ ] Load test: 100 concurrent waiter sessions on single branch (target: < 500ms p95)
- [ ] Billing calculation test: 50 automated scenarios with known expected totals
- [ ] Security test: attempt cross-branch data access with valid JWT from different branch

### 5.3 Performance
- [ ] Dashboard API response < 500ms on standard connection
- [ ] Receipt PDF generation < 3 seconds
- [ ] Item addition UX: < 10 seconds from tap to confirmation
- [ ] Dashboard UI load < 2 seconds
- [ ] Mobile app startup < 3 seconds on Android 8+

---

## PHASE 6 — BETA & LAUNCH

### 6.1 Beta Preparation
- [ ] Seed 1 demo business with realistic data (tables, menu, 2 waiters, 30 days of historic orders)
- [ ] Write onboarding guide (business owner setup — under 15 minutes)
- [ ] Write waiter quick-start card (1 page, printed)
- [ ] Record 2-minute demo video (business owner POV)
- [ ] Record 2-minute demo video (waiter POV)
- [ ] Set up in-app feedback button

### 6.2 Beta Rollout
- [ ] Onboard Beta Business 1 (Abuja bar/lounge)
- [ ] Onboard Beta Business 2
- [ ] Onboard Beta Business 3
- [ ] Monitor: error rates, sync failures, API latency (use logging/Sentry)
- [ ] Weekly feedback call with beta businesses
- [ ] Fix all P0/P1 bugs before public launch

### 6.3 Launch Acceptance Checklist
- [ ] Zero billing calculation errors in automated test suite
- [ ] Zero cross-business data leakage in security tests
- [ ] All Critical acceptance criteria from PRD checked off (see PRD §6)
- [ ] App works on Android 8+ and iOS 14+
- [ ] Offline sync tested on real device with airplane mode simulation
- [ ] Receipt PDF renders correctly on 5 different screen sizes
- [ ] 30-day trial subscription logic active

---

## PHASE 7 — V2 FEATURES (Design-Ready, Build After V1 Launch)

> Architecture is already scaffolded for these. Do not implement during V1 sprint.

### 7.1 Voice Order Capture
- [ ] Integrate Google Cloud Speech-to-Text or Whisper API
- [ ] Waiter records voice note in mobile app
- [ ] API transcribes audio → extract item names + quantities
- [ ] Present parsed items to waiter for confirmation/edit
- [ ] Confirmed items added to tab as normal orders

### 7.2 Cashier Module
- [ ] New role: `cashier` — can view bills awaiting payment, confirm payment, print receipt
- [ ] Cashier screen: queue of tabs with status 'billed'
- [ ] Cashier confirms payment method + reference → marks bill as paid
- [ ] Shift module: shift open (record starting cash) → shift close (record ending cash, calculate variance)

### 7.3 Inventory Module
- [ ] `inventory_items` table: branch_id, menu_item_id, quantity_in_stock, reorder_level
- [ ] `stock_movements` table: purchase | sale | adjustment | wastage + quantity + reference_id
- [ ] Auto-deduct stock on tab close (link orders → stock_movements)
- [ ] Low stock alerts (push notification to manager)
- [ ] Stock vs sales variance report

### 7.4 Split Bill
- [ ] `bill_splits` table: bill_id, amount_kobo, payment_method, paid_at
- [ ] UI: divide bill into N portions; assign payment method per portion
- [ ] Tab closes only when all split portions are paid

### 7.5 Table Transfer (if not completed in V1)
- [ ] Move open tab from Table A to Table B (target must be Available)
- [ ] Full order history preserved
- [ ] Audit log entry

### 7.6 Enhanced Manager Dashboard
- [ ] Push notifications: tab open > 3 hours, bill voided, stock below reorder
- [ ] Waiter performance with voids and average tab value
- [ ] Thermal Bluetooth printer pairing in app settings

---

## NON-NEGOTIABLES — VERIFY AT EVERY STAGE

- [ ] No hard deletes anywhere in the codebase (use `deleted_at`)
- [ ] No float types for money anywhere (PostgreSQL `INTEGER` kobo only)
- [ ] Every query scoped to `branch_id` (no cross-branch leakage)
- [ ] Price snapshotted to `unit_price_kobo` at order creation — never re-fetched
- [ ] Every entity has `created_at`, `updated_at`, `created_by`
- [ ] All timestamps stored as UTC; frontend converts for display
- [ ] Bills and receipts are immutable once paid (read-only + append-only annotations)
- [ ] Audit trail exists for: voids, order deletes, bill generation, payments
- [ ] All tokens expire (access: 15m, refresh: 7d)
- [ ] Backend validates all input — frontend validation is UX-only, not security

---

*ServeIQ Master Checklist — v1.0 | Generated June 2026*
*Source files: PROJECT_BIBLE.md · PRD_V1.md · API_ARCHITECTURE.md · DATABASE_ARCHITECTURE.md · FULL_LIFECYCLE_BLUEPRINT.md · VERSION_ROADMAP.md · STAKEHOLDER_ANALYSIS.md*
