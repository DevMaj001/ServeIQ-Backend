# Authorization Architecture Audit (Sprint 1)

**Project:** ServeIQ PBAC Migration  
**Date:** 2025-07-18  
**Scope:** Complete backend + frontend authorization audit  

---

## 1. CONTROLLER AUDIT

### Summary: 22 controllers inspected

| Module | Endpoint | Method | Current Guard | Current Roles | Required Permission | Risk |
|--------|----------|--------|---------------|---------------|---------------------|------|
| **Orders** | | | | | | |
| | `/orders/:id/approve` | POST | RolesGuard | SUPERVISOR, OWNER, MANAGER | `approve_orders` | 🔴 High |
| | `/orders/:id/decline` | POST | RolesGuard | SUPERVISOR, OWNER, MANAGER | `decline_orders` | 🔴 High |
| | `/orders/:id/deliver` | POST | RolesGuard | SUPERVISOR, OWNER, MANAGER | `mark_delivered` | 🔴 High |
| | `/orders/:id` (PATCH) | PATCH | RolesGuard | SUPERVISOR, OWNER, MANAGER | `edit_orders` | 🔴 High |
| | `/orders/:id` (DELETE) | DELETE | RolesGuard | SUPERVISOR, OWNER, MANAGER | `cancel_orders` | 🟡 Med |
| | `/orders/pending` | GET | RolesGuard | SUPERVISOR, OWNER, MANAGER, WAITER | `view_dashboard` | 🟢 Low |
| | `/orders/preparing` | GET | RolesGuard | SUPERVISOR, OWNER, MANAGER, WAITER | `view_dashboard` | 🟢 Low |
| | `/orders/ready-for-pickup` | GET | RolesGuard | SUPERVISOR, OWNER, MANAGER, WAITER | `view_dashboard` | 🟢 Low |
| | `/orders/tab/:tabId` | GET | None | (none) | `view_dashboard` | 🟡 Med |
| | `/orders/:id` (GET) | GET | None | (none) | `view_dashboard` | 🟡 Med |
| | `POST /orders/tab/:tabId` | POST | None | (none) | `edit_orders` | 🟡 Med |
| **Tabs** | | | | | | |
| | `/tabs` (GET) | GET | None | (none) | `view_dashboard` | 🟢 Low |
| | `/tabs` (POST open) | POST | None | (none) | `open_table` | 🟡 Med |
| | `/tabs/:id` (GET) | GET | None | (none) | `view_dashboard` | 🟢 Low |
| | `/tabs/:id/close` | POST | None | (none) | `close_table` | 🟡 Med |
| | `/tabs/:id` (PATCH) | PATCH | RolesGuard | SUPERVISOR, OWNER, MANAGER | `edit_tables` | 🟡 Med |
| | `/tabs/:id/transfer` | POST | RolesGuard | SUPERVISOR, OWNER, MANAGER | `transfer_table` | 🟡 Med |
| | `/tabs/:id/void` | POST | RolesGuard | SUPERVISOR, OWNER, MANAGER | `void_tab` | 🟡 Med |
| | `/tabs/:id` (DELETE) | DELETE | RolesGuard | OWNER, MANAGER | `delete_table` | 🟡 Med |
| | `/tabs/waiter-list` | GET | None | (none) | `view_staff` | 🟢 Low |
| **Tables** | | | | | | |
| | `/tables` (GET) | GET | None | (none) | `view_dashboard` | 🟢 Low |
| | `/tables` (POST) | POST | RolesGuard | OWNER, MANAGER | `open_table` | 🟡 Med |
| | `/tables/:id` (PATCH) | PATCH | RolesGuard | OWNER, MANAGER | `edit_tables` | 🟡 Med |
| | `/tables/:id/status` | PATCH | None | (none) | `close_table` | 🟡 Med |
| | `/tables/:id/release` | POST | RolesGuard | OWNER, MANAGER | `release_table` | 🟡 Med |
| | `/tables/:id` (DELETE) | DELETE | RolesGuard | OWNER, MANAGER | `delete_table` | 🟡 Med |
| **Menu** | | | | | | |
| | `/menu-items` (GET) | GET | None | (none) | `view_dashboard` | 🟢 Low |
| | `/menu-items` (POST) | POST | RolesGuard | OWNER, MANAGER | `create_menu` | 🟡 Med |
| | `/menu-items/:id` (PATCH) | PATCH | RolesGuard | OWNER, MANAGER | `edit_menu` | 🟡 Med |
| | `/menu-items/:id/toggle` | PATCH | None | (none) | `mark_unavailable` | 🟡 Med |
| | `/menu-items` (DELETE) | DELETE | RolesGuard | OWNER, MANAGER | `delete_menu` | 🟡 Med |
| | `/menu-items/import` | POST | RolesGuard | OWNER, MANAGER | `create_menu` | 🟡 Med |
| **Bills** | | | | | | |
| | `/bills/tab/:tabId/generate` | POST | None | (none) | `accept_payment` | 🟡 Med |
| | `/bills/tab/:tabId/apply-discount` | POST | RolesGuard | SUPERVISOR, OWNER, MANAGER | `discount_bill` | 🟡 Med |
| | `/bills/tab/:tabId/pay` | POST | None | (none) | `accept_payment` | 🟡 Med |
| | `/bills/tab/:tabId/split-evenly` | POST | None | (none) | `split_bill` | 🟡 Med |
| | `/bills/tab/:tabId/split-by-item` | POST | None | (none) | `split_bill` | 🟡 Med |
| | `/bills/tab/:tabId/splits` | GET | None | (none) | `view_dashboard` | 🟢 Low |
| | `/bills/tab/:tabId/splits/:billId/pay` | POST | None | (none) | `accept_payment` | 🟡 Med |
| | `/bills/tab/:tabId/receipt` | GET | None | (none) | `view_dashboard` | 🟢 Low |
| | `/bills/tab/:tabId/receipt/pdf` | GET | None | (none) | `view_dashboard` | 🟢 Low |
| **Users** | | | | | | |
| | `/user/waiters` (POST) | POST | RolesGuard | OWNER, MANAGER | `create_staff` | 🟡 Med |
| | `/user/me` (GET) | GET | None | (none) | `view_dashboard` | 🟢 Low |
| | `/user/me` (PATCH) | PATCH | None | (none) | `edit_staff` (self) | 🟢 Low |
| | `/user/waiters` (GET) | GET | None | (none) | `view_staff` | 🟢 Low |
| | `/user/waiters/:id/reset-pin` | PATCH | RolesGuard | OWNER, MANAGER | `reset_password` | 🟡 Med |
| | `/user/:id` (PATCH) | PATCH | RolesGuard | OWNER, MANAGER | `edit_staff` | 🟡 Med |
| | `/user/:id/deactivate` | PATCH | RolesGuard | OWNER, MANAGER | `delete_staff` | 🟡 Med |
| | `/user/:id` (DELETE) | DELETE | RolesGuard | OWNER, MANAGER | `delete_staff` | 🟡 Med |
| **Roles & Permissions** | | | | | | |
| | `/roles/my-permissions` | GET | None | (none) | `view_staff` | 🟢 Low |
| | `/roles` (GET) | GET | RolesGuard + PermissionsGuard | OWNER, MANAGER + `VIEW_STAFF` | `view_staff` | 🟢 Low |
| | `/roles/permissions` (GET) | GET | RolesGuard + PermissionsGuard | OWNER, MANAGER + `VIEW_STAFF` | `view_staff` | 🟢 Low |
| | `/roles/:id/permissions` (PUT) | PUT | RolesGuard + PermissionsGuard | OWNER + `ASSIGN_ROLES` | `assign_roles` | 🟢 Low |
| **Menu Modifiers** | | | | | | |
| | `/modifier-groups` (GET) | GET | None | (none) | `view_dashboard` | 🟢 Low |
| | `/modifier-groups` (POST) | POST | RolesGuard | OWNER, MANAGER | `create_menu` | 🟡 Med |
| | `/modifier-groups/:id` (PATCH) | PATCH | RolesGuard | OWNER, MANAGER | `edit_menu` | 🟡 Med |
| | `/modifier-groups/:id` (DELETE) | DELETE | RolesGuard | OWNER, MANAGER | `delete_menu` | 🟡 Med |
| **Departments** | | | | | | |
| | `/departments` (GET) | GET | None | (none) | `view_dashboard` | 🟢 Low |
| | `/departments` (POST) | POST | RolesGuard | OWNER, MANAGER, SUPERVISOR | `create_staff` | 🟡 Med |
| | `/departments/:id` (PATCH) | PATCH | RolesGuard | OWNER, MANAGER | `edit_staff` | 🟡 Med |
| | `/departments/:id` (DELETE) | DELETE | RolesGuard | OWNER, MANAGER | `delete_staff` | 🟡 Med |
| **Shifts** | | | | | | |
| | `/shifts` (GET) | GET | None | (none) | `view_dashboard` | 🟢 Low |
| | `/shifts/current` | GET | None | (none) | `view_dashboard` | 🟢 Low |
| | `/shifts/open` | POST | None | (none) | `edit_staff` | 🟡 Med |
| | `/shifts/:id/close` | POST | None | (none) | `edit_staff` | 🟡 Med |
| | `/shifts/reports` | GET | None | (none) | `view_daily_sales` | 🟢 Low |
| **Inventory** | | | | | | |
| | `/inventory` (GET) | GET | None | (none) | `view_inventory` | 🟢 Low |
| | `/inventory` (POST) | POST | RolesGuard | OWNER, MANAGER | `manage_suppliers` | 🟡 Med |
| | `/inventory/:id` (PATCH) | PATCH | RolesGuard | OWNER, MANAGER | `update_inventory` | 🟡 Med |
| | `/inventory/audit` (GET) | GET | None | (none) | `view_inventory` | 🟢 Low |
| | `/inventory/reconcile` (POST) | POST | RolesGuard | OWNER, MANAGER | `adjust_stock` | 🟡 Med |
| **Suppliers** | | | | | | |
| | `/suppliers` (GET) | GET | None | (none) | `view_inventory` | 🟢 Low |
| | `/suppliers` (POST) | POST | RolesGuard | OWNER, MANAGER | `manage_suppliers` | 🟡 Med |
| | `/suppliers/:id` (PATCH) | PATCH | RolesGuard | OWNER, MANAGER | `update_inventory` | 🟡 Med |
| | `/suppliers/:id` (DELETE) | DELETE | RolesGuard | OWNER, MANAGER | `manage_suppliers` | 🟡 Med |
| **Printers** | | | | | | |
| | `/printers` (GET) | GET | None | (none) | `view_dashboard` | 🟢 Low |
| | `/printers` (POST) | POST | RolesGuard | OWNER, MANAGER | `manage_suppliers` | 🟡 Med |
| | `/printers/:id` (PATCH) | PATCH | RolesGuard | OWNER, MANAGER | `manage_suppliers` | 🟡 Med |
| | `/printers/:id` (DELETE) | DELETE | RolesGuard | OWNER, MANAGER | `manage_suppliers` | 🟡 Med |
| **Print Jobs** | | | | | | |
| | `/print-jobs` (GET) | GET | None | (none) | `view_dashboard` | 🟢 Low |
| | `/print-jobs/:id/print` | POST | None | (none) | `view_dashboard` | 🟢 Low |
| **Tracking** | | | | | | |
| | `/tracking/:code` | GET | None | (none) | `view_tracking` | 🟢 Low |
| **Dashboard** | | | | | | |
| | `/dashboard/branch` | GET | None | (none) | `view_dashboard` | 🟢 Low |
| | `/dashboard/waiters` | GET | None | (none) | `view_staff` | 🟢 Low |
| | `/reports/sales` | GET | None | (none) | `view_daily_sales` | 🟢 Low |
| | `/reports/peak-hours` | GET | None | (none) | `view_dashboard` | 🟢 Low |
| | `/reports/items` | GET | None | (none) | `view_dashboard` | 🟢 Low |
| | `/reports/table-velocity` | GET | None | (none) | `view_dashboard` | 🟢 Low |
| **Business** | | | | | | |
| | `/businesses/me` (GET) | GET | None | (none) | `view_dashboard` | 🟢 Low |
| | `/businesses/me` (PATCH) | PATCH | RolesGuard | OWNER, MANAGER | `manage_settings` | 🟡 Med |
| **Branch** | | | | | | |
| | `/branches` (GET) | GET | None | (none) | `view_dashboard` | 🟢 Low |
| | `/branches` (POST) | POST | RolesGuard | OWNER, MANAGER, SUPERADMIN | `manage_settings` | 🟡 Med |
| | `/branches/:id` (PATCH) | PATCH | RolesGuard | OWNER, MANAGER, SUPERADMIN | `manage_settings` | 🟡 Med |
| | `/branches/:id` (DELETE) | DELETE | RolesGuard | OWNER, MANAGER, SUPERADMIN | `manage_settings` | 🟡 Med |
| **Auth** | | | | | | |
| | `/auth/login` | POST | None | (none) | N/A | N/A |
| | `/auth/waiter-login` | POST | None | (none) | N/A | N/A |
| | `/auth/register` | POST | None | (none) | N/A | N/A |

---

## 2. SERVICE AUDIT

### Role Checks Outside Controllers

| File | Location | Pattern | Risk |
|------|----------|---------|------|
| `order.service.ts` | No role checks — good | N/A | Low |
| `tab.service.ts` | `openTab()` passes `req.user.role` to service — passes role for business logic, not auth | Medium |
| `bill.service.ts` | `generateBill()`, `processPayment()` receive `req.user.role` — used for business logic | Medium |
| `user.service.ts` | No role checks — good | N/A | Low |
| `menu.service.ts` | No role checks — good | N/A | Low |

**Finding:** Services pass `user.role` for business logic (e.g., different PIN validation flows), not for authorization. Authorization is correctly at controller level.

---

## 3. MIDDLEWARE / GUARD / INTERCEPTOR AUDIT

| Component | File | Purpose | Current State |
|-----------|------|---------|---------------|
| `JwtAuthGuard` | `auth/guards/jwt-auth.guard.ts` | Validates JWT, attaches `req.user` | ✅ Works |
| `RolesGuard` | `common/guards/roles.guard.ts` | Checks `@Roles()` decorator | ✅ Works — RBAC only |
| `PermissionsGuard` | `common/guards/permissions.guard.ts` | Checks `@RequirePermissions()` | ✅ Works — but has legacy fallback |
| `PermissionsGuard` (line 49-51) | | Legacy fallback bypasses PBAC for users without `role_id` | 🔴 **Critical** — bypasses PBAC for legacy users |
| `@RequirePermissions()` | `common/decorators/permissions.decorator.ts` | Decorator for permission metadata | ✅ Works |
| `SubscriptionsGuard` | `common/guards/subscription.guard.ts` | Checks subscription status | Separate concern |
| `AuthInterceptor` | `shared/data-access/auth.interceptor.ts` | Attaches token to requests | ✅ Works |

---

## 4. FRONTEND AUDIT

### Role Checks in Components

| File | Line | Pattern | Risk |
|------|------|---------|------|
| `admin-shell.component.ts` | 42, 65, 231 | `profile().role === 'owner' \|\| 'manager'` | 🔴 Replace with `perm.can()` |
| `admin-shell.component.ts` | 42 | `role === 'super_admin'` | 🔴 Platform role check |
| `manager-or-owner.guard.ts` | 15, 22 | `role === 'owner' \|\| 'manager' \|\| 'super_admin'` | 🔴 Replace with `perm.can()` |
| `super-admin.guard.ts` | 7 | `role === 'super_admin'` | Platform role — keep separate |
| `owner.guard.ts` | 7 | `role === 'owner' \|\| 'super_admin'` | 🔴 Replace with `perm.can()` |
| `permission.guard.ts` | 14 | `permService.hasPermission()` | ✅ Correct |
| `login.component.ts` (waiter) | 49, 74, 78 | `role === 'supervisor'`, `role === 'manager' \|\| 'owner'` | 🔴 Replace with permission-based routing |
| `dashboard.component.ts` | 44-45 | `role === 'superadmin'` | 🔴 Replace |

---

## 5. NAVIGATION / MENU AUDIT (Admin Shell)

| Menu Item | Route | Current Role Guard | Required Permission |
|-----------|-------|-------------------|---------------------|
| Dashboard | `/app/dashboard` | `managerOrOwnerGuard` | `view_dashboard` |
| Tables | `/app/tables` | `managerOrOwnerGuard` | `open_table` / `close_table` |
| Menu | `/app/menu` | `managerOrOwnerGuard` | `create_menu` / `edit_menu` / `mark_unavailable` |
| Staff | `/app/staff` | `managerOrOwnerGuard` | `view_staff` / `create_staff` |
| Bills | `/app/bills` | `managerOrOwnerGuard` | `accept_payment` / `split_bill` / `discount_bill` |
| Reports | `/app/reports` | `managerOrOwnerGuard` | `view_daily_sales` / `view_monthly_sales` / `view_profit` |
| Analytics | `/app/analytics` | `managerOrOwnerGuard` | `view_dashboard` |
| Departments | `/app/departments` | `managerOrOwnerGuard` | `view_staff` |
| Ads | `/app/ads` | `managerOrOwnerGuard` | `view_dashboard` |
| Suppliers | `/app/suppliers` | `managerOrOwnerGuard` | `manage_suppliers` |
| Shifts | `/app/shifts` | `managerOrOwnerGuard` | `view_dashboard` |
| Inventory | `/app/inventory` | `managerOrOwnerGuard` | `view_inventory` / `update_inventory` / `adjust_stock` |
| Inventory/Audit | `/app/inventory/audit` | `managerOrOwnerGuard` | `view_inventory` |
| Inventory/Reconcile | `/app/inventory/reconcile` | `managerOrOwnerGuard` | `adjust_stock` |
| Inventory/Daily Tally | `/app/inventory/daily-tally` | `managerOrOwnerGuard` | `view_inventory` |
| Bills | `/app/bills` | `managerOrOwnerGuard` | `accept_payment` / `split_bill` / `discount_bill` |
| POS | `/app/pos` | `managerOrOwnerGuard` | `view_dashboard` |
| Reports | `/app/reports` | `managerOrOwnerGuard` | `view_daily_sales` / `view_monthly_sales` / `view_profit` |
| Notifications | `/app/notifications` | `managerOrOwnerGuard` | `view_dashboard` |
| Billing | `/app/billing` | `managerOrOwnerGuard` | `manage_subscription` |
| Settings | `/app/settings` | `managerOrOwnerGuard` | `restaurant_settings` |
| Roles | `/app/roles` | `managerOrOwnerGuard` | `view_staff` / `assign_roles` |
| Pulse | `/app/pulse` | `managerOrOwnerGuard` | `view_dashboard` |
| Premium Dashboard | `/app/premium-dashboard` | `managerOrOwnerGuard` | `view_dashboard` |
| Setup | `/app/setup` | `managerOrOwnerGuard` | `restaurant_settings` |

---

## 6. ROUTE AUDIT (Admin App)

| Route | Current Guard | Target Guard |
|-------|--------------|--------------|
| `/app/admin/dashboard` | `superAdminGuard` | Platform role — keep |
| `/app/admin/businesses` | `superAdminGuard` | Platform role — keep |
| `/app/autopilot` | `superAdminGuard` | Platform role — keep |
| `/app/dashboard` | `managerOrOwnerGuard` | `permissionGuard('view_dashboard')` |
| `/app/analytics` | `managerOrOwnerGuard` | `permissionGuard('view_dashboard')` |
| `/app/tables` | `managerOrOwnerGuard` | `permissionGuard('open_table')` |
| `/app/menu` | `managerOrOwnerGuard` | `permissionGuard('create_menu')` |
| `/app/staff` | `managerOrOwnerGuard` | `permissionGuard('view_staff')` |
| `/app/tabs` | `managerOrOwnerGuard` | `permissionGuard('open_table')` |
| `/app/departments` | `managerOrOwnerGuard` | `permissionGuard('view_staff')` |
| `/app/suppliers` | `managerOrOwnerGuard` | `permissionGuard('manage_suppliers')` |
| `/app/shifts` | `managerOrOwnerGuard` | `permissionGuard('view_dashboard')` |
| `/app/inventory` | `managerOrOwnerGuard` | `permissionGuard('view_inventory')` |
| `/app/inventory/audit` | `managerOrOwnerGuard` | `permissionGuard('view_inventory')` |
| `/app/inventory/reconcile` | `managerOrOwnerGuard` | `permissionGuard('adjust_stock')` |
| `/app/inventory/daily-tally` | `managerOrOwnerGuard` | `permissionGuard('view_inventory')` |
| `/app/bills` | `managerOrOwnerGuard` | `permissionGuard('accept_payment')` |
| `/app/pos` | `managerOrOwnerGuard` | `permissionGuard('view_dashboard')` |
| `/app/reports` | `managerOrOwnerGuard` | `permissionGuard('view_daily_sales')` |
| `/app/notifications` | `managerOrOwnerGuard` | `permissionGuard('view_dashboard')` |
| `/app/billing` | `managerOrOwnerGuard` | `permissionGuard('manage_subscription')` |
| `/app/settings` | `managerOrOwnerGuard` | `permissionGuard('restaurant_settings')` |
| `/app/roles` | `managerOrOwnerGuard` | `permissionGuard('view_staff')` + `permissionGuard('assign_roles')` |
| `/app/pulse` | `managerOrOwnerGuard` | `permissionGuard('view_dashboard')` |
| `/app/premium-dashboard` | `managerOrOwnerGuard` | `permissionGuard('view_dashboard')` |
| `/app/setup` | `managerOrOwnerGuard` | `permissionGuard('restaurant_settings')` |
| `/app/ads` | `managerOrOwnerGuard` | `permissionGuard('view_dashboard')` |

---

## 7. PERMISSION INVENTORY

### Current 49 Permissions (from `permission-codes.ts`)

| Category | Permissions (49 total) |
|----------|------------------------|
| **Orders** (8) | `approve_orders`, `decline_orders`, `edit_orders`, `cancel_orders`, `assign_department`, `change_priority`, `mark_ready`, `mark_delivered` |
| **Tables** (6) | `open_table`, `close_table`, `merge_tables`, `split_table`, `transfer_table`, `assign_waiter` |
| **Payments** (6) | `accept_payment`, `split_bill`, `issue_refund`, `void_payment`, `discount_bill`, `reopen_invoice` |
| **Menu** (5) | `create_menu`, `edit_menu`, `delete_menu`, `change_price`, `mark_unavailable` |
| **Inventory** (4) | `view_inventory`, `update_inventory`, `adjust_stock`, `manage_suppliers` |
| **Reports** (5) | `view_dashboard`, `view_daily_sales`, `view_monthly_sales`, `view_profit`, `export_reports` |
| **Staff** (6) | `view_staff`, `create_staff`, `edit_staff`, `delete_staff`, `assign_roles`, `reset_password` |
| **Customers** (3) | `view_tracking`, `generate_tracking`, `manage_reservations` |
| **System** (7) | `manage_subscription`, `payment_gateway`, `api_keys`, `restaurant_settings`, `security_settings`, `branding` |

### Issues Found
| Issue | Severity | Notes |
|-------|----------|-------|
| `manage_reservations` exists but **reservations feature not built** | Low | Placeholder — flag or remove |
| No permission for `manage_reservations` in Manager template | Medium | Spec says Manager should have it — currently missing |
| `manage_reservations` in Manager seed but feature missing | Medium | Inconsistency |
| `manage_subscription` in System but `billing` route uses `managerOrOwnerGuard` | Medium | Mismatch — billing should check `manage_subscription` |
| No `view_reports` or `view_analytics` — uses `view_dashboard` | Low | Acceptable |

---

## 8. PERMISSION CATEGORIES (for UI Grouping)

| Category | Permissions |
|----------|-------------|
| **Orders** | `approve_orders`, `decline_orders`, `edit_orders`, `cancel_orders`, `assign_department`, `change_priority`, `mark_ready`, `mark_delivered` |
| **Tables** | `open_table`, `close_table`, `merge_tables`, `split_table`, `transfer_table`, `assign_waiter` |
| **Payments** | `accept_payment`, `split_bill`, `issue_refund`, `void_payment`, `discount_bill`, `reopen_invoice` |
| **Menu** | `create_menu`, `edit_menu`, `delete_menu`, `change_price`, `mark_unavailable` |
| **Inventory** | `view_inventory`, `update_inventory`, `adjust_stock`, `manage_suppliers` |
| **Reports** | `view_dashboard`, `view_daily_sales`, `view_monthly_sales`, `view_profit`, `export_reports` |
| **Staff** | `view_staff`, `create_staff`, `edit_staff`, `delete_staff`, `assign_roles`, `reset_password` |
| **Customers** | `view_tracking`, `generate_tracking`, `manage_reservations` |
| **System** | `manage_subscription`, `payment_gateway`, `api_keys`, `restaurant_settings`, `security_settings`, `branding` |

---

## 9. ROLE TEMPLATES (Seed Data)

| Role | Description | Permissions | Count |
|------|-------------|-------------|-------|
| **Owner** | Full access | All 49 | 49 |
| **Manager** | Oversees daily operations | `decline_orders`, `edit_orders`, `mark_ready`, `mark_delivered`, `open_table`, `close_table`, `merge_tables`, `split_table`, `transfer_table`, `assign_waiter`, `accept_payment`, `split_bill`, `discount_bill`, `view_dashboard`, `view_daily_sales`, `view_monthly_sales`, `view_profit`, `view_inventory`, `update_inventory`, `adjust_stock`, `mark_unavailable`, `view_staff`, `view_tracking`, `generate_tracking`, `manage_reservations` | 25 |
| **Supervisor** | Approves orders, kitchen flow | `approve_orders`, `decline_orders`, `assign_department`, `mark_ready`, `mark_delivered`, `view_tracking`, `generate_tracking` | 7 |
| **Waiter** | Takes orders, serves | `open_table`, `accept_payment`, `split_bill`, `view_tracking`, `generate_tracking` | 5 |
| **Chef** | Kitchen prep | `assign_department`, `mark_ready`, `view_tracking` | 3 |
| **Cashier** | Payments | `accept_payment`, `split_bill`, `issue_refund`, `void_payment`, `discount_bill`, `reopen_invoice` | 6 |

---

## 10. PLATFORM AUTHORIZATION

| Platform Role | Scope | Editable by Restaurant? |
|---------------|-------|------------------------|
| `SUPER_ADMIN` | Full ServeIQ platform | ❌ No |
| `SUPPORT` | Customer support access | ❌ No |
| `DEVELOPER` | API/integration access | ❌ No |

**Implementation:** Separate `platformRole` claim in JWT. `PermissionsGuard` bypasses for `SUPER_ADMIN`/`SUPPORT`.

---

## 11. DATA MODEL AUDIT

| Table | Columns | Indexes | Issues |
|-------|---------|---------|--------|
| `permissions` | `id`, `code` (unique), `name`, `description`, `category`, `created_at` | PK on `id`, UK on `code` | ✅ |
| `roles` | `id`, `name`, `description`, `is_system`, `created_at`, `updated_at` | PK on `id` | ✅ |
| `role_permissions` | `role_id`, `permission_id` (PK) | PK on both, indexes on each | ✅ |
| `users` | `role_id` (nullable), `role` (enum) | Index on `role_id` | ⚠️ `role_id` nullable → legacy fallback bypasses PBAC |

### Required Changes
1. **Make `role_id` NOT NULL** for new users (migration + seed)
2. **Backfill `role_id`** for existing users via migration
3. **Remove legacy fallback** in `PermissionsGuard` once backfilled
4. Add `permissions_version` column to `restaurants` table (for cache invalidation)

---

## 12. CACHE STRATEGY & PERMISSION VERSION

### Current
- **Backend:** No cache — `PermissionsGuard` queries DB on every request
- **Frontend:** `PermissionService` caches in signal, loads once on login

### Target
| Layer | Strategy |
|-------|----------|
| **Backend** | In-memory LRU cache (per restaurant) keyed by `restaurantId:roleId:permissionsVersion`. TTL 5min. Invalidated on `restaurant.permissionsVersion` increment. |
| **Frontend** | Signal-based cache. On `403` with version mismatch → reload permissions via `/roles/my-permissions` and retry once. |

### Version Increment Flow
```
Owner changes role permissions via UI
    ↓
API: PUT /roles/:id/permissions
    ↓
Transaction:
  1. Update role_permissions
  2. UPDATE restaurants SET permissions_version = permissions_version + 1 WHERE id = ?
    ↓
Return 200
    ↓
Frontend: Next request → 403 (version mismatch) → Reload permissions → Retry
```

---

## 13. MIGRATION MATRIX

| Status | Item |
|--------|------|
| ⬜ | `PermissionsGuard` — add cache + version check |
| ⬜ | `@RequirePermissions()` decorator — verify usage |
| ⬜ | Controller migration — read-only endpoints first |
| ⬜ | Controller migration — high-risk endpoints (approve/decline/deliver/refund) |
| ⬜ | Route guards — `permissionGuard()` replace `managerOrOwnerGuard` |
| ⬜ | Menu visibility — `*ngIf="perm.can('...')"` |
| ⬜ | Admin UI — Roles & Permissions matrix (checkbox grid) |
| ⬜ | Admin UI — `permissionsVersion` bump on save |
| ⬜ | Remove `RolesGuard` from business endpoints |
| ⬜ | Remove legacy fallback in `PermissionsGuard` |
| ⬜ | Add `permissions_version` to `restaurants` table + migration |
| ⬜ | Backfill `role_id` for existing users + make NOT NULL |
| ⬜ | Regression test suite (see Test Matrix below) |

---

## 14. RISK REPORT

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Legacy fallback bypasses PBAC** | High | Critical | Backfill `role_id` → remove fallback in Sprint 2 |
| **`approve_orders` still on Manager** | Medium | High | Remove from Manager seed + remove from `@Roles()` on approve endpoint |
| **Stale JWT permissions** | Medium | Medium | Implement `permissionsVersion` cache invalidation (Sprint 1) |
| **Frontend permission cache stale** | Medium | Medium | Version check on 403 → reload (Sprint 3) |
| **Legacy users without `role_id`** | High | Critical | Backfill migration before removing fallback |
| **`manage_reservations` placeholder** | Low | Low | Flag in seed; remove if feature not built in 6 months |
| **Frontend role checks in shell** | Medium | Medium | Replace with `perm.can()` in Sprint 4 |
| **Service-level role branches** | Low | Medium | Refactor services to not branch on role; pass permissions if needed |
| **Platform vs Restaurant role confusion** | Low | Medium | Separate `platformRole` claim; bypass PBAC for Platform roles |

---

## 15. AUTHORIZATION TEST MATRIX

| Permission | Endpoint | Expected 200 Roles | Expected 403 Roles |
|------------|----------|-------------------|-------------------|
| `approve_orders` | `POST /orders/:id/approve` | Supervisor, Owner | Manager, Waiter, Supervisor (if removed) |
| `decline_orders` | `POST /orders/:id/decline` | Supervisor, Owner, Manager | Waiter, Chef, Cashier |
| `mark_delivered` | `POST /orders/:id/deliver` | Supervisor, Owner | Manager (if removed), Waiter, Chef |
| `decline_orders` | `POST /orders/:id/decline` | Supervisor, Owner, Manager | Waiter, Chef, Cashier |
| `edit_orders` | `PATCH /orders/:id` | Supervisor, Owner, Manager | Waiter, Chef, Cashier |
| `cancel_orders` | `DELETE /orders/:id` | Supervisor, Owner, Manager | Waiter, Chef, Cashier |
| `mark_ready` | `POST /orders/:id/mark-ready` | Supervisor, Owner, Manager, Waiter | Chef, Cashier |
| `mark_delivered` | `POST /orders/:id/deliver` | Supervisor, Owner | Manager (if removed), Waiter, Chef |
| `issue_refund` | `POST /bills/:id/refund` | Owner | Manager, Supervisor, Waiter |
| `void_payment` | `POST /bills/:id/void` | Owner | Manager, Supervisor, Waiter |
| `discount_bill` | `POST /bills/tab/:tabId/apply-discount` | Owner, Manager, Supervisor | Waiter, Chef, Cashier |
| `create_menu` | `POST /menu-items` | Owner, Manager | Supervisor, Waiter, Chef |
| `edit_menu` | `PATCH /menu-items/:id` | Owner, Manager | Supervisor, Waiter, Chef |
| `delete_menu` | `DELETE /menu-items/:id` | Owner, Manager | Supervisor, Waiter, Chef |
| `mark_unavailable` | `PATCH /menu-items/:id/toggle` | Owner, Manager | Supervisor, Waiter, Chef |
| `create_staff` | `POST /user/waiters` | Owner, Manager | Supervisor, Waiter, Chef |
| `edit_staff` | `PATCH /user/:id` | Owner, Manager | Supervisor, Waiter, Chef |
| `delete_staff` | `DELETE /user/:id` | Owner, Manager | Supervisor, Waiter, Chef |
| `assign_roles` | `PUT /roles/:id/permissions` | Owner | Manager, Supervisor, Waiter |
| `reset_password` | `PATCH /user/waiters/:id/reset-pin` | Owner, Manager | Supervisor, Waiter, Chef |
| `view_dashboard` | `GET /dashboard/branch` | Owner, Manager, Supervisor, Waiter | — |
| `view_daily_sales` | `GET /reports/sales` | Owner, Manager | Supervisor, Waiter |
| `view_monthly_sales` | `GET /reports/sales?monthly` | Owner, Manager | Supervisor, Waiter |
| `view_profit` | `GET /reports/profit` | Owner, Manager | Supervisor, Waiter |
| `view_inventory` | `GET /inventory` | Owner, Manager | Supervisor, Waiter, Chef |
| `update_inventory` | `PATCH /inventory/:id` | Owner, Manager | Supervisor, Waiter, Chef |
| `adjust_stock` | `POST /inventory/reconcile` | Owner, Manager | Supervisor, Waiter, Chef |
| `manage_suppliers` | `POST /suppliers` | Owner, Manager | Supervisor, Waiter, Chef |
| `view_tracking` | `GET /tracking/:code` | Owner, Manager, Supervisor, Waiter, Chef | — |
| `generate_tracking` | `POST /orders/:id/tracking` | Owner, Manager, Supervisor, Waiter | Chef, Cashier |
| `manage_reservations` | `GET /reservations` | Owner, Manager | Supervisor, Waiter, Chef |

---

## DELIVERABLES (Sprint 1)

| Document | Status |
|----------|--------|
| `AUTHORIZATION_AUDIT.md` | ✅ This document |
| `PERMISSION_CATALOG.md` | ✅ Section 7 |
| `ROLE_TEMPLATES.md` | ✅ Section 9 |
| `AUTHORIZATION_TEST_MATRIX.md` | ✅ Section 15 |
| `PBAC_MIGRATION_MATRIX.md` | ✅ Section 13 |

---

**Next Step:** Begin Sprint 2 — Implement `PermissionsGuard` with cache + version check, add `@RequirePermissions()` to read-only endpoints, write regression tests per Test Matrix.