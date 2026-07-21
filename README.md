# ServeIQ

## What is this?

ServeIQ is a platform that helps restaurants, bars, and hotels manage their business — from taking customer orders at a table to processing payments and tracking inventory. Think of it as a complete digital toolkit for running a hospitality business.

This project contains the **backend** (the "brain" — an API that powers everything) and documentation for the whole system.

---

## What has been built so far

Here is everything the system can do, explained simply:

### For Customers (what guests see)
- A **digital menu** they can view on their phone by scanning a QR code at their table
- They can see **advertisements** while browsing the menu

### For Waiters & Staff
- **Take orders** from customers at any table
- **Send orders** to the kitchen (printer or digital display)
- **Track order status** — pending, preparing, ready, delivered
- **Split bills** evenly or by item when customers want to pay separately
- **Process payments** (cash or card via Paystack)
- **Print receipts** for customers

### For Managers & Owners
- **Dashboard** showing real-time sales, active tables, open tabs, and staff performance
- **Menu management** — add, edit, remove food/drink items with photos and prices
- **Table management** — set up tables, mark them as occupied or free
- **Staff management** — add waiters, supervisors, chefs with different access levels
- **Department management** — organize the kitchen into sections (Kitchen, Bar, Grill, etc.)
- **Reports** — see sales history, popular items, peak hours, table turnover
- **Inventory tracking** — track ingredient stock, get low-stock alerts, reconcile counts
- **Supplier management** — keep a list of suppliers for ingredients
- **Role & permissions** — control exactly what each staff member can do
- **Shift management** — open and close daily shifts, track who worked when
- **Audit logs** — see a complete history of every action taken in the system
- **Notifications** — get alerts for important events
- **Subscription & billing** — manage plans, trials, payments, and expiry dates
- **Multiple branches** — a single business can run multiple locations
- **Printers & KDS** — connect to thermal printers or kitchen display screens
- **POS terminals** — register and manage point-of-sale devices
- **Menu modifiers** — add customizations like "extra cheese" or "no ice"
- **AI features** — generate logic rules, analyze API usage, get restock insights

### For Super Admin (platform owner)
- **Overview dashboard** — see all businesses, total revenue, active users
- **Business management** — view all registered businesses, their status, subscription info
- **Impersonation** — log in as any business owner to help them troubleshoot issues
- **Extend subscriptions** — manually grant or extend subscription periods
- **Full audit visibility** — see all activity across the entire platform
- **Ads management** — create and manage advertisements shown on digital menus

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

| Module | Purpose |
|---|---|
| Auth | Login, register, password reset, email verification, impersonation |
| User | Staff management, profile updates, waiter creation |
| Business | Business profile, settings |
| Branch | Multi-location management, QR code generation |
| Menu | Food/drink items, categories, import |
| Menu Modifier | Customizations (extra toppings, size options, etc.) |
| Table | Table setup, status tracking, assignment |
| Tab | Customer tabs (open/close/transfer/void) |
| Order | Order taking, approval workflow, kitchen display |
| Bill | Payment processing, split bills, receipts, discounts |
| Department | Kitchen sections for order routing |
| Subscription | Plans, trials, payments via Paystack |
| Inventory | Stock tracking, alerts, reconciliations, recipes |
| Supplier | Vendor management |
| Shift | Daily shift open/close, reports |
| Role | Permissions and access control |
| Notification | In-app alerts |
| Printer/KDS | Thermal printers and kitchen display screens |
| POS Terminal | Point-of-sale device management |
| Report | Sales analytics, peak hours, popular items |
| Dashboard | Real-time business overview |
| Audit Log | Complete action history |
| Advertisement | Digital menu ads |
| AI | Logic generation, insights, waste analysis |
| Tracking | Order tracking by code |
| Upload | File uploads (images) |
| Sync | Offline data synchronization |
| Admin | Super admin panel, business overview, impersonation |

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
The database is managed via TypeORM synchronize in development. In production, migrations are auto-synced on deploy.

### How to check logs
- **Local:** Terminal output shows all logs
- **Render:** Go to Render dashboard → your service → "Logs" tab

---

## Need help?

- **Swagger docs:** `https://serveiq-backend.onrender.com/api/docs`
- **Backend URL:** `https://serveiq-backend.onrender.com`
- **GitHub:** Push issues or feature requests to this repository
