# ServeIQ

## What is this?

ServeIQ is a platform that helps restaurants, bars, and hotels manage their business — from taking customer orders at a table to processing payments and tracking inventory. Think of it as a complete digital toolkit for running a hospitality business.

This project contains the **backend** (the "brain" — an API that powers everything) and documentation for the whole system.

---

## What has been built so far

Here is everything the system can do, explained simply:

### For Customers (what guests see)
- **Digital menu** — view on phone by scanning QR code (`GET /api/v1/menus/public/:branchId`)
- **Advertisements** — displayed while browsing the menu (`GET /api/v1/advertisements`)
- **Order tracking** — enter tracking code to see order status (`GET /api/v1/tracking/:code`) — no login needed

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

### For Super Admin (platform owner)
- **Overview dashboard** — all businesses, total revenue, active users (`GET /api/v1/admin/stats`)
- **Business management** — view/update all registered businesses (`GET /api/v1/admin/businesses`)
- **Impersonation** — log in as any business owner to troubleshoot (`POST /api/v1/auth/impersonate`)
- **Extend subscriptions** — grant extra time (`POST /api/v1/admin/businesses/extend`)
- **Full audit visibility** — all activity across the platform (`GET /api/v1/audit-logs`)
- **Ads management** — create/manage digital menu ads (`CRUD /api/v1/advertisements`)

---

## Legal & Data Protection

ServeIQ maintains a complete set of legal and data-protection documents. These are standalone files in the repository that the wider ServeIQ frontend and marketing site can link to (a privacy policy and terms page should be exposed in the app footer).

| Document | Purpose | Audience |
|---|---|---|
| [Privacy Policy](PRIVACY.md) | What personal data we collect, why, how it is stored, shared, and your rights. | End users, business owners, staff, customers |
| [Terms of Service](TERMS_OF_SERVICE.md) | The binding agreement between ServeIQ and its users/businesses, including IP, liability, and dispute resolution. | Business owners, staff |
| [Cookie Policy](COOKIE_POLICY.md) | How cookies and local storage are used (authentication, offline sync). | All website users |
| [Data Processing Agreement](DATA_PROCESSING_AGREEMENT.md) | Processor/controller obligations between ServeIQ and its business customers (GDPR, NDPR, POPIA-aligned). | Business customers |

> **Production note:** Legal documents are finalized with entity name (ServeIQ Technologies Ltd), registered address (Plot 12, Admiralty Road, Lekki Phase 1, Lagos 100001, Nigeria), jurisdiction (Federal Republic of Nigeria), and effective dates confirmed. Sections referencing features not yet shipped (Paystack V2+, AI/NVIDIA V4, Google Analytics, cross-border) should still be verified against the actual production stack before publishing.

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
|---|---|---|---|
| Auth | `/api/v1/auth` | Login, register, password reset, email verification, impersonation |
| User | `/api/v1/user` | Staff management, profile updates, waiter creation |
| Business | `/api/v1/businesses` | Business profile, settings |
| Branch | `/api/v1/branches` | Multi-location management, QR code generation |
| Menu | `/api/v1/menu-items` | Food/drink items, categories, import |
| Menu Modifier | `/api/v1/menu-modifiers` | Customizations (extra toppings, size options, etc.) |
| Table | `/api/v1/tables` | Table setup, status tracking, assignment |
| Tab | `/api/v1/tabs` | Customer tabs (open/close/transfer/void) |
| Order | `/api/v1/orders` | Order taking, approval workflow, kitchen display |
| Bill | `/api/v1/bills` | Payment processing, split bills, receipts, discounts |
| Department | `/api/v1/departments` | Kitchen sections for order routing |
| Subscription | `/api/v1/subscriptions` | Plans, trials, payments via Paystack |
| Inventory | `/api/v1/inventory` | Stock tracking, alerts, reconciliations, recipes |
| Supplier | `/api/v1/suppliers` | Vendor management |
| Shift | `/api/v1/shifts` | Daily shift open/close, reports |
| Role | `/api/v1/roles` | Permissions and access control |
| Notification | `/api/v1/notifications` | In-app alerts |
| Printer/KDS | `/api/v1/printers` | Thermal printers and kitchen display screens |
| POS Terminal | `/api/v1/pos-terminals` | Point-of-sale device management |
| Report | `/api/v1/reports` | Sales analytics, peak hours, popular items |
| Dashboard | `/api/v1/dashboard` | Real-time business overview |
| Audit Log | `/api/v1/audit-logs` | Complete action history |
| Advertisement | `/api/v1/advertisements` | Digital menu ads |
| AI | `/api/v1/ai` | Logic generation, insights, waste analysis |
| Tracking | `/api/v1/tracking` | Order tracking by code (public, no auth) |
| Upload | `/api/v1/upload` | File uploads (images) |
| Sync | `/api/v1/sync` | Offline data synchronization |
| Admin | `/api/v1/admin` | Super admin panel, business overview, impersonation |

---

## Status of the project

The backend is fully built and deployed. All 29 API modules are working and documented in Swagger. The system handles real businesses with real data on Render.

Current focus areas:
- Fixing bugs found during real-world testing
- Improving the admin dashboard for troubleshooting
- Ensuring all Swagger documentation is complete

---

## Recent Changes

### Role-Based Access Improvements
- **Departments**: Waiters, Chefs, and Cashiers can now list departments (previously Owner/Manager only)
- **Audit Logs**: All staff roles (Owner, Manager, Supervisor, Waiter, Chef, Cashier) can now view audit logs
- **Order Delivery**: Waiters can now mark orders as delivered, enabling a streamlined table-service workflow

### Notifications
- **ORDER_APPROVED** notification type added
- Notifications are now sent when an order is approved, including the tracking code

### Bug Fixes & Enhancements
- **Impersonation fix**: Returns `branchId` from the database instead of incorrect default values
- **Business list**: Now returns a `branches` array for each business, providing complete branch visibility
- **User role protected**: The user `role` field is now protected from overwrite on PATCH requests
- **Terminal activation**: Fixed the POS terminal activation flow
- **Table mismatch**: Resolved a race condition that caused table mismatch errors

---

## Common tasks

### How to add a new API endpoint
1. Create or update a controller file in `apps/api/src/modules/<module-name>/`
2. Add the method with the appropriate HTTP decorator (`@Get`, `@Post`, etc.)
3. Add Swagger documentation decorators (`@ApiOperation`, `@ApiResponse`, etc.)
4. Add the business logic in the corresponding service file
5. Rebuild with `npm run build -w apps/api`

### How to run database migrations
Schema changes are managed exclusively through TypeORM migrations (`synchronize: false`). On startup the app runs pending migrations automatically (`migrationsRun: true`) when you build and start. To generate a new migration from entity changes: `npm run migration:generate -w apps/api`, then run with `npm run migration:run -w apps/api`.

### How to check logs
- **Local:** Terminal output shows all logs
- **Render:** Go to Render dashboard → your service → "Logs" tab

---

## Need help?

- **Swagger docs:** `https://serveiq-backend.onrender.com/api/docs`
- **Backend URL:** `https://serveiq-backend.onrender.com`
- **GitHub:** Push issues or feature requests to this repository
