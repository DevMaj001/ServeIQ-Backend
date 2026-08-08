# Operational Deployment Guide

## 1. PBAC Migrations on Production

### Prerequisites
- Render CLI installed: `npm i -g @render/cli`
- Authenticated: `render login`

### Steps

```bash
# 1. SSH into Render shell or use CLI
render shell serveiq-api

# 2. Run backfill migration FIRST
cd apps/api
npm run migration:run -- -d src/database/data-source.ts

# Verify backfill succeeded (check logs for "SUCCESS: All users now have role_id populated")

# 3. Run NOT NULL constraint migration
npm run migration:run -- -d src/database/data-source.ts

# Verify: "SUCCESS: users.role_id is now NOT NULL"
```

### Migration Order (Critical!)
1. `1752892800000-BackfillUserRoleId` — Populates `role_id` from legacy `role` column
2. `1752892800001-MakeUserRoleIdNotNull` — Enforces NOT NULL constraint

**DO NOT** run #2 before #1 completes successfully.

### Rollback Plan
If backfill fails:
```bash
# Check remaining NULL users
npm run typeorm query "SELECT id, email, role FROM users WHERE role_id IS NULL" -d src/database/data-source.ts

# Fix manually, then re-run backfill
```

---

## 2. Frontend Production Build

### Repository: `DennisMajestie/serveIQ`

```bash
# Clone if needed
git clone https://github.com/DennisMajestie/serveIQ.git
cd serveIQ

# Install dependencies
npm ci

# Build for production
npm run build

# Deploy to Vercel
npx vercel --prod

# Or if using Vercel CLI with project linked
vercel --prod
```

### Required Environment Variables (Vercel Dashboard)
```
NEXT_PUBLIC_API_URL=https://serveiq-backend.onrender.com/api/v1
NEXT_PUBLIC_WS_URL=wss://serveiq-backend.onrender.com/realtime
```

---

## 3. Load Testing (100 Concurrent Waiters)

### Using k6

```bash
# Install k6
brew install k6  # macOS
# or: https://k6.io/docs/getting-started/installation/

# Run load test
k6 run \
  -e BASE_URL=https://serveiq-backend.onrender.com \
  -e BUSINESS_CODE=YOUR_BUSINESS_CODE \
  -e WAITER_PIN=1234 \
  load-test.js

# With detailed output
k6 run \
  --out json=results.json \
  --summary-export=summary.json \
  -e BASE_URL=https://serveiq-backend.onrender.com \
  -e BUSINESS_CODE=YOUR_BUSINESS_CODE \
  -e WAITER_PIN=1234 \
  load-test.js
```

### Expected Thresholds (from MASTER_CHECKLIST.md)
| Metric | Target |
|--------|--------|
| p95 API response | < 500ms |
| Error rate | < 1% |
| Login p95 | < 1s |
| Open tab p95 | < 300ms |
| Add order p95 | < 200ms |
| Generate bill p95 | < 500ms |
| Process payment p95 | < 300ms |

### CI/CD Integration (GitHub Actions)
```yaml
# .github/workflows/load-test.yml
name: Load Test
on:
  workflow_dispatch:
  schedule:
    - cron: '0 2 * * 0'  # Weekly Sunday 2AM
jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run k6
        uses: grafana/k6-action@v0.2.0
        with:
          filename: load-test.js
          env: |
            BASE_URL=https://serveiq-backend.onrender.com
            BUSINESS_CODE=${{ secrets.LOAD_TEST_BUSINESS_CODE }}
            WAITER_PIN=${{ secrets.LOAD_TEST_WAITER_PIN }}
```

---

## 4. Beta Onboarding (3 Businesses)

### Pre-requisites
- [ ] Production API deployed and healthy
- [ ] Frontend deployed to Vercel
- [ ] PBAC migrations run
- [ ] Load test passing
- [ ] Sentry/error tracking configured

### Per-Business Checklist

#### Business 1: Abuja Bar/Lounge
- [ ] Owner registration via frontend
- [ ] Branch + tables setup (onboarding wizard)
- [ ] Menu entry (min 20 items)
- [ ] Staff invites (2 waiters, 1 supervisor)
- [ ] Test full flow: open tab → add orders → bill → pay → receipt
- [ ] Verify real-time dashboard updates
- [ ] Verify offline sync (airplane mode test)
- [ ] Weekly feedback call scheduled

#### Business 2: Lagos Nightclub
- [ ] Same as Business 1
- [ ] Test high-volume scenario (multiple simultaneous tabs)
- [ ] Test table transfer flow
- [ ] Test split bill functionality

#### Business 3: Hotel Restaurant
- [ ] Same as Business 1
- [ ] Test takeaway flow (virtual counter)
- [ ] Test multi-shift operations
- [ ] Verify receipt printing (Bluetooth thermal)

### Monitoring During Beta
- [ ] Sentry error rate < 0.1%
- [ ] API p95 latency < 500ms
- [ ] Zero billing calculation errors
- [ ] Zero cross-business data leaks
- [ ] Offline sync success rate > 99%

### Go/No-Go Criteria for Public Launch
| Criteria | Threshold |
|----------|-----------|
| Billing accuracy | 100% (automated test suite) |
| Security tests | 0 cross-business leaks |
| Critical PRD criteria | All checked |
| Android 8+ / iOS 14+ | Verified on 5+ devices |
| Offline sync | Tested with airplane mode |
| Receipt rendering | 5 screen sizes verified |
| 30-day trial logic | Active and tested |

---

## Quick Commands Reference

```bash
# Backend health
curl https://serveiq-backend.onrender.com/health

# API docs
open https://serveiq-backend.onrender.com/api/docs

# View Render logs
render logs serveiq-api --tail

# Run specific migration
cd apps/api && npm run typeorm migration:run -- -d src/database/data-source.ts

# Seed demo data
cd apps/api && npm run seed

# Check migration status
cd apps/api && npm run typeorm migration:show -- -d src/database/data-source.ts
```