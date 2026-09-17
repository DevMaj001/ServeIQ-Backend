# ServeIQ — API Architecture
**NestJS REST API | Version 1.0**

---

## Base URL Structure

```
Production:  https://serveiq-backend.onrender.com/api/v1
Development: http://localhost:5000/api/v1
```

All endpoints are versioned (URI versioning). Breaking changes increment the version (`/api/v2/...`).

---

## Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <access_token>
```

**Token Strategy:**
- Access Token: JWT, expires in 15 minutes
- Refresh Token: HTTP-only cookie, expires in 7 days
- On expiry: client silently refreshes using `/auth/refresh`

---

## Auth Endpoints

```
POST   /auth/register          → Register business owner
POST   /auth/login             → Login (returns access + refresh token)
POST   /auth/refresh           → Refresh access token
POST   /auth/logout            → Invalidate refresh token
POST   /auth/forgot-password   → Send reset email
POST   /auth/reset-password    → Reset password with token
POST   /auth/verify-email      → Verify email with OTP/link
```

---

## Business Endpoints

```
POST   /businesses             → Create business (owner only)
GET    /businesses/:id         → Get business details
PATCH  /businesses/:id         → Update business
GET    /businesses/:id/stats   → Business overview stats (owner)
```

---

## Branch Endpoints

```
POST   /branches               → Create branch
GET    /branches               → List branches (scoped to business)
GET    /branches/:id           → Get branch details
PATCH  /branches/:id           → Update branch
DELETE /branches/:id           → Soft delete branch
```

---

## User Management Endpoints

```
POST   /users/invite           → Invite staff member (owner/manager)
GET    /users                  → List users (scoped to branch/business)
GET    /users/:id              → Get user profile
PATCH  /users/:id              → Update user
PATCH  /users/:id/deactivate   → Deactivate user
GET    /users/me               → Get own profile
PATCH  /users/me               → Update own profile
```

---

## Table Endpoints

```
POST   /tables                 → Create table
GET    /tables                 → List tables for branch
GET    /tables/:id             → Get table with active tab
PATCH  /tables/:id             → Update table
PATCH  /tables/:id/status      → Update table status
DELETE /tables/:id             → Soft delete table
```

---

## Menu Item Endpoints

```
POST   /menu-items             → Create menu item
GET    /menu-items             → List items (filterable by category, available)
GET    /menu-items/:id         → Get menu item
PATCH  /menu-items/:id         → Update item
PATCH  /menu-items/:id/toggle  → Toggle availability
DELETE /menu-items/:id         → Soft delete item
```

---

## Tab Endpoints

```
POST   /tabs                   → Open new tab
GET    /tabs                   → List tabs (filterable by status, waiter, date)
GET    /tabs/:id               → Get tab with all orders
PATCH  /tabs/:id               → Update tab (notes, customer name, party size)
POST   /tabs/:id/void          → Void tab (manager only, with reason)
GET    /tabs/active            → All currently open tabs in branch
```

---

## Order Endpoints

```
POST   /tabs/:tabId/orders     → Add order(s) to tab
GET    /tabs/:tabId/orders     → Get all orders on tab
PATCH  /orders/:id             → Update order quantity (only while tab is open)
DELETE /orders/:id             → Remove order item (only while tab is open, manager audit)
```

**Add Order Request Body:**
```json
{
  "items": [
    {
      "menu_item_id": "uuid",
      "quantity": 3
    },
    {
      "menu_item_id": "uuid",
      "quantity": 1
    }
  ],
  "round_number": 1,
  "voice_transcription": "optional raw transcription text"
}
```

---

## Billing Endpoints

```
POST   /tabs/:tabId/bill       → Generate bill for tab
GET    /tabs/:tabId/bill       → Get generated bill
POST   /bills/:id/pay          → Mark bill as paid
GET    /bills/:id/receipt      → Download receipt PDF
```

**Generate Bill Request Body:**
```json
{
  "service_charge_percent": 10,
  "discount_kobo": 0
}
```

**Mark Paid Request Body:**
```json
{
  "payment_method": "cash",
  "payment_reference": null
}
```

---

## Dashboard & Reports Endpoints

```
GET    /dashboard/branch       → Branch overview (tables, active tabs, today's sales)
GET    /dashboard/waiters      → Waiter performance summary
GET    /reports/sales          → Sales report (filterable: date_from, date_to, waiter_id)
GET    /reports/items          → Top items report
GET    /reports/export         → Export sales report as PDF
```

---

## Reservation Endpoints

```
GET    /reservations/availability          → Available time slots for a date + party size (public)
POST   /reservations/book                  → Book a table with confirmation code (public)
GET    /reservations/confirm/:code         → Confirm reservation by code (public)
POST   /reservations/cancel/:code          → Cancel reservation by code with reason (public)
GET    /reservations/lookup/:code          → Look up reservation by code (public)
GET    /reservations                       → List reservations (branch filters, status, search)
GET    /reservations/today                 → Today's reservations summary for branch
PATCH  /reservations/:id                   → Update reservation (time, party size, status, reason)
POST   /reservations/walkin                → Create a walk-in reservation and seat the party
PATCH  /reservations/:id/seat              → Seat a confirmed reservation and open a tab
POST   /reservations/reminders/send        → Dispatch reservation reminders (date_range optional)
```

---

## Rider Endpoints

```
GET    /riders                             → List delivery riders for business (branch filter)
POST   /riders                             → Create rider (creates a rider user account with PIN login)
PATCH  /riders/:id                         → Update rider (branch, vehicle, active, online)
DELETE /riders/:id                         → Remove a rider
POST   /riders/me/toggle-online            → Toggle current rider online availability
```

---

## Delivery & Payout Endpoints

```
GET    /deliveries                         → List deliveries for branch (status filter)
GET    /deliveries/available               → Rider: available + my deliveries
GET    /deliveries/mine                    → Rider: my accepted/ongoing deliveries
POST   /deliveries/:id/accept              → Rider: accept available delivery (first-accept wins)
POST   /deliveries/:id/delivered           → Rider: mark delivery handed over
POST   /deliveries/:id/reassign            → Manager: reassign undelivered delivery
GET    /deliveries/payouts/pending         → Pending payout summary by branch
GET    /deliveries/payout-batches          → All payout batches for business
GET    /deliveries/riders/:riderId/payouts/pending   → Pending payout details for a rider
GET    /deliveries/riders/:riderId/ledger             → Earnings/payout ledger for a rider
GET    /deliveries/riders/:riderId/payout-batches     → Payout batch history for a rider
POST   /deliveries/riders/:riderId/payout             → Process rider payout (provider, providerBatchId)
POST   /deliveries/payout-batches/:batchId/complete   → Mark payout batch completed
POST   /deliveries/payout-batches/:batchId/fail       → Mark payout batch failed (reason)
```

---

## Response Format

All responses follow this envelope:

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 150
  }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "TAB_ALREADY_OPEN",
    "message": "This table already has an open tab.",
    "details": null
  }
}
```

---

## Error Codes Reference

| Code | HTTP Status | Description |
|---|---|---|
| UNAUTHORIZED | 401 | Token missing or invalid |
| FORBIDDEN | 403 | Role not permitted for this action |
| NOT_FOUND | 404 | Resource not found |
| TAB_ALREADY_OPEN | 409 | Table already has an active tab |
| TAB_NOT_OPEN | 400 | Cannot add orders to a closed tab |
| BILL_ALREADY_GENERATED | 409 | Bill already exists for this tab |
| ITEM_UNAVAILABLE | 400 | Menu item is marked unavailable |
| INVALID_QUANTITY | 400 | Quantity must be greater than 0 |
| PAYMENT_ALREADY_RECORDED | 409 | This bill is already marked as paid |

---

## Rate Limiting

- Public endpoints: 20 requests/minute
- Authenticated endpoints: 200 requests/minute
- Report endpoints: 30 requests/minute
- Rate limit exceeded returns HTTP 429

---

## NestJS Module Structure

```
src/
├── auth/
├── business/          (businesses, branches, settings, feature flags)
├── menu/              (menu items, categories, modifiers)
├── table/
├── tab/
├── order/
├── bill/
├── department/
├── subscription/
├── ingredient/        (inventory, restock, stock-variance)
├── supplier/
├── unit/
├── shift/
├── role/              (roles + permissions)
├── notification/
├── printer/           (printers + KDS)
├── pos-terminal/
├── dashboard/
├── report/
├── audit-log/
├── advertisement/
├── ai/
├── tracking/
├── upload/
├── sync/
├── admin/
├── waiter-call/
├── reservations/
├── rider/
├── delivery/
├── public/            (payments, customer self-service)
├── device/
├── feedback/
├── review/
├── health/
├── gateway/           (Socket.IO, no REST)
├── common/
│   ├── guards/
│   ├── interceptors/
│   ├── decorators/
│   ├── filters/
│   └── pipes/
└── database/
    └── migrations/
```

---

## Guards & Decorators

```typescript
// Role guard usage
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('manager', 'owner')
@Get('reports/sales')
getSalesReport() {}

// Branch scope injection
@UseGuards(JwtAuthGuard, BranchScopeGuard)
@Get('tabs')
listTabs(@BranchId() branchId: string) {}
```

Every controller that deals with branch data uses `BranchScopeGuard` to ensure the authenticated user belongs to the branch being queried. This is non-negotiable.
