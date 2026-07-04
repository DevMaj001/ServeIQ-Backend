# Frontend Integration Guide — Subscription Billing System

## Overview

A full subscription billing system has been built on the backend. Every branch now **must have an active subscription** (trial, active, or past-due within grace period) to access API endpoints. The guard returns **402 Payment Required** for expired/canceled/missing subscriptions.

---

## New Endpoints

### `GET /api/v1/subscriptions/current`
- **Auth:** JWT (any logged-in user)
- **Purpose:** Fetch the current branch's subscription status for UI display (countdown, banners, upgrade prompt)
- **Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "branch_id": "uuid",
    "plan_id": "uuid | null",
    "status": "trialing | active | past_due | canceled | expired",
    "trial_ends_at": "2026-07-18T07:00:00Z | null",
    "current_period_start": "2026-07-04T07:00:00Z | null",
    "current_period_end": "2026-08-03T07:00:00Z | null",
    "grace_period_ends_at": "2026-07-11T07:00:00Z | null",
    "canceled_at": "2026-07-10T07:00:00Z | null",
    "plan": {
      "id": "uuid",
      "name": "Basic | Pro | Enterprise",
      "price": 2500000,
      "currency": "NGN",
      "billing_interval": "monthly | yearly",
      "features": { "max_tables": 20, "max_waiters": 15, "reporting_enabled": true }
    } | null
  }
}
```

### `POST /api/v1/subscriptions/initialize`
- **Auth:** JWT (owner/manager)
- **Purpose:** Create a Paystack transaction for a chosen plan. Returns a URL the frontend should redirect the user to.
- **Request:**
```json
{ "plan_id": "uuid-of-plan" }
```
- **Response:**
```json
{
  "success": true,
  "data": {
    "authorization_url": "https://checkout.paystack.com/abc123",
    "access_code": "abc123",
    "reference": "some-ref"
  }
}
```
- **Integration flow:** Frontend receives `authorization_url` → redirect user → Paystack handles the payment → Paystack sends webhook → backend activates subscription → frontend polls `GET /current` to see status change

### `POST /api/v1/subscriptions/cancel`
- **Auth:** JWT (owner/manager)
- **Purpose:** Cancel subscription at the end of the current billing period. Access continues until `current_period_end`.
- **Response:** Returns the updated subscription object.

### `POST /api/v1/subscriptions/admin/grant`
- **Auth:** JWT + superadmin role only
- **Purpose:** Force-grant or extend any branch's subscription. Use for manual overrides, extending trials, etc.

---

## Subscription Status Reference

Display these states in the UI:

| Status | Meaning | Frontend Action |
|--------|---------|-----------------|
| `trialing` | 14-day free trial active, `trial_ends_at` shows expiry | Show countdown banner ("14 days left on trial"), show "Choose a plan" CTA |
| `active` | Paid subscription active, `current_period_end` shows renewal | Show "Active" badge, optional renewal date |
| `past_due` | Payment failed, 7-day grace period active, `grace_period_ends_at` shows deadline | Show urgent banner ("Payment failed — 5 days left before lockout"), prompt to retry payment |
| `canceled` | Canceled but still has access until `current_period_end` | Show "Canceled — expires on [date]" message |
| `expired` | No access | Show full-screen lockout with "Subscription required — choose a plan" |

---

## Plans Seeded in Database

| Name | Price (kobo) | Interval | `features` |
|------|-------------|----------|------------|
| Basic | 0 (free tier) | monthly | `{ max_tables: 5, max_waiters: 3, reporting_enabled: false }` |
| Pro | 2,500,000 (₦25,000) | monthly | `{ max_tables: 20, max_waiters: 15, reporting_enabled: true }` |
| Enterprise | 7,500,000 (₦75,000) | monthly | `{ max_tables: 100, max_waiters: 50, reporting_enabled: true }` |

Fetch available plans via the Plan entity (add a `GET /api/v1/plans` endpoint if needed, or hardcode on frontend for now).

---

## Frontend To-Do List

### 1. Read subscription status on every app load
Call `GET /api/v1/subscriptions/current` after login. Store in global state (AuthContext/state management). Use it to:
- Show relevant banner/CTA
- Guard route access (block pages if `expired`)

### 2. Handle 402 globally
On any API call that returns **402**, redirect to a subscription plan selection page. This is the backend's lockout signal.

### 3. Build plan selection screen
- Show the 3 plan tiers with their features
- "Choose Basic" → free, just calls POST initialize with Basic's plan_id
- "Choose Pro/Enterprise" → calls POST initialize → redirects to Paystack checkout URL

### 4. Paystack checkout flow
- User clicks "Choose Pro" → POST initialize → receive `authorization_url`
- `window.location.href = authorization_url` (redirect to Paystack)
- Paystack handles card/bank/USSD payment
- Paystack redirects back to your `callback_url` (configure on Paystack dashboard)
- On return, poll `GET /current` until status changes to `active`
- Show success screen

### 5. Subscription banner component
A reusable banner that reads from `GET /current` and displays:
- Trial countdown ("14 days remaining — choose a plan to keep access")
- Past-due alert ("Payment failed — 7 days before lockout")
- Expired lockout (replace entire page content with plan selection)

### 6. Cancel flow
"Cancel Subscription" button on settings/billing page → calls POST cancel → confirm to user they keep access until period end.

### 7. Route guards
Apply in Angular route config or a wrapper component:
- `expired` status → redirect to `/billing/plans`
- All subscription routes (`/billing/*`) should be accessible regardless of status (backend excludes them from guard)

---

## 402 Error Response Format

```json
{
  "statusCode": 402,
  "message": "Subscription required"
}
```

Intercept this globally in your HTTP client. Do NOT show generic error toasts — redirect to the billing screen.

---

## Role-Based Screen Access

The backend enforces these role checks, but the frontend should also gate UI elements:

| Role | Accessible Screens | Menu Items |
|------|-------------------|------------|
| **Superadmin** | Platform admin panel, all businesses | Users, Businesses, Subscriptions |
| **Owner** | Full app — branches, staff, menu, tables, orders, reports, billing, settings | Waiters, Menu, Tables, Reports, Billing, Settings, Branches |
| **Manager** | Same as owner minus: billing, branches, staff management | Waiters (view only), Menu, Tables, Reports, Dashboard |
| **Waiter** | Own tabs/orders only, no management screens | Home (current tables/tabs) |
| **Cashier** | All open bills, payment recording, receipts | Bills/Payments screen only |

The frontend should add route guards and nav-menu filtering based on `user.role` from the JWT payload (`req.user.role`).

---

## Paystack Setup Required

1. Create an account at https://dashboard.paystack.com
2. Get test keys (sk_test_xxx / pk_test_xxx)
3. Replace `sk_test_REPLACE_ME` / `pk_test_REPLACE_ME` in `apps/api/.env`
4. Create 3 plans (Basic/Pro/Enterprise) on Paystack dashboard
5. Copy the plan codes (PLN_xxx) into the migration file or update via admin endpoint
6. Set your `callback_url` in Paystack dashboard settings
