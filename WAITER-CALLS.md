# Call Waiter (Buzz-a-Waiter) — Flow Reference

End-to-end reference for the "Call Waiter" feature: how a dine-in guest requests
staff from the public menu, how the backend assigns (or queues) the request, and
how waiters and managers work it to resolution.

---

## 1. Overview

A customer on the **public menu** taps **Call Waiter**. The backend creates a
`WaiterCall`, then either:

- **assigns** it to the least-busy eligible waiter in the branch (status `pending`), or
- **queues** it (status `queued`) when every waiter is at capacity.

The assigned waiter sees it in the **waiter app**, works it through
`Accept → Arrived → Resolve`. Managers can also **Resolve / Cancel / Reassign**
from the **admin** Calls view. All parties are kept in sync via Socket.IO
(real-time) and polling (the customer side polls every 4s, independent of the socket).

---

## 2. Components involved

| Layer        | Location |
|--------------|----------|
| API (NestJS) | `apps/api/src/modules/waiter-call/*` |
| Realtime     | `apps/api/src/modules/gateway/*` (namespace `/realtime`) |
| Shared FE lib| `libs/shared/data-access` → `waiter-calls-api.service.ts`, `realtime-socket.service.ts` |
| Public menu  | `apps/public-menu/src/app/call-waiter/call-waiter.component.ts` |
| Waiter app   | `apps/waiter/src/app/waiter-calls/waiter-calls.component.ts` |
| Admin app    | `apps/admin/src/app/admin/waiter-calls/admin-waiter-calls.component.{ts,html}` |

All routes are mounted under the global prefix `api` + URI version `v1`, so the
full base path is `/api/v1/waiter-calls/...`.

---

## 3. API Reference

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST`   | `/waiter-calls?branchId=…` | **Public** (throttled 10/min) | Customer calls a waiter. Body `{ tableId, customerSessionId? }` |
| `GET`    | `/waiter-calls/:id/status` | **Public** | Poll a call's status |
| `GET`    | `/waiter-calls/table/:tableId` | **Public** | Find the active call for a table |
| `POST`   | `/waiter-calls/table/:tableId/cancel` | **Public** | Customer cancels the active call for a table |
| `GET`    | `/waiter-calls` | `WAITER` | Waiter views their assigned calls (optional `?status=`) |
| `GET`    | `/waiter-calls/workload/me` | `WAITER` | Waiter's active table count vs capacity |
| `POST`   | `/waiter-calls/:id/accept` | `WAITER` | Accept a pending call (→ `accepted`) |
| `POST`   | `/waiter-calls/:id/arrived` | `WAITER` | Mark arrived at table (→ `arrived`) |
| `POST`   | `/waiter-calls/:id/resolve` | `WAITER`,`MANAGER`,`OWNER`,`SUPERVISOR` | Resolve (→ `resolved`) |
| `POST`   | `/waiter-calls/:id/cancel` | `WAITER`,`MANAGER`,`OWNER`,`SUPERVISOR` | Cancel a call (→ `cancelled`) |
| `POST`   | `/waiter-calls/:id/reassign` | `MANAGER`,`OWNER`,`SUPERVISOR` | Reassign to another waiter. Body `{ waiterId }` |
| `GET`    | `/waiter-calls/active` | `MANAGER`,`OWNER`,`SUPERVISOR` | All active (pending/accepted/arrived) calls in branch |
| `GET`    | `/waiter-calls/queue` | `MANAGER`,`OWNER`,`SUPERVISOR` | Queued (FIFO) calls in branch |

`branchId` for the public create endpoint is taken from the `branchId` query
param or the `x-branch-id` header.

---

## 4. State machine

```
                 (capacity available)                 (waiter)
   idle ───────▶ PENDING ───────▶ ACCEPTED ───────▶ ARRIVED ───────▶ RESOLVED ───────▶ idle
     │                │  │                                                                  ▲
     │                │  └──────── (no capacity) ───────▶ QUEUED ──▶ (reassigned) ──────┘
     │                │                                      (becomes PENDING when a
     │                │                                       waiter is freed / reassigned)
     └── customer cancel (public) / staff cancel ─────────────▶ CANCELLED ───────▶ idle
```

- **PENDING** — assigned to a waiter, awaiting their "Accept".
- **ACCEPTED** — waiter acknowledged, en route.
- **ARRIVED** — waiter at the table.
- **RESOLVED** — handled; call closed.
- **QUEUED** — no waiter had capacity at creation time; sits in FIFO until
  reassigned or a waiter becomes free.
- **CANCELLED** — by the customer (public) or staff.

`reassign` resets an active call back to `PENDING` and points it at the new
waiter so they accept it fresh. Resolved/cancelled calls cannot be reassigned.

---

## 5. Customer flow (public menu)

1. The floating **Call Waiter** button renders only for a **dine-in** order that
   has a `tableId` (from the QR / `?table_id=` link).
2. On tap: if `tableId` is unknown the customer is prompted for the table number
   first (`resolveTable`), then `POST /waiter-calls` is called.
3. The returned `id` is stored; the component shows a status panel and **polls
   `/waiter-calls/:id/status` every 4s** (`call-waiter.component.ts`).
4. Status drives the panel copy: `pending`/`queued` → `accepted` → `arrived` →
   `resolved`/`cancelled`.
5. The customer may **cancel** at any time via the public
   `POST /waiter-calls/table/:tableId/cancel`. On `resolved` the panel resets to idle.

> The customer UI does **not** depend on the socket — it polls — so it still
> updates even if the realtime connection drops.

---

## 6. Assignment logic (`createWaiterCall`)

Run inside a transaction for safety:

1. Validate the table exists and is `available` **or** `occupied` in that branch.
2. Reject if the table already has an active (`pending`/`queued`) call.
3. Compute each waiter's load as the count of **open Tabs** assigned to them in
   the branch (`countActiveTablesForWaiter`).
4. Read `max_tables_per_waiter` for the branch (see §9).
5. Build the list of **eligible** waiters: role `waiter`, `is_active`, in the
   branch, with `activeTableCount < max`. Sorted ascending by load (least-loaded first).
6. If at least one eligible waiter exists → assign the least-loaded one,
   status `PENDING`, emit `waiter.request.created` + `waiter.request.assigned`.
   Otherwise → status `QUEUED`, emit `waiter.request.queued`.

Returned payload: `{ id, tableId, status, message, assignedWaiter: { id, name } | null }`.

---

## 7. Waiter flow (waiter app)

- Loads their queue via `GET /waiter-calls` and `GET /waiter-calls/workload/me`.
- For each assigned call, taps **Accept** (`→ accepted`), **Arrived**
  (`→ arrived`), **Resolve** (`→ resolved`). Each transitions emits a realtime event.
- `GET /waiter-calls/active` (manager) and `GET /waiter-calls/queue` power the
  admin queue; waiters only see calls assigned to them.

---

## 8. Manager / Admin flow (admin Calls view)

The admin **Waiter Calls** view lists **Active** and **Queued** calls and lets a
manager act on them:

- **Resolve** → `POST /waiter-calls/:id/resolve`
- **Cancel** → `POST /waiter-calls/:id/cancel`
- **Reassign / Assign to** → opens an inline waiter picker populated from
  `UserApiService.listWaiters()`, then `POST /waiter-calls/:id/reassign`
  with `{ waiterId }`. The call resets to `PENDING` under the new waiter.

The backend validates the reassigned waiter is in the **same branch** with role
`waiter`/`supervisor`; cross-branch or non-waiter targets are rejected.

---

## 9. Configuration

`max_tables_per_waiter` lives on `branch.settings` (JSONB). It is read by
`getMaxTablesPerWaiter` and defaults to **5** (`MAX_WAITER_CAPACITY`) when unset
or invalid. It is updated via the `BranchWaiterSettingsDto` settings endpoint.

---

## 10. Real-time events

Socket.IO namespace: **`/realtime`** (client connects with `io(apiUrl + '/realtime', { auth: { token } })`).

Rooms (per branch):
- `branch:${branchId}`
- `managers:${branchId}`
- `tables:${tableId}`

Events (emitted via `realtimeService.emitWaiterCall`):
`waiter.request.created`, `.assigned`, `.queued`, `.accepted`, `.arrived`,
`.resolved`, `.cancelled`.

Payload shape: `{ id, tableId, status, assignedWaiterId }`.

---

## 11. Data model — `WaiterCall`

Key columns: `id`, `branch_id`, `table_id`, `assigned_waiter_id`, `status`
(enum: `pending|accepted|arrived|resolved|cancelled|queued`), `customer_session_id`,
`created_at`, `accepted_at`, `arrived_at`, `resolved_at`, `cancelled_at`,
`deleted_at` (soft-delete).

---

## 12. Error cases

| Condition | Result |
|-----------|--------|
| Table not found / not in branch | `create` throws "Table not found in this branch" |
| Table already has an active call | `create` throws "This table already has an active waiter request" |
| `branchId` missing on public create | `create` throws "branchId is required" |
| Reassign to wrong branch / non-waiter | `reassign` rejects with a clear error |
| Reassign a resolved/cancelled call | `reassign` rejects "This request can no longer be reassigned" |
| Accept a call not assigned to you | `accept` rejects "This waiter call is not assigned to you" |

---

## 13. Frontend file map

- **Shared API client:** `libs/shared/data-access/src/lib/api/waiter-calls-api.service.ts`
  (`callWaiter`, `getStatus`, `getByTable`, `cancelByTable`, `getMyCalls`,
  `getWorkload`, `accept`, `arrived`, `resolve`, `cancel`, `reassign`, `getActive`,
  `getQueue`).
- **Realtime client:** `libs/shared/data-access/src/lib/realtime-socket.service.ts`.
- **Public menu:** `apps/public-menu/src/app/call-waiter/call-waiter.component.ts`.
- **Waiter app:** `apps/waiter/src/app/waiter-calls/waiter-calls.component.ts`.
- **Admin app:** `apps/admin/src/app/admin/waiter-calls/admin-waiter-calls.component.{ts,html}`.
