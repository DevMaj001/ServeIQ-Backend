# ServeIQ — Version Roadmap
## V1 through V4: Feature Timeline & Phasing

> **Version:** 1.0  
> **Last Updated:** June 2026

---

## Philosophy

> Build for where you're going. Ship for where you are.

Every version of ServeIQ must:
1. Solve a real, painful problem better than paper
2. Deliver measurable value to the businesses paying for it
3. Lay the architectural groundwork for the next version

---

## Version 1 — Foundation (MVP)

**Theme:** *"Never miscalculate a bill again."*

**Target Users:** Waiters + Business Owners in single-branch bars & lounges

**Core Value Proposition:** A waiter can take orders, track tabs, and generate accurate bills from a phone — no paper, no manual arithmetic, no disputes.

### V1 Features

| Feature | Description | Priority |
|---|---|---|
| Business registration | Admin sets up business, branch, tables, menu | Must Have |
| Waiter authentication | Login via phone/email + password/PIN | Must Have |
| Table management | Visual table grid with status colors | Must Have |
| Open tab | Create a new tab for a table | Must Have |
| Add order items | Search/browse menu, tap to add | Must Have |
| Multiple rounds | Add new order rounds to existing tab | Must Have |
| Running bill view | Real-time itemized bill with total | Must Have |
| Close tab | Record payment method and close | Must Have |
| Receipt generation | PDF receipt on screen + Bluetooth print | Must Have |
| Table transfer | Move tab to a different table | Should Have |
| Admin dashboard | Live sales view + waiter performance | Must Have |
| Offline support | Orders work without internet, sync later | Must Have |
| Void item | Remove item with reason (audit logged) | Must Have |

### V1 Technical Milestones

- [ ] Week 1–2: Backend setup (NestJS + PostgreSQL + Auth)
- [ ] Week 2–3: Core entities (businesses, branches, tables, menu, users)
- [ ] Week 3–4: Tab and order management APIs
- [ ] Week 4–5: Billing and receipt generation
- [ ] Week 5–6: Admin dashboard (Angular)
- [ ] Week 6–8: Waiter mobile app (Ionic)
- [ ] Week 8–9: Offline sync implementation
- [ ] Week 9–10: Testing, QA, bug fixes
- [ ] Week 10–12: Beta with 2–3 real businesses

---

## Version 2 — Operations Depth

**Theme:** *"Complete visibility. Zero leakage."*

**Target Users:** Managers + Cashiers + Business Owners who want full control

**Core Value Proposition:** Management can see and control every naira flowing through the business in real time.

### V2 Features

| Feature | Description |
|---|---|
| Cashier module | Dedicated cashier role for payment verification |
| Split bill | Divide one tab into multiple payment portions |
| Shift management | Open/close shifts, shift-level reporting |
| Payment reconciliation | Cash vs transfer vs POS vs expected totals |
| Inventory module (basic) | Track stock levels, deduct on sale |
| Stock variance report | Expected vs actual stock comparison |
| Supplier records | Basic supplier management |
| Low stock alerts | Notify admin when item stock falls below threshold |
| Waiter performance analytics | Sales, voids, average tab value per waiter |
| Manager dashboard | Enhanced real-time monitoring |
| Item-level void reporting | All voids visible to manager with reasons |
| Menu bulk import | CSV upload for menu items |
| Discount support | Percentage or fixed discount on tab |
| Customer name tagging | Optional name capture on tab for records |

---

## Version 3 — Business Intelligence

**Theme:** *"Know your business better than ever before."*

**Target Users:** Multi-location owners, finance-focused operators

**Core Value Proposition:** Data-driven decisions replace gut feel. The platform pays for itself through insights.

### V3 Features

| Feature | Description |
|---|---|
| Finance module | Expenses, P&L summaries, revenue vs cost |
| Customer profiles | Track repeat customers, spending history |
| Loyalty / points system | Reward repeat customers |
| Advanced analytics | Best sellers, peak hours, day-of-week trends |
| Paystack integration | Direct payment links + auto-verification |
| Flutterwave integration | Alternative payment gateway |
| Webhook payment confirmation | Auto-close tab on payment confirmation |
| Multi-branch UI | View and compare branches from one dashboard |
| Menu performance reports | Revenue and volume per item and category |
| Tax calculation tools | VAT-aware billing |
| Subscription management | Business upgrades plan within platform |

---

## Version 4 — AI & Scale

**Theme:** *"The platform that thinks with you."*

**Target Users:** Enterprise hospitality groups, franchise operators

**Core Value Proposition:** AI prevents problems before they happen. Scale manages itself.

### V4 Features

| Feature | Description |
|---|---|
| Voice order capture | Waiter speaks; system extracts structured order |
| LLM order parsing | Speech → structured items (not just transcription) |
| Fraud / anomaly detection | Flags suspicious patterns for manager review |
| Sales forecasting | Predict busy nights, inventory needs |
| Smart reorder suggestions | Auto-suggest purchase quantities |
| Inventory prediction | Avoid stockouts based on historical data |
| Full multi-branch module | Cross-branch comparison, centralized control |
| Franchise management | White-label support for franchise operators |
| Public API | Third-party integrations (accounting tools, etc.) |
| Custom reporting builder | Drag-and-drop report designer |

---

## Feature Flag Strategy

All future-version features are built with feature flags. This means:

- V2 features are in the codebase with flags disabled
- Beta customers can preview upcoming features
- Features can be rolled out progressively per business

---

## Pricing Model (Draft)

| Plan | Target | Price (₦/month) | Features |
|---|---|---|---|
| Starter | Small bars, <5 tables | ₦10,000 | V1 features, 1 branch, 3 waiters |
| Pro | Growing lounges | ₦25,000 | V1+V2 features, 1 branch, 10 waiters |
| Business | Multi-table, full ops | ₦60,000 | V1+V2+V3, 1 branch, unlimited waiters |
| Enterprise | Multi-branch | Custom | All features, multi-branch, API access |

---

*End of Version Roadmap — ServeIQ*
