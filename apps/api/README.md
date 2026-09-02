# ServeIQ API

> **ServeIQ is a cloud restaurant management and point-of-sale (POS) platform with per-guest split payments, offline-first ordering, table-QR menus, and real-time kitchen and guest tracking.**

This is the NestJS + PostgreSQL API that powers ServeIQ's waiter, admin and customer-facing menu apps.

## Highlights

- Per-guest split settlement (`POST /bills/tab/:tabId/splits/:billId/pay`) with item-level, amount, percentage and "remaining balance" allocations; the tab closes only when the last guest share is paid.
- Offline synchronization gateway (`/sync`) that replays queued order/bill mutations with stable idempotency keys.
- Multi-currency (including NGN) and cash / card / transfer / USSD settlement, POS terminal integration, PDF receipts.
- Real time via Socket.IO: dashboard updates, bill updates, and public `tab:{id}` order-tracking events.
- Role-based access (waiter, supervisor, manager, owner, super admin), branch isolation, audit logs, inventory deduction.

## Setup

```bash
npm install
npm run build -w apps/api
npm run start:dev -w apps/api   # http://localhost:5000
```

Environment: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `PAYSTACK_SECRET_KEY` (see example `.env`).

## API docs

- Production Swagger: `https://serveiq-backend.onrender.com/api/docs`
- Local: `http://localhost:5000/api/docs`

## Tests

```bash
npm run test -w apps/api
```

## Links

Product: [https://serveiq.io](https://serveiq.io) · Contact: [hello@serveiq.io](mailto:hello@serveiq.io)