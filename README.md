# ServeIQ

> **ServeIQ is a cloud restaurant management and point-of-sale (POS) platform with per-guest split payments, offline-first ordering, table-QR menus, and real-time kitchen and guest tracking.**

## What is this?

ServeIQ is a platform that helps restaurants, bars, and hotels manage their business — from taking customer orders at a table to processing payments and tracking inventory. Think of it as a complete digital toolkit for running a hospitality business.

This project contains the **backend** (the "brain" — an API that powers everything) and documentation for the whole system.

> Current hosted product: [`DennisMajestie/ServeIQ-Backend`](https://github.com/DennisMajestie/ServeIQ-Backend) — served on Render at `https://serveiq-backend.onrender.com`.

---

## What makes ServeIQ different

- **Per-guest split payments with item-level allocation** — split one bill across guests by picked items, fixed amount, percentage, or remaining balance; settle guest-by-guest at the table; the tab closes only when the last share is paid.
- **Reservations** — a public "Book a Table" flow (`GET /api/v1/reservations/availability` + `POST /api/v1/reservations/book`), confirmation-code management, staff walk-ins, seating that opens a tab, and per-branch reservation settings.
- **Delivery dispatch & rider payouts** — takeaway delivery with a rider pool (`/api/v1/riders`), a dispatch lifecycle (`/api/v1/deliveries`), dispatch fees on bills, and a payout system with a per-rider earnings ledger and payout batches.
- **Offline-first ordering** — orders, bills and payments queue on the device and replay through `/api/v1/sync` with stable idempotency keys when connectivity returns.
- **Emerging-market ready** — multi-currency (including NGN), cash / card / transfer / USSD settlement, multi-branch.
- **Live guest experience** — table-QR digital menu, online ordering, real-time order tracking by code (`/api/v1/tracking`), table-call for the waiter, self-service payments.
- **Operational guardrails** — discounts with minimum-order thresholds, ingredient stock deduction, department-routed kitchen orders, role-based access, audit logs.

---

## What has been built so far

Here is everything the system can do, explained simply:

### For Customers (what guests see)
- **Digital menu** — view on phone by scanning QR code (`GET /api/v1/menus/public/:branchId`)
- **Advertisements** — displayed while browsing the menu (`GET /api/v1/advertisements`)
- **Order tracking** — enter tracking code to see order status (`GET /api/v1/tracking/:code`) — no login needed
- **Reservations** — pick a date and party size, choose an available time slot, and book with a confirmation code (`GET /api/v1/reservations/availability`, `POST /api/v1/reservations/book`) — no login needed
- **Reservation self-service** — confirm, look up or cancel a booking with its confirmation code (`GET/POST /api/v1/reservations/confirm|lookup|cancel/:code`)
- **Self-service payments** — pay the bill or raise a cash intent from the phone (`POST /api/v1/public/payments/initialize`, `POST /api/v1/public/payments/cash-intent`)
- **Delivery status** — confirm receipt and confirm delivery hand-over on the order status page (`POST /api/v1/public/tabs/:tabId/confirm-received`, `POST /api/v1/public/tabs/:tabId/confirm-delivery`)

### For Waiters & Staff
- **Sign in** — enter business code to get business ID (`POST /api/v1/auth/resolve-business`), then enter PIN to get JWT (`POST /api/v1/auth/waiter-login` with `{ pin, business_id }`)
- **Take orders** at any table (`POST /api/v1/orders/tab/:tabId`)
- **Send orders** to the kitchen (`POST /api/v1/orders/:id/approve` by supervisor)
- **Track order status** — pending, approved, preparing, ready, out for delivery, delivered (`GET /api/v1/orders/tab/:tabId`)
- **View pending/preparing/ready orders** (`GET /api/v1/orders/pending`, `GET /api/v1/orders/preparing`, `GET /api/v1/orders/ready-for-pickup`)
- **Mark orders as delivered** when serving the customer (`POST /api/v1/orders/:id/deliver`)
- **Split bills** evenly or by item (`POST /api/v1/bills/:tabId/split`)
- **Process payments** — cash or card via Paystack (`POST /api/v1/bills/:tabId/pay`)
- **Print receipts** for customers (`GET /api/v1/bills/:tabId/receipt`)
- **View notifications** with order updates and tracking codes (`GET /api/v1/notifications`)
- **View staff roster** — see who's on shift (`GET /api/v1/user/waiters`)
- **Handle waiter calls** — a ride-hailing queue where calls are broadcast to all waiters until accepted (`POST /api/v1/waiter-calls/:id/accept`)
- **Seat walk-in reservations** — turn a confirmed booking into a live tab (`PATCH /api/v1/reservations/:id/seat`)

### For Riders (delivery drivers)
- **Sign in with PIN** — same waiter-login flow, redirected to the delivery board (`POST /api/v1/auth/waiter-login` with `{ pin, business_id }`)
- **Go online/offline** for a branch (`POST /api/v1/riders/me/toggle-online`)
- **See available deliveries** and claim one — first accept wins (`GET /api/v1/deliveries/available`, `POST /api/v1/deliveries/:id/accept`)
- **Mark a delivery as handed over** once the customer has the order (`POST /api/v1/deliveries/:id/delivered`)
- **View own earnings ledger & payouts** (`GET /api/v1/deliveries/riders/:riderId/ledger`, `GET /api/v1/deliveries/riders/:riderId/payout-batches`)

### For Managers & Owners
- **Dashboard** — real-time sales, active tables, open tabs, staff performance (`GET /api/v1/dashboard`)
- **Menu management** — add, edit, remove items with photos/prices (`CRUD /api/v1/menu-items`)
- **Table management** — set up tables, mark occupied/free (`CRUD /api/v1/tables`)
- **Staff management** — add waiters, supervisors, chefs with roles (`POST /api/v1/user/waiters`)
- **Department management** — organize kitchen sections (`CRUD /api/v1/departments`)
- **Reports** — sales history, popular items, peak hours, table turnover (`GET /api/v1/reports`)
- **Inventory tracking** — stock, low-stock alerts, reconciliations (`CRUD /api/v1/inventory`)
- **Supplier management** — vendor list (`CRUD /api/v1/suppliers`)
- **Role & permissions** — control staff access (`CRUD /api/v1/roles`)
- **Shift management** — open/close daily shifts (`CRUD /api/v1/shifts`)
- **Audit logs** — full action history (`GET /api/v1/audit-logs`)
- **Notifications** — in-app alerts (`GET /api/v1/notifications`)
- **Subscription & billing** — plans, trials, payments (`GET /api/v1/subscriptions`)
- **Multiple branches** — run multiple locations (`CRUD /api/v1/branches`)
- **Printers & KDS** — thermal printers, kitchen displays (`CRUD /api/v1/printers`)
- **POS terminals** — manage point-of-sale devices (`CRUD /api/v1/pos-terminals`)
- **Menu modifiers** — customizations like "extra cheese" (`CRUD /api/v1/menu-modifiers`)
- **AI features** — logic rules, API insights, restock suggestions (`POST /api/v1/ai/*`)
- **Reservations management** — list/today summary, update, cancel (`GET /api/v1/reservations`, `GET /api/v1/reservations/today`, `PATCH /api/v1/reservations/:id`)
- **Walk-ins** — seat a party immediately and open a tab (`POST /api/v1/reservations/walkin`)
- **Reservation reminders** — manually trigger reminder dispatch (`POST /api/v1/reservations/reminders/send`)
- **Delivery board** — all deliveries for the branch, filterable by status (`GET /api/v1/deliveries`)
- **Rider management** — add, edit, reassign or remove riders (`CRUD /api/v1/riders`, `POST /api/v1/deliveries/:id/reassign`)
- **Rider payouts** — pending payout summaries, per-rider ledger, batch payouts (`GET /api/v1/deliveries/payouts/pending`, `GET /api/v1/deliveries/riders/:riderId/ledger`, `POST /api/v1/deliveries/riders/:riderId/payout`)

### For Super Admin (platform owner)
- **Overview dashboard** — all businesses, total revenue, active users (`GET /api/v1/admin/stats`)
- **Business management** — view/update all registered businesses (`GET /api/v1/admin/businesses`)
- **Impersonation** — log in as any business owner to troubleshoot (`POST /api/v1/auth/impersonate`)
- **Extend subscriptions** — grant extra time (`POST /api/v1/admin/businesses/extend`)
- **Full audit visibility** — all activity across the platform (`GET /api/v1/audit-logs`)
- **Ads management** — create/manage digital menu ads (`CRUD /api/v1/advertisements`)

---

## How the system is organized

The project has two main parts:

### 1. Backend (this repository — `hospitalityOS-doc`)
The backend is a set of **Application Programming Interfaces (APIs)** — think of them as messengers that carry information between the app and the database. When someone clicks a button in the app, the app sends a message to the backend, and the backend responds with the data needed.

- Built with **NestJS** (a framework for Node.js)
- Uses **PostgreSQL** as the database
- Hosted on **Render** at `https://serveiq-backend.onrender.com`
- API documentation is available via **Swagger UI** at `https://serveiq-backend.onrender.com/api/docs` — this is a visual page where you can see every available endpoint and test them directly

### 2. Frontend (separate repository — `DennisMajestie/serveIQ`)
This is the actual app that users see and interact with. It includes:
- **Customer-facing menu** (mobile web app)
- **Staff dashboard** (for waiters, chefs, supervisors)
- **Owner dashboard** (for business owners to manage everything)
- **Admin panel** (for the platform owner/super admin)
- Hosted on **Vercel**

---

## How to get started (for developers)

### What you need installed
1. **Node.js** (version 18 or higher)
2. **PostgreSQL** (database)
3. **Git** (to download the code)

### Step-by-step setup

#### Step 1: Download the code
```bash
git clone <repository-url>
cd hospitalityOS-doc
```

#### Step 2: Install dependencies
```bash
npm install
```

#### Step 3: Set up environment variables
Copy the example environment file and fill in your values:
```
DATABASE_URL=postgresql://user:password@localhost:5432/serveiq
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
PAYSTACK_SECRET_KEY=your-paystack-key
```

#### Step 4: Run database migrations
```bash
npm run build -w apps/api
npm run start:dev -w apps/api
```

#### Step 5: Start the server
```bash
npm run start:api
```

The server will start at `http://localhost:5000`.

Swagger documentation will be available at `http://localhost:5000/api/docs`.

---

## How to deploy

### Deploying to Render (backend)
1. Push your code to GitHub
2. In Render dashboard, create a new Web Service
3. Connect your GitHub repository
4. Set:
   - **Build Command:** `npm install && npm run build -w apps/api`
   - **Start Command:** `npm run start:prod -w apps/api`
5. Add all environment variables in Render dashboard
6. Click "Deploy"

### Deploying to Vercel (frontend)
The frontend is in the `DennisMajestie/serveIQ` repository. Connect it to Vercel and it will auto-deploy on every push.

---

## How to use Swagger (API documentation)

Once the server is running, open your browser and go to:
- **Production:** `https://serveiq-backend.onrender.com/api/docs`
- **Local:** `http://localhost:5000/api/docs`

Swagger shows you:
1. **Every endpoint** grouped by category (Authentication, Orders, Menu, etc.)
2. **What each endpoint does** — a short description
3. **What data it needs** — request parameters and body format
4. **What it returns** — response format and status codes
5. **A "Try it out" button** — you can test any endpoint directly from the browser

To use authenticated endpoints, click the "Authorize" button at the top and paste your JWT token.

---

## What each API module does

| Module | Prefix | Purpose |
|---|---|---|
| Auth | `/api/v1/auth` | Login, register, password reset, email verification, impersonation |
| User | `/api/v1/user` | Staff management, profile updates, waiter creation |
| Business | `/api/v1/businesses` | Business profile, settings |
| Branch | `/api/v1/branches` | Multi-location management, QR code generation, settings & feature flags |
| Menu | `/api/v1/menu-items` + `/api/v1/menu` | Food/drink items, categories, import |
| Menu Modifier | `/api/v1/menu-modifiers` | Customizations (extra toppings, size options, etc.) |
| Menu Category | `/api/v1/menu-categories` | Menu grouping |
| Table | `/api/v1/tables` | Table setup, status tracking, assignment |
| Tab | `/api/v1/tabs` | Customer tabs (open/close/transfer/merge/void) |
| Order | `/api/v1/orders` | Order taking, approval workflow, kitchen display |
| Bill | `/api/v1/bills` | Payment processing, split bills, receipts, discounts |
| Department | `/api/v1/departments` | Kitchen sections for order routing |
| Subscription | `/api/v1/subscriptions` | Plans, trials, payments via Paystack |
| Inventory | `/api/v1/inventory` | Stock tracking, alerts, reconciliations |
| Ingredient | `/api/v1/inventory` (ingredient module) | Stock tracked on menu items, bestsellers, movements, restock, stock-variance reports |
| Supplier | `/api/v1/suppliers` | Vendor management |
| Unit | `/api/v1/units` | Measurement units for menu items |
| Shift | `/api/v1/shifts` | Daily shift open/close, templates, handoff, reports |
| Role | `/api/v1/roles` | Permissions and access control |
| Notification | `/api/v1/notifications` | In-app alerts |
| Printer/KDS | `/api/v1/printers` | Thermal printers and kitchen display screens, KDS SSE stream |
| POS Terminal | `/api/v1/pos-terminals` | Point-of-sale device management |
| Report | `/api/v1/reports` | Sales analytics, peak hours, popular items, shift and stock reports |
| Dashboard | `/api/v1/dashboard` | Real-time business overview |
| Audit Log | `/api/v1/audit-logs` | Complete action history |
| Advertisement | `/api/v1/advertisements` | Digital menu ads |
| AI | `/api/v1/ai` | Logic generation, insights, waste analysis |
| Tracking | `/api/v1/tracking` | Order tracking by code (public, no auth) |
| Upload | `/api/v1/upload` | File uploads (images) |
| Sync | `/api/v1/sync` | Offline data synchronization |
| Admin | `/api/v1/admin` | Super admin panel, business overview, impersonation |
| Waiter Call | `/api/v1/waiter-calls` | Customer table-call requests with waiter acceptance queue |
| Reservations | `/api/v1/reservations` | Booking, availability, walk-ins, seating, reminders |
| Riders | `/api/v1/riders` | Delivery rider management, online availability |
| Deliveries | `/api/v1/deliveries` | Dispatch lifecycle + rider payout ledger/batches |
| Public | `/api/v1/public` | Public menu, customer self-service (tabs, orders, confirmations, reviews) |
| Payments | `/api/v1/public/payments` | Self-service payment initialize/cash-intent/webhooks/status |
| Devices | `/api/v1/devices` | Registered-device management (revoke/reactivate) |
| Feedback | `/api/v1/feedback` + `/api/v1/admin/feedback` | Staff feedback / super-admin review |
| Reviews | `/api/v1/admin/reviews` | Customer review management |
| Health | `/api/v1/health` | Liveness + readiness probes |
| Gateway | *(no REST)* | Socket.IO realtime gateways (dashboard/tab events) |

> Note: the inventory endpoints live in the *ingredient* module, and the report endpoints are spread across dashboard, shift, ingredient and admin modules — both are exposed under the `/api/v1/inventory` and `/api/v1/reports` prefixes above.

---

## Status of the project

The backend is fully built and deployed to Render. Every API module is documented in Swagger (visible in non-production envs; production hides `/api/docs` for the reduced attack surface — the OpenAPI is identical because the description is generated from this README). The system handles real businesses with real data.

Current focus areas:
- Hardening payment webhooks and subscription flows for production
- Expanding reservations, delivery dispatch and rider payouts
- Keeping Swagger/OpenAPI in sync as new endpoints land

---

## Recent Changes

### Table Reservations
- Public booking flow: availability slots, create, confirm/lookup/cancel by code
- Staff walk-ins and seating (opens a tab), reminders, per-branch reservation settings
- Reservation-aware floor plan (tables are blocked during a reservation window)

### Delivery Dispatch & Riders
- New `Rider` role with PIN sign-in and online/offline availability
- Rider CRUD, delivery accept/complete/reassign lifecycle, customer confirmation before "delivered"
- Dispatch fee roll-up on bills and payments

### Rider Payouts
- Per-rider earnings ledger, payout batches (manual / Paystack / Flutterwave)
- Pending payout summaries, batch complete/fail flows, admin UI

### Payments & Webhooks
- Paystack SDK replaced with a minimal `fetch` client (clears critical vulns)
- Raw-body signature verification on the Paystack webhook + robust bill matching
- Self-service `initialize`, `cash-intent`, and webhook endpoints for Moniepoint / OPay
- Subscription `callback_url` fix and a transaction verify endpoint

### Misc Fixes & Enhancements
- Startup reliability: migrations run on init + `migration:run:prod`, idempotent role seeds, cross-entity repository registration fixes
- Notifications: `order_ready` notifications batched per tab; `ORDER_APPROVED` includes the tracking code
- KDS: preparation countdown starts on chef accept rather than approval
- CORS: served origins include `serveiqhq.com`
- Coerced query params (`limit`, `offset`, `party_size`) to numbers so validation passes on string values

---

## Common tasks

### How to add a new API endpoint
1. Create or update a controller file in `apps/api/src/modules/<module-name>/`
2. Add the method with the appropriate HTTP decorator (`@Get`, `@Post`, etc.)
3. Add Swagger documentation decorators (`@ApiOperation`, `@ApiProperty` on the DTO, `@ApiResponse`, etc.)
4. Add the business logic in the corresponding service file
5. Rebuild with `npm run build -w apps/api`

### How to run database migrations
Migrations are auto-run at boot via `migrationsRun: true`, and the Render start command additionally runs `migration:run:prod`. To run locally:
```bash
npm run migration:run -w apps/api
```

### How to check logs
- **Local:** Terminal output shows all logs
- **Render:** Go to Render dashboard → your service → "Logs" tab

---

## Need help?

- **Swagger docs:** `https://serveiq-backend.onrender.com/api/docs`
- **Backend URL:** `https://serveiq-backend.onrender.com`
- **GitHub:** Push issues or feature requests to this repository
