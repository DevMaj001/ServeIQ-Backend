# Go-Live / Beta Readiness Checklist

> Owner-action items that cannot be completed from the codebase.
> Code-side blockers are tracked in MASTER_CHECKLIST.md.

---

## 1. Render Dashboard (required before beta traffic)

- [ ] **Set `ENCRYPTION_KEY`** on the `serveiq-api` service.
      Use the current `JWT_SECRET` value exactly once so existing ciphertext stays decryptable. Boot fail-fast refuses to start without it.
- [ ] **Apply the blueprint changes** (`render.yaml`):
      - Web service: free → **starter** (free tier sleeps = ~60s cold starts mid-service)
      - Postgres: free → **basic-256mb** (free tier suspends after inactivity)
      - Requires billing method on file; plan changes apply on next deploy.
- [ ] Confirm `DATABASE_URL`, `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_SECRET_KEY`, `NEMOTRON_API_KEY` are set in the dashboard (`sync: false` values).
- [ ] After deploy: hit `GET /api/v1/health` and confirm boot logs show migrations ran clean.

## 2. Rotate Exposed Credentials (mandatory — they are in git history)

The old Supabase DB password and NVIDIA API key were committed historically
(scrubbed from HEAD by `d409d07`, but history retains them):

- [ ] Rotate the **Supabase database password** (Supabase dashboard → Settings → Database).
      Update it anywhere still referenced: local `apps/api/.env`, Render env vars.
- [ ] Rotate the **NVIDIA (Nemotron) API key** → new value into Render's `NEMOTRON_API_KEY`.
- [ ] Optional hygiene: purge the secrets from git history (git-filter-repo + force push) — rotation alone already makes the leaked values useless.

## 3. Payments

- [ ] Switch Paystack keys from test to **production** on Render.
- [ ] Point the Paystack webhook URL at the prod endpoint and confirm a live charge fires the webhook.
- [ ] Verify signature enforcement: simulate-bypass is hard-disabled in production — confirm no `x-simulate` header is honored in prod logs.

## 4. Smoke Test After Deploy

- [ ] Register a throwaway business end-to-end (register → tables → menu → tab → order → bill → pay → receipt).
- [ ] Confirm Socket.io realtime updates reach the admin dashboard.
- [ ] Trigger a Sentry test event; confirm it lands in the dashboard.
- [ ] Check error rate and p95 latency in Render metrics after one busy evening.

## 5. Beta Onboarding (per business)

- [ ] Run base seed + demo history on staging for demos:
      `npm run seed -w apps/api && npm run seed:demo-history -w apps/api`
- [ ] Hand each owner the ONBOARDING_GUIDE.md; print WAITER_QUICK_START.md per floor staff.
- [ ] Schedule weekly feedback calls; triage P0/P1 within 24h.
