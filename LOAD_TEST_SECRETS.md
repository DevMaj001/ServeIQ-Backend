# GitHub Secrets Required for Load Test Workflow

Add these in: **GitHub Repository → Settings → Secrets and variables → Actions → New repository secret**

## Required Secrets

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `LOAD_TEST_BUSINESS_CODE` | Business code for test tenant | `DEMO123` |
| `LOAD_TEST_WAITER_PIN` | Waiter PIN for test tenant | `1234` |
| `K6_CLOUD_TOKEN` | (Optional) k6 Cloud token for cloud results | `k6cloud_xxx...` |
| `SLACK_BOT_TOKEN` | (Optional) Slack bot token for failure alerts | `xoxb-xxx...` |
| `SLACK_ALERTS_CHANNEL` | (Optional) Slack channel ID for alerts | `C01234567` |

## Optional: Staging/Production URLs (if different from defaults)

| Secret Name | Default |
|-------------|---------|
| `STAGING_BASE_URL` | `https://serveiq-backend-staging.onrender.com` |
| `PRODUCTION_BASE_URL` | `https://serveiq-backend.onrender.com` |

## Workflow Triggers

1. **Manual**: Actions → Load Test → Run workflow → Choose environment, business code, VUs
2. **Scheduled**: Weekly Sunday 2 AM UTC (staging)
3. **On Deploy**: After "Deploy Backend to Staging" workflow completes

## Local Testing

```bash
# Install k6
brew install k6  # macOS

# Run locally
k6 run \
  -e BASE_URL=https://serveiq-backend.onrender.com \
  -e BUSINESS_CODE=YOUR_CODE \
  -e WAITER_PIN=1234 \
  load-test.js
```

## Thresholds (from MASTER_CHECKLIST.md)

| Metric | Threshold |
|--------|-----------|
| HTTP p95 | < 500ms |
| Failed rate | < 1% |
| Login p95 | < 1000ms |
| Tab open p95 | < 300ms |
| Order add p95 | < 200ms |
| Bill gen p95 | < 500ms |
| Payment p95 | < 300ms |
| Errors rate | < 5% |