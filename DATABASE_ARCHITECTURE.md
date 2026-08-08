# ServeIQ — Database Architecture
**Version 1.0 | PostgreSQL + TypeORM**

---

## Design Rules

1. All primary keys are UUIDs (v4)
2. All monetary values stored as integers (kobo/cents) — NEVER floats
3. All timestamps are UTC (timezone: 'UTC')
4. All entities include: created_at, updated_at, created_by
5. Soft deletes only — use deleted_at (nullable timestamp)
6. Every query must be scoped to business_id + branch_id
7. No hard deletes in production

---

## Entity Relationship Summary

```
businesses
  └── branches
        ├── users (waiters, managers, cashiers)
        ├── tables
        │     └── tabs
        │           └── orders ──── menu_items
        │                 └── bills
        └── menu_items
```

---

## Table Definitions

### businesses
```sql
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('bar', 'restaurant', 'lounge', 'hotel', 'club', 'other')),
  owner_id UUID NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  address TEXT,
  logo_url TEXT,
  currency VARCHAR(10) DEFAULT 'NGN',
  subscription_plan VARCHAR(50) DEFAULT 'trial',
  subscription_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
```

### branches
```sql
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_branches_business ON branches(business_id);
```

### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  branch_id UUID REFERENCES branches(id),
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN (
    'super_admin', 'owner', 'manager', 'waiter', 'cashier', 'inventory_officer'
  )),
  is_active BOOLEAN DEFAULT TRUE,
  email_verified_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  invited_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_users_business ON users(business_id);
CREATE INDEX idx_users_branch ON users(branch_id);
CREATE INDEX idx_users_role ON users(role);
```

### tables
```sql
CREATE TABLE tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  table_number VARCHAR(20) NOT NULL,
  label VARCHAR(100),
  capacity INTEGER,
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN (
    'available', 'occupied', 'reserved', 'closed'
  )),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (branch_id, table_number)
);

CREATE INDEX idx_tables_branch ON tables(branch_id);
CREATE INDEX idx_tables_status ON tables(status);
```

### menu_items
```sql
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  price_kobo INTEGER NOT NULL CHECK (price_kobo >= 0),
  unit VARCHAR(50) DEFAULT 'item',
  image_url TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_menu_items_branch ON menu_items(branch_id);
CREATE INDEX idx_menu_items_category ON menu_items(category);
```

### tabs
```sql
CREATE TABLE tabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  table_id UUID NOT NULL REFERENCES tables(id),
  waiter_id UUID NOT NULL REFERENCES users(id),
  cashier_id UUID REFERENCES users(id),
  tab_number VARCHAR(30) UNIQUE NOT NULL,
  customer_name VARCHAR(255),
  party_size INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN (
    'open', 'billed', 'paid', 'cancelled', 'void'
  )),
  notes TEXT,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  billed_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tabs_branch ON tabs(branch_id);
CREATE INDEX idx_tabs_waiter ON tabs(waiter_id);
CREATE INDEX idx_tabs_table ON tabs(table_id);
CREATE INDEX idx_tabs_status ON tabs(status);
CREATE INDEX idx_tabs_opened_at ON tabs(opened_at);
```

### orders
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id UUID NOT NULL REFERENCES tabs(id),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_kobo INTEGER NOT NULL,
  subtotal_kobo INTEGER GENERATED ALWAYS AS (quantity * unit_price_kobo) STORED,
  round_number INTEGER DEFAULT 1,
  voice_transcription TEXT,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_tab ON orders(tab_id);
CREATE INDEX idx_orders_menu_item ON orders(menu_item_id);
CREATE INDEX idx_orders_created_at ON orders(created_at);
```

### bills
```sql
CREATE TABLE bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id UUID NOT NULL UNIQUE REFERENCES tabs(id),
  subtotal_kobo INTEGER NOT NULL,
  service_charge_kobo INTEGER DEFAULT 0,
  discount_kobo INTEGER DEFAULT 0,
  total_kobo INTEGER NOT NULL,
  payment_method VARCHAR(50) CHECK (payment_method IN (
    'cash', 'transfer', 'card', 'pos', 'split', 'complimentary'
  )),
  payment_reference VARCHAR(255),
  paid_at TIMESTAMPTZ,
  issued_by UUID NOT NULL REFERENCES users(id),
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bills_tab ON bills(tab_id);
CREATE INDEX idx_bills_paid_at ON bills(paid_at);
CREATE INDEX idx_bills_payment_method ON bills(payment_method);
```

---

## Key Queries (Examples)

### Waiter total sales today
```sql
SELECT 
  u.full_name,
  COUNT(DISTINCT t.id) AS tabs_closed,
  SUM(b.total_kobo) / 100.0 AS total_sales_naira
FROM tabs t
JOIN bills b ON b.tab_id = t.id
JOIN users u ON u.id = t.waiter_id
WHERE t.branch_id = $1
  AND b.paid_at >= CURRENT_DATE
  AND b.paid_at < CURRENT_DATE + INTERVAL '1 day'
GROUP BY u.full_name
ORDER BY total_sales_naira DESC;
```

### Top selling items this week
```sql
SELECT 
  mi.name,
  mi.category,
  SUM(o.quantity) AS total_sold,
  SUM(o.subtotal_kobo) / 100.0 AS revenue_naira
FROM orders o
JOIN menu_items mi ON mi.id = o.menu_item_id
JOIN tabs t ON t.id = o.tab_id
WHERE t.branch_id = $1
  AND o.created_at >= NOW() - INTERVAL '7 days'
GROUP BY mi.name, mi.category
ORDER BY total_sold DESC
LIMIT 10;
```

### Open tabs with duration
```sql
SELECT 
  tbl.table_number,
  t.tab_number,
  u.full_name AS waiter,
  t.customer_name,
  t.party_size,
  EXTRACT(EPOCH FROM (NOW() - t.opened_at)) / 60 AS minutes_open,
  COALESCE(SUM(o.subtotal_kobo), 0) / 100.0 AS running_total_naira
FROM tabs t
JOIN tables tbl ON tbl.id = t.table_id
JOIN users u ON u.id = t.waiter_id
LEFT JOIN orders o ON o.tab_id = t.id
WHERE t.branch_id = $1
  AND t.status = 'open'
GROUP BY tbl.table_number, t.tab_number, u.full_name, t.customer_name, t.party_size, t.opened_at
ORDER BY t.opened_at ASC;
```

---

## Indexes Strategy

Critical indexes for performance:
- All foreign keys indexed
- `status` columns indexed (for dashboard queries)
- `created_at` / `paid_at` indexed (for date range reports)
- `(branch_id, status)` composite index on tabs and tables

---

## V2 Additions (Design Ready, Build Later)

The schema is designed to accommodate these without breaking changes:

- `inventory_items` — links menu_items to stock levels
- `stock_movements` — tracks every stock change
- `shifts` — shift open/close with cash reconciliation
- `bill_splits` — multiple payments per bill
- `customer_profiles` — linked to tabs via customer_id
- `audit_logs` — every critical mutation recorded
