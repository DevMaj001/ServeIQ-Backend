# ServeIQ — Project Bible
## Hospitality Operations Platform

> **Version:** 1.0.0  
> **Status:** Pre-Development (Architecture Phase)  
> **Last Updated:** June 2026  
> **Document Type:** Master Reference — Source of Truth for All Agents, Developers, and Stakeholders

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [Problem Statement](#2-problem-statement)
3. [Target Market](#3-target-market)
4. [Product Philosophy](#4-product-philosophy)
5. [Module Map](#5-module-map)
6. [Version Roadmap](#6-version-roadmap)
7. [User Roles & Permissions](#7-user-roles--permissions)
8. [System Architecture](#8-system-architecture)
9. [Database Design](#9-database-design)
10. [API Architecture](#10-api-architecture)
11. [Frontend Architecture](#11-frontend-architecture)
12. [AI Features Specification](#12-ai-features-specification)
13. [Offline-First Strategy](#13-offline-first-strategy)
14. [Payment & Reconciliation Design](#14-payment--reconciliation-design)
15. [Inventory Management Design](#15-inventory-management-design)
16. [Security & Audit Log Specification](#16-security--audit-log-specification)
17. [Multi-Branch Architecture](#17-multi-branch-architecture)
18. [Agent Instructions](#18-agent-instructions)
19. [Coding Standards](#19-coding-standards)
20. [Environment Configuration](#20-environment-configuration)

---

## 1. Product Vision

### What Is ServeIQ?

ServeIQ is a **Hospitality Operations Platform** that begins with intelligent waiter-assistance and table management, and evolves into a complete operating system for hospitality businesses.

The platform eliminates billing errors, reduces revenue leakage, provides real-time management visibility, and empowers waiters to work faster and with confidence.

### One-Line Vision

> *"Every drink recorded. Every naira accounted for. Every waiter protected."*

### 5-Year Vision

ServeIQ becomes the leading hospitality operations platform in West Africa, used by beer parlors, bars, lounges, hotels, restaurants, and clubs — managing everything from a single table order to multi-branch franchise analytics.

### What ServeIQ Is NOT

- Not just a POS system
- Not just a waiter app
- Not just a receipt printer
- Not a payment processor in V1

ServeIQ is an **operations intelligence layer** sitting between the floor staff and management.

---

## 2. Problem Statement

### Primary Problems

#### 2.1 Billing Errors
Waiters take orders manually on paper across multiple rounds. At closing, they calculate totals by hand. Missing items, wrong multiplication, and incorrect totals result in financial losses that are often deducted from waiter salaries.

**Impact:** Waiter distress, financial loss, employee turnover.

#### 2.2 Revenue Leakage
Items consumed are not always fully recorded — whether accidentally or intentionally. A customer orders 10 bottles; 8 are recorded. Management cannot detect discrepancies without a digital trail.

**Impact:** Direct revenue loss, undetected theft.

#### 2.3 Zero Management Visibility
Managers have no real-time view of table activity, sales per waiter, or total revenue until closing. Decisions are made blind.

**Impact:** Inability to manage shift performance, detect anomalies, or respond to problems early.

#### 2.4 Customer Disputes
Without a digital record, "he said / she said" billing disputes damage customer relationships and business reputation.

**Impact:** Customer churn, reputational damage.

#### 2.5 Waiter Stress & Accountability Gaps
Waiters carry mental burden of tracking every order across every table simultaneously. Errors are punished financially. There is no fair, transparent accountability system.

**Impact:** Staff morale, retention, and productivity.

#### 2.6 Inventory Blindness
Businesses cannot easily reconcile what was sold vs. what was stocked. Theft and wastage go undetected.

**Impact:** Unknown shrinkage, uncontrolled procurement costs.

### Secondary Problems (Discovered)

- No waiter performance benchmarking
- No shift reconciliation tools for cashiers
- No table transfer capability
- No split-bill support
- Offline unreliability in low-connectivity environments
- No customer loyalty or history tracking
- No multi-branch consolidated reporting

---

## 3. Target Market

### Primary Market (V1)

| Segment | Description |
|---|---|
| Beer Parlors | High-volume, low-complexity, common in Nigeria |
| Bars & Lounges | Multiple tabs, long sessions, high revenue risk |
| Night Clubs | Complex tabs, group orders, high-value transactions |
| Hotels (Bar/Restaurant) | Need management visibility and waiter accountability |

### Geographic Focus (V1)

Nigeria — with architecture designed for multi-country expansion.

### Business Size (V1)

Small to medium hospitality businesses:
- 1 to 20 tables
- 1 to 15 waiters
- Single branch

### Expansion Markets (V3+)

- Multi-branch franchises
- Restaurant chains
- Catering companies
- Event management companies

---

## 4. Product Philosophy

### Build With the End in View

Every architectural decision must account for where ServeIQ will be at Version 10, not just Version 1. This means:

- Database entities designed for scale from day one
- No hardcoded business logic that breaks at multi-tenancy
- Role-based architecture supports future roles not yet defined
- Every module is loosely coupled and independently deployable

### Solve Real Pain First

Version 1 does not need voice AI or complex analytics. It needs to reliably:

1. Open a tab
2. Record orders
3. Calculate the bill
4. Generate a receipt
5. Show the manager what happened

Everything else is enhancement.

### Protect the Waiter

The system exists to protect waiters as much as it serves business owners. Accuracy, transparency, and a clear audit trail means the waiter is never unfairly blamed.

### Nigerian Context First

- Support offline-first for unstable connectivity
- Support Naira (₦) currency formatting
- Support common Nigerian bar/lounge menu structures
- Support thermal receipt printing (popular in local businesses)
- Payment reconciliation matches local patterns (cash, transfer, POS terminal)

---

## 5. Module Map

This is the complete map of every module the platform may contain. Modules marked **MVP** are built in Version 1. All others are designed into the architecture but not built until their version.

```
ServeIQ Platform
│
├── [MVP] Core Platform
│     ├── Authentication (JWT)
│     ├── Multi-Tenancy (Business → Branch)
│     ├── User Management
│     └── Role & Permission Engine
│
├── [MVP] Waiter Operations Module
│     ├── Table Management
│     ├── Tab Management (Open / Close / Transfer)
│     ├── Order Capture (Tap / Search)
│     ├── Order Rounds (multiple rounds per tab)
│     ├── Automatic Bill Calculation
│     ├── Receipt Generation
│     └── Tab History
│
├── [MVP] Admin Dashboard
│     ├── Business Registration
│     ├── Branch Management
│     ├── Table Setup
│     ├── Menu & Pricing Management
│     ├── Waiter Account Management
│     └── Live Sales View
│
├── [V2] Cashier Module
│     ├── Payment Verification
│     ├── Payment Method Recording (Cash/Transfer/POS)
│     ├── Reference Number Entry
│     ├── Receipt Reprint
│     └── Shift Closing Report
│
├── [V2] Manager Module
│     ├── Real-Time Table Monitor
│     ├── Waiter Performance Dashboard
│     ├── Shift Sales Summary
│     ├── Daily Revenue Reports
│     └── Dispute Resolution View
│
├── [V2] Inventory Module
│     ├── Product Stock Management
│     ├── Stock Entry (Purchase)
│     ├── Stock Deduction (on sale)
│     ├── Variance Reports (Sold vs Stocked)
│     ├── Low Stock Alerts
│     └── Supplier Records
│
├── [V3] Finance Module
│     ├── Expense Tracking
│     ├── Profit & Loss Summaries
│     ├── Revenue vs Cost Reports
│     └── Tax Calculation Aids
│
├── [V3] Customer Module
│     ├── Customer Profiles
│     ├── Visit History
│     ├── Spending History
│     └── Loyalty Points Engine
│
├── [V3] Payment Integration Module
│     ├── Paystack Integration
│     ├── Flutterwave Integration
│     ├── Moniepoint Integration
│     └── Automated Payment Verification
│
├── [V4] AI Module
│     ├── Voice Order Capture
│     ├── Speech → Structured Order Parser
│     ├── Sales Forecasting
│     ├── Inventory Prediction
│     ├── Fraud / Anomaly Detection
│     └── Smart Reorder Recommendations
│
└── [V4] Multi-Branch & Franchise Module
      ├── Branch Comparison Dashboard
      ├── Regional Reporting
      ├── Centralized Menu Management
      ├── Cross-Branch Inventory View
      └── Franchise Performance Analytics
```

---

## 6. Version Roadmap

### Version 1 — MVP (Foundation)

**Goal:** Get paying customers. Prove the core value.

**Scope:**
- Business admin registration and setup
- Waiter login and dashboard
- Table creation and management
- Open/close tabs
- Add orders via tap and search
- Automatic bill calculation
- Receipt generation (screen + print)
- Live sales visible to admin
- Waiter sales summary

**Success Criteria:**
- A waiter can take and close an order without touching paper
- A business owner can see today's total sales at any moment
- Receipts are accurate 100% of the time

**Timeline Target:** 8–12 weeks

---

### Version 2 — Operations Depth

**Goal:** Make it essential for daily business operations.

**Scope:**
- Cashier module
- Table transfer
- Split bill
- Shift management
- Payment method recording & reconciliation
- Inventory module (basic stock tracking)
- Manager real-time monitoring dashboard
- Waiter performance reports

**Timeline Target:** 12–20 weeks post-V1 launch

---

### Version 3 — Business Intelligence

**Goal:** Make management love it.

**Scope:**
- Finance module (expenses, P&L)
- Customer profiles and visit history
- Loyalty program
- Advanced analytics (best sellers, revenue trends)
- Payment gateway integration (Paystack / Flutterwave)
- Multi-branch initial support

**Timeline Target:** Post-V2, based on customer feedback

---

### Version 4 — AI & Scale

**Goal:** Become indispensable.

**Scope:**
- Voice order capture (speech → structured order)
- AI anomaly and fraud detection
- Sales and inventory forecasting
- Full multi-branch / franchise module
- API for third-party integrations

**Timeline Target:** Post-V3

---

## 7. User Roles & Permissions

### Role Hierarchy

```
Super Admin (ServeIQ Platform Admin)
└── Business Owner
      └── Branch Manager
            ├── Cashier
            ├── Waiter
            └── Inventory Officer (V2)
```

### Role Definitions

#### Super Admin
Platform-level administrator. Manages all registered businesses. Can see all data. Only internal ServeIQ team.

| Permission | Access |
|---|---|
| Register/suspend businesses | ✅ |
| View all business data | ✅ |
| Platform-wide analytics | ✅ |
| Manage subscription plans | ✅ |

#### Business Owner
Owns one or more businesses registered on ServeIQ. Has full control over their business data.

| Permission | Access |
|---|---|
| Create branches | ✅ |
| Create/manage managers and waiters | ✅ |
| View all branch data | ✅ |
| Configure menu and pricing | ✅ |
| View all financial reports | ✅ |
| Delete orders | ❌ (audit log only) |

#### Branch Manager
Manages daily operations of a single branch.

| Permission | Access |
|---|---|
| Monitor live tables | ✅ |
| View waiter performance | ✅ |
| Open/close shifts | ✅ |
| Handle disputes | ✅ |
| Edit menu (branch level) | ✅ |
| View financial reports | ✅ (branch only) |
| Create waiters | ✅ |

#### Waiter
Core user. Takes orders and manages assigned tables.

| Permission | Access |
|---|---|
| Open tabs | ✅ |
| Add/remove orders | ✅ |
| Close tabs | ✅ |
| Transfer tables | ✅ |
| Generate bill | ✅ |
| View own sales only | ✅ |
| View other waiters' sales | ❌ |
| Modify prices | ❌ |
| Delete closed tabs | ❌ |

#### Cashier (V2)
Handles payment confirmation and receipts.

| Permission | Access |
|---|---|
| View all open bills | ✅ |
| Record payment method | ✅ |
| Mark tab as paid | ✅ |
| Reprint receipts | ✅ |
| View shift totals | ✅ |
| Modify order items | ❌ |

#### Inventory Officer (V2)
Manages stock levels and supplier records.

| Permission | Access |
|---|---|
| Add stock | ✅ |
| View stock levels | ✅ |
| View sales-vs-stock variance | ✅ |
| Manage suppliers | ✅ |
| Modify prices | ❌ |

---

## 8. System Architecture

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                        │
│                                                          │
│  ┌─────────────────┐        ┌────────────────────────┐  │
│  │  Admin Web App  │        │  Waiter Mobile App     │  │
│  │  (Angular)      │        │  (Ionic + Angular)     │  │
│  └────────┬────────┘        └──────────┬─────────────┘  │
└───────────┼───────────────────────────┼─────────────────┘
            │                           │
            │        HTTPS / WSS        │
            │                           │
┌───────────▼───────────────────────────▼─────────────────┐
│                      API LAYER                           │
│                                                          │
│              NestJS REST API + WebSocket                 │
│              JWT Authentication                          │
│              Role-Based Guards                           │
│              Rate Limiting                               │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│                    SERVICE LAYER                         │
│                                                          │
│  OrderService  TabService  BillingService  ReportService │
│  AuthService   UserService  MenuService   InventoryService│
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│                   DATABASE LAYER                         │
│                                                          │
│              PostgreSQL (Primary)                        │
│              Redis (Cache + Sessions)                    │
│              Local Storage (Offline Sync)                │
└─────────────────────────────────────────────────────────┘
```

### Technology Stack

#### Backend
| Component | Technology | Reason |
|---|---|---|
| Runtime | Node.js 18+ | Performance, ecosystem |
| Framework | NestJS | Structured, scalable, TypeScript-first |
| Language | TypeScript (strict) | Type safety at scale |
| Database | PostgreSQL | Relational data, complex joins, reporting |
| ORM | TypeORM | Tight NestJS integration |
| Auth | JWT + Refresh Tokens | Stateless, scalable |
| Real-time | Socket.IO | Live order updates to manager dashboard |
| Cache | Redis | Sessions, rate limiting, temporary state |
| Queue | Bull (Redis-based) | Background jobs (reports, sync) |
| File Storage | AWS S3 / Cloudinary | Receipts, product images |
| PDF | PDFKit | Receipt and report generation |

#### Frontend — Admin Web
| Component | Technology |
|---|---|
| Framework | Angular 17+ (Standalone Components) |
| State | NgRx or Angular Signals |
| UI | Custom + Angular Material |
| Charts | Apache ECharts / Chart.js |
| HTTP | Angular HttpClient |

#### Frontend — Waiter App
| Component | Technology |
|---|---|
| Framework | Ionic 7 + Angular |
| Offline | Capacitor + SQLite |
| Sync | Background sync on reconnect |
| Camera | Capacitor Camera (for QR scan, V2) |

---

## 9. Database Design

### Design Principles

- All tables include `created_at`, `updated_at`, `deleted_at` (soft delete)
- All IDs are UUIDs (not auto-increment integers)
- Multi-tenancy enforced at the `business_id` and `branch_id` level
- No hardcoded business logic in database (prices are data, not constants)
- Audit trails for every financial mutation

### Entity Relationship Overview

```
businesses
  └── branches
        ├── tables
        │     └── tabs
        │           └── tab_orders
        │                 └── order_items
        ├── users (staff)
        ├── menu_categories
        │     └── menu_items
        └── shifts
              └── payments
```

### Core Entities

#### businesses
```sql
id              UUID PK
name            VARCHAR(255) NOT NULL
slug            VARCHAR(100) UNIQUE NOT NULL
owner_id        UUID FK → users.id
subscription_plan ENUM('free', 'starter', 'pro', 'enterprise')
subscription_status ENUM('active', 'inactive', 'suspended')
address         TEXT
phone           VARCHAR(20)
logo_url        TEXT
settings        JSONB
created_at      TIMESTAMP
updated_at      TIMESTAMP
deleted_at      TIMESTAMP
```

#### branches
```sql
id              UUID PK
business_id     UUID FK → businesses.id
name            VARCHAR(255) NOT NULL
address         TEXT
phone           VARCHAR(20)
is_active       BOOLEAN DEFAULT TRUE
settings        JSONB
created_at      TIMESTAMP
updated_at      TIMESTAMP
deleted_at      TIMESTAMP
```

#### users
```sql
id              UUID PK
business_id     UUID FK → businesses.id
branch_id       UUID FK → branches.id (nullable for owners)
first_name      VARCHAR(100) NOT NULL
last_name       VARCHAR(100) NOT NULL
email           VARCHAR(255) UNIQUE
phone           VARCHAR(20)
password_hash   TEXT
role            ENUM('super_admin','business_owner','branch_manager','waiter','cashier','inventory_officer')
is_active       BOOLEAN DEFAULT TRUE
last_login_at   TIMESTAMP
created_at      TIMESTAMP
updated_at      TIMESTAMP
deleted_at      TIMESTAMP
```

#### tables
```sql
id              UUID PK
branch_id       UUID FK → branches.id
name            VARCHAR(50) NOT NULL  -- e.g., "Table 1", "VIP 3"
capacity        INT
status          ENUM('available','occupied','reserved','maintenance')
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

#### menu_categories
```sql
id              UUID PK
branch_id       UUID FK → branches.id
name            VARCHAR(100) NOT NULL  -- e.g., "Drinks", "Food", "Cocktails"
display_order   INT
is_active       BOOLEAN DEFAULT TRUE
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

#### menu_items
```sql
id              UUID PK
branch_id       UUID FK → branches.id
category_id     UUID FK → menu_categories.id
name            VARCHAR(255) NOT NULL
description     TEXT
price           DECIMAL(12,2) NOT NULL
unit            VARCHAR(50)  -- "bottle", "glass", "plate"
sku             VARCHAR(100)
barcode         VARCHAR(100)
image_url       TEXT
is_active       BOOLEAN DEFAULT TRUE
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

#### tabs
```sql
id              UUID PK
branch_id       UUID FK → branches.id
table_id        UUID FK → tables.id
waiter_id       UUID FK → users.id
cashier_id      UUID FK → users.id (nullable, set on payment)
tab_number      VARCHAR(30) UNIQUE NOT NULL  -- TAB-2026-00015
customer_name   VARCHAR(255)
customer_count  INT
status          ENUM('open','pending_payment','paid','voided')
subtotal        DECIMAL(12,2) DEFAULT 0
discount        DECIMAL(12,2) DEFAULT 0
total           DECIMAL(12,2) DEFAULT 0
notes           TEXT
opened_at       TIMESTAMP NOT NULL
closed_at       TIMESTAMP
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

#### tab_rounds
```sql
id              UUID PK
tab_id          UUID FK → tabs.id
round_number    INT NOT NULL  -- 1st order, 2nd order, etc.
waiter_id       UUID FK → users.id
notes           TEXT
created_at      TIMESTAMP
```

#### order_items
```sql
id              UUID PK
tab_id          UUID FK → tabs.id
round_id        UUID FK → tab_rounds.id
menu_item_id    UUID FK → menu_items.id
item_name       VARCHAR(255) NOT NULL  -- snapshot at time of order
unit_price      DECIMAL(12,2) NOT NULL  -- snapshot at time of order
quantity        INT NOT NULL
subtotal        DECIMAL(12,2) NOT NULL
notes           TEXT
status          ENUM('pending','served','voided')
voided_reason   TEXT
voided_by       UUID FK → users.id
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

> **Note:** `item_name` and `unit_price` are snapshotted at order time. This ensures historical bills are never affected by menu price changes.

#### payments
```sql
id              UUID PK
tab_id          UUID FK → tabs.id
branch_id       UUID FK → branches.id
cashier_id      UUID FK → users.id
amount          DECIMAL(12,2) NOT NULL
method          ENUM('cash','bank_transfer','pos','card','split')
reference       VARCHAR(255)  -- POS/transfer reference number
verified        BOOLEAN DEFAULT FALSE
verified_at     TIMESTAMP
notes           TEXT
created_at      TIMESTAMP
```

#### audit_logs
```sql
id              UUID PK
business_id     UUID FK → businesses.id
branch_id       UUID FK → branches.id
user_id         UUID FK → users.id
action          VARCHAR(100) NOT NULL  -- e.g., 'TAB_OPENED', 'ITEM_VOIDED'
entity_type     VARCHAR(50)
entity_id       UUID
payload         JSONB  -- full before/after state
ip_address      VARCHAR(45)
created_at      TIMESTAMP
```

---

## 10. API Architecture

### Base URL Structure

```
https://api.serveiq.com/v1/
```

### Authentication

All endpoints (except auth) require:
```
Authorization: Bearer <JWT_ACCESS_TOKEN>
```

Tokens expire in 15 minutes. Refresh tokens valid for 7 days.

### Key Endpoint Groups

```
POST   /auth/register-business
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout

GET    /businesses/:id
PATCH  /businesses/:id
GET    /businesses/:id/branches

GET    /branches/:id/tables
POST   /branches/:id/tables
PATCH  /branches/tables/:tableId

GET    /branches/:id/menu
POST   /branches/:id/menu/items
PATCH  /branches/:id/menu/items/:itemId

GET    /branches/:id/tabs
POST   /branches/:id/tabs           -- Open new tab
GET    /tabs/:id
PATCH  /tabs/:id/close
PATCH  /tabs/:id/transfer            -- Transfer to new table
POST   /tabs/:id/rounds              -- New order round
POST   /tabs/:id/rounds/:roundId/items
DELETE /tabs/:id/items/:itemId       -- Void item (audit logged)

GET    /tabs/:id/bill                -- Generate bill summary
POST   /tabs/:id/payment             -- Record payment
GET    /tabs/:id/receipt             -- Generate receipt PDF

GET    /branches/:id/reports/sales-today
GET    /branches/:id/reports/waiter-performance
GET    /branches/:id/reports/shift-summary
```

### WebSocket Events

```
// Server → Client
tab:updated        { tabId, data }
table:status       { tableId, status }
new:order          { tabId, roundId }
payment:received   { tabId }

// Client → Server
waiter:subscribe   { branchId }
manager:subscribe  { branchId }
```

---

## 11. Frontend Architecture

### Admin Web App (Angular)

**Module Structure:**
```
src/
├── app/
│   ├── core/              -- Auth, guards, interceptors, services
│   ├── shared/            -- Reusable components, pipes, directives
│   ├── features/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── tables/
│   │   ├── menu/
│   │   ├── waiters/
│   │   ├── reports/
│   │   └── settings/
│   └── app.routes.ts
```

### Waiter Mobile App (Ionic + Angular)

**Module Structure:**
```
src/
├── app/
│   ├── core/
│   │   ├── auth/
│   │   ├── offline/      -- SQLite sync logic
│   │   └── services/
│   ├── shared/
│   └── features/
│       ├── tables/
│       ├── tabs/
│       ├── orders/
│       └── bill/
```

### State Management

- Use Angular Signals for local component state (V1)
- Use NgRx for complex cross-component state (V2+)
- Offline state managed by Capacitor SQLite with sync queue

---

## 12. AI Features Specification

> **Note:** AI features are Version 4. Document here for architecture awareness.

### Voice Order Capture

**Flow:**
```
Waiter taps microphone
→ Audio recorded (max 30 seconds)
→ Sent to Speech-to-Text API (Google / Whisper)
→ Transcript returned
→ Transcript sent to LLM with menu context
→ LLM extracts structured order
→ UI shows extracted items for confirmation
→ Waiter confirms or edits
→ Order saved
```

**LLM Prompt Pattern:**
```
You are an order extraction assistant for a hospitality system.
Given the following voice transcript and available menu items, 
extract a structured order.

Transcript: "{transcript}"

Available menu items: {menu_items_json}

Return ONLY valid JSON with format:
{
  "items": [
    { "menu_item_id": "...", "name": "...", "quantity": N }
  ],
  "confidence": 0.0-1.0,
  "raw_transcript": "..."
}
```

### Fraud / Anomaly Detection (V4)

Flags for human review:
- Tab closed with unusually low total vs table occupancy time
- Item voided immediately after being added (pattern detection)
- Waiter sales significantly below branch average
- High void rate for a specific waiter

---

## 13. Offline-First Strategy

### Problem

Many Nigerian bars and lounges experience unstable internet. Orders must never be lost due to connectivity issues.

### Solution Architecture

**Waiter App — Offline Capability:**

1. On login, app downloads:
   - Branch menu (all items + prices)
   - Table configuration
   - Waiter's open tabs (if any)

2. All order actions written to local SQLite first

3. Changes queued in `sync_queue` table:
```sql
id           UUID PK
action       VARCHAR(50)   -- 'CREATE_TAB', 'ADD_ITEM', etc.
payload      TEXT (JSON)
synced       BOOLEAN DEFAULT FALSE
created_at   TIMESTAMP
retry_count  INT DEFAULT 0
```

4. Background sync service checks connectivity every 10 seconds

5. On reconnect, queue processed in order. Conflicts resolved server-side (last-write-wins with audit log)

6. UI shows sync status indicator (green dot = synced, yellow = pending, red = no connection)

### What Works Offline

- ✅ Open new tab
- ✅ Add items to tab
- ✅ View bill
- ✅ Generate receipt (cached)
- ✅ Transfer table

### What Requires Connection

- ❌ Manager dashboard updates
- ❌ Payment recording
- ❌ Reports

---

## 14. Payment & Reconciliation Design

### V1 Payment Flow

ServeIQ does NOT process payments in V1. It records how payment was made.

```
Waiter generates bill
→ Customer pays (cash / transfer / POS terminal)
→ Waiter or Cashier selects payment method
→ If transfer/POS: enters reference number
→ System marks tab as paid
→ Tab closed
→ Sales updated
```

### Payment Methods Supported (V1)

| Method | Reference Required | Notes |
|---|---|---|
| Cash | No | Amount tendered optional |
| Bank Transfer | Yes (UTR/Ref) | 10-digit reference |
| POS Terminal | Yes (POS Ref) | Merchant's own POS |
| Card | No (V1) | Same as POS recording |

### Reconciliation Report

At shift end, cashier/manager sees:

```
Shift Closing Report — June 8, 2026
Branch: Main Branch

Total Tabs Closed:     24
Total Sales:      ₦380,000

Breakdown:
  Cash:            ₦180,000
  Bank Transfer:   ₦120,000
  POS:              ₦80,000
  
Expected Cash:    ₦180,000
Reported Cash:    ₦178,000
Variance:          -₦2,000  ⚠️
```

### V3 Payment Integration

Paystack and Flutterwave APIs will be integrated to:
- Generate payment links
- Auto-verify transfers by amount + reference
- Webhook listeners to auto-close tabs on payment confirmation

---

## 15. Inventory Management Design

> Version 2 feature. Architecture planned here.

### Core Concept

Every `order_item` created reduces stock. Every stock entry increases it.

```
stock_entries
  id, branch_id, menu_item_id, quantity, type (purchase/adjustment), 
  reference, supplier_id, unit_cost, notes, created_by, created_at

stock_levels (materialized / maintained)
  menu_item_id, branch_id, current_quantity, last_updated
```

### Variance Reporting

```
For each menu_item:
  Opening Stock
+ Purchases
- Sales (from order_items)
= Expected Closing Stock

vs.

Actual Physical Count (manual entry)
= Variance
```

Variance flagged if > configurable threshold (e.g., 5%).

---

## 16. Security & Audit Log Specification

### Authentication Security

- JWT access tokens: 15-minute expiry
- Refresh tokens: 7-day expiry, stored in HttpOnly cookie
- Password hashing: bcrypt (rounds: 12)
- Rate limiting: 5 failed logins → 15-minute lockout
- All auth events logged

### Data Isolation

- Every database query filtered by `business_id` or `branch_id`
- No endpoint returns cross-business data
- Super Admin routes protected by separate middleware

### Audit Log Events

Every one of these events is written to `audit_logs`:

```
AUTH_LOGIN, AUTH_LOGOUT, AUTH_FAILED
TAB_OPENED, TAB_CLOSED, TAB_VOIDED, TAB_TRANSFERRED
ORDER_ITEM_ADDED, ORDER_ITEM_VOIDED
PAYMENT_RECORDED, PAYMENT_VERIFIED
MENU_ITEM_CREATED, MENU_ITEM_PRICE_CHANGED
USER_CREATED, USER_ROLE_CHANGED, USER_DEACTIVATED
STOCK_ADDED, STOCK_ADJUSTED
REPORT_GENERATED
```

Audit logs are **immutable**. No delete endpoint exists.

---

## 17. Multi-Branch Architecture

### V1 Foundation

Even in V1, every entity has `business_id` and `branch_id`. This means:
- A business can have multiple branches from day one (data model)
- V1 UI only shows one branch at a time
- V4 adds cross-branch views and analytics

### Branch Isolation Rules

- Waiters belong to a single branch
- Managers can be assigned to one or more branches
- Business Owners see all branches
- Menu items are branch-level (can be different prices per branch)
- Reports are always filterable by branch

---

## 18. Agent Instructions

> **For: Cursor, Cline, Claude Code, Windsurf, or any AI coding agent**

### What You Are Building

You are building ServeIQ — a hospitality operations platform. Read this entire document before writing any code.

### Tech Stack

- **Backend:** NestJS + TypeScript + PostgreSQL + TypeORM + Socket.IO
- **Admin Frontend:** Angular 17+ (Standalone Components)
- **Waiter App:** Ionic 7 + Angular
- **Auth:** JWT (access + refresh tokens)
- **Caching:** Redis
- **Receipts:** PDFKit

### Non-Negotiables

1. **Never delete files.** Refactor, move, or replace — never delete.
2. **Never install a package without asking first.**
3. **All entities must have UUID primary keys.**
4. **All financial amounts stored as DECIMAL(12,2), never floats.**
5. **Prices must be snapshotted in order_items at time of order.**
6. **All database queries must include business_id or branch_id filter.**
7. **Every financial mutation must create an audit_log entry.**
8. **Soft-delete only (deleted_at). No hard deletes on financial records.**
9. **Never expose password hashes in API responses.**
10. **All TypeScript must pass strict mode checks.**

### Folder Structure (Backend)

```
src/
├── auth/
├── businesses/
├── branches/
├── users/
├── tables/
├── menu/
├── tabs/
├── orders/
├── payments/
├── reports/
├── audit/
├── common/
│   ├── decorators/
│   ├── guards/
│   ├── interceptors/
│   ├── pipes/
│   └── filters/
└── database/
    └── migrations/
```

### Plan Before You Build

Before writing any module:
1. State what you are building
2. List all files you will create or modify
3. Confirm the plan
4. Then execute

---

## 19. Coding Standards

### TypeScript

- Strict mode enabled
- No `any` types
- Interfaces for all DTOs and entities
- Enums for all status/type fields

### NestJS Patterns

- One module per feature domain
- Controllers handle HTTP only (no business logic)
- Services contain all business logic
- DTOs validated with class-validator
- All endpoints decorated with Swagger (`@ApiTags`, `@ApiOperation`)

### Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Files | kebab-case | `tab.service.ts` |
| Classes | PascalCase | `TabService` |
| Variables | camelCase | `tabNumber` |
| Database tables | snake_case | `order_items` |
| Env vars | SCREAMING_SNAKE | `DATABASE_URL` |
| API endpoints | kebab-case | `/tab-orders` |

### Error Handling

- Use NestJS built-in exceptions (`NotFoundException`, `ForbiddenException`, etc.)
- All errors include a `code` field for frontend handling
- Never expose stack traces in production

---

## 20. Environment Configuration

### Required Environment Variables

```env
# App
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/serveiq

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_ACCESS_SECRET=your_access_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# File Storage (V2)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Payment (V3)
PAYSTACK_SECRET_KEY=
FLUTTERWAVE_SECRET_KEY=

# AI (V4)
OPENAI_API_KEY=
GOOGLE_SPEECH_API_KEY=
```

---

## Appendix A — Glossary

| Term | Definition |
|---|---|
| Tab | A running bill for a table. Stays open until customer pays. |
| Round | One instance of ordering within a tab. Customers may order multiple rounds. |
| Order Item | A single line item within a round (e.g., 3x Heineken) |
| Tab Number | Human-readable identifier, e.g., TAB-2026-00015 |
| Void | Cancelling an item. Audit-logged, never deleted. |
| Reconciliation | Matching recorded payment methods to total expected sales |
| Variance | Difference between expected stock and actual stock |
| Snapshot | Storing item name and price at order time to prevent historical corruption |

---

## Appendix B — Known Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Poor connectivity | High (Nigeria) | Offline-first architecture |
| Waiter resistance to new tech | Medium | Simple, fast UI — under 3 taps per order |
| Price manipulation | Medium | Prices locked at menu level; changes audit-logged |
| Revenue leakage via item voiding | Medium | Void requires reason; all voids reported to manager |
| Data loss on device | Low | All data synced to server; local is cache only |

---

*End of Document — ServeIQ Project Bible v1.0.0*
