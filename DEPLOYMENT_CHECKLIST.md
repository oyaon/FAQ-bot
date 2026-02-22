# Production Deployment Checklist

## Pre-Deployment Requirements

### Environment Variables Setup

Create a `.env.production` file (or set these in your deployment platform):

```env
# Supabase Configuration
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...your_anon_key...

# Google Gemini API
GEMINI_API_KEY=AI...your_gemini_api_key...
GOOGLE_API_KEY=AIz...your_google_api_key...

# Admin Authentication
ADMIN_API_KEY=your_long_random_secret_api_key_at_least_32_characters

# Database (auto-managed by Supabase if using SUPABASE_URL)
DATABASE_URL=postgresql://user:password@db.supabase.co:5432/postgres

# Node Environment
NODE_ENV=production

# Optional: Server Port (default 3000)
PORT=3000

# Optional: Rate Limiting Configuration
RATE_LIMIT_MAX=10
RATE_LIMIT_WINDOW_MS=60000

# Optional: Logging
LOG_LEVEL=info
```

### Database Schema Verification Checklist

Before deploying, confirm all database tables exist:

**Run in Supabase SQL Editor:**

```sql
-- Verify all required tables exist
SELECT 
  'sessions' as table_name,
  EXISTS(SELECT FROM information_schema.tables WHERE table_name='sessions') as exists
UNION ALL
SELECT 'faq', EXISTS(SELECT FROM information_schema.tables WHERE table_name='faq')
UNION ALL
SELECT 'query_logs', EXISTS(SELECT FROM information_schema.tables WHERE table_name='query_logs')
UNION ALL
SELECT 'query_log_feedback', EXISTS(SELECT FROM information_schema.tables WHERE table_name='query_log_feedback')
UNION ALL
SELECT 'conversation_messages', EXISTS(SELECT FROM information_schema.tables WHERE table_name='conversation_messages');
```

**All should return `true`.**

Check critical columns:

```sql
-- Verify query_logs has matched_faq_category column
SELECT EXISTS(
  SELECT FROM information_schema.columns 
  WHERE table_name='query_logs' AND column_name='matched_faq_category'
) as has_category_column;
```

**Should return `true`.**

---

## Build & Test Checklist

### Local Testing Before Deployment

- [ ] **Clean Build**: `npm run clean && npm run build`
  - Verify no TypeScript errors
  - Verify dist/ folder created successfully

- [ ] **Run Unit Tests**: `npm test`
  - All `.spec.ts` files should pass
  - Check test output for failures

- [ ] **Run Feature Test Suite**: 
  - PowerShell: `test-features.ps1`
  - Or bash: `bash test-features.sh`
  
  All 5 features should pass:
  - [ ] Authentication (API key required, valid key returns 200)
  - [ ] Rate Limiting (429 after 10 requests in 60s)
  - [ ] Pagination (data + pagination metadata structure)
  - [ ] Chat Memory (session context preserved across messages)
  - [ ] Category Analytics (returns array of { category, count })

- [ ] **Manual Integration Test**:
  ```bash
  npm run build
  npm run start:prod
  # Server should start on http://localhost:3000
  # Health check: curl http://localhost:3000/health
  ```

- [ ] **Database Connectivity Test**:
  ```bash
  curl -H "x-api-key: YOUR_ADMIN_API_KEY" http://localhost:3000/admin/dashboard
  # Should return { totalQueries, averageSimilarity, lowConfidenceRecent }
  ```

---

## Deployment Targets

### Option 1: Render (Recommended for this project)

**Steps:**
1. Push code to GitHub
2. Log in to [render.com](https://render.com)
3. Create New → Web Service
4. Connect GitHub repository
5. Configure:
   - **Name**: `faq-bot`
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start:prod`
   - **Environment Variables**: Add all variables from `.env.production`

6. Deploy

**Health Check URL**: `https://your-service.onrender.com/health`  
**Admin Dashboard**: `https://your-service.onrender.com/admin`

---

### Option 2: Fly.io

**Setup:**
```bash
npm install -g flyctl
flyctl auth login
flyctl launch --name faq-bot
```

**Generated `fly.toml` should look like:**
```toml
app = "faq-bot"
primary_region = "sjc"

[build]
  image = "flyioregistry.com/faq-bot:deployment-xxxxx"

[env]
  NODE_ENV = "production"

[http_service]
  internal_port = 3000
  force_https = true
  auto_start_machines = true
  auto_stop_machines = true

[[services]]
  port = 443
  protocol = "tls"
  handlers = ["http"]
```

**Deploy:**
```bash
flyctl secrets set \
  SUPABASE_URL="xxx" \
  SUPABASE_ANON_KEY="xxx" \
  GEMINI_API_KEY="xxx" \
  ADMIN_API_KEY="xxx"

flyctl deploy
```

---

### Option 3: Railway

**Steps:**
1. Push code to GitHub
2. Log in to [railway.app](https://railway.app)
3. New Project → Deploy from GitHub repo
4. Wait for auto-detection (should find Node.js)
5. Add PostgreSQL plugin (if not using Supabase)
6. Set environment variables in Railway dashboard:
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
   - GEMINI_API_KEY
   - ADMIN_API_KEY
   - NODE_ENV=production

7. Railway auto-deploys on git push

---

### Option 4: Heroku (Legacy but still works)

```bash
npm install -g heroku
heroku login
heroku create faq-bot
heroku config:set SUPABASE_URL=xxx SUPABASE_ANON_KEY=xxx etc.
git push heroku main
heroku open
```

**Note**: Free tier is deprecated (as of Nov 2022), plan accordingly.

---

## Post-Deployment Verification

### 1. Health Check

```bash
curl https://your-domain.com/health
# Expected response: { "status": "ok" }
```

### 2. API Key Authentication Test

```bash
# Without API key (should fail)
curl https://your-domain.com/admin/dashboard
# Expected: 401 Unauthorized

# With valid API key
curl -H "x-api-key: YOUR_ADMIN_API_KEY" https://your-domain.com/admin/dashboard
# Expected: { "totalQueries": X, "averageSimilarity": Y, ... }
```

### 3. Chat Functionality Test

```bash
curl -X POST https://your-domain.com/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userMessage": "What is your return policy?",
    "sessionId": "test-session-123"
  }'
# Should return: { "response": "...", "confidence": 0.X, "sessionId": "..." }
```

### 4. Database Connectivity Test

```bash
curl -H "x-api-key: YOUR_ADMIN_API_KEY" \
  https://your-domain.com/admin/categories
# Should return: { "categories": [...], "total": X }
```

### 5. Rate Limiting Test

```bash
# Make 11 rapid requests
for i in {1..11}; do
  curl -X POST https://your-domain.com/chat \
    -H "Content-Type: application/json" \
    -d '{"userMessage":"test","sessionId":"rate-test"}'
  echo "Request $i"
done
# 11th request should return 429 Too Many Requests
```

---

## Production Environment Configuration

### Recommended Render.com Environment Variables

```
SUPABASE_URL=paste_your_supabase_url_here
SUPABASE_ANON_KEY=paste_your_anon_key_here
GEMINI_API_KEY=paste_your_gemini_key_here
GOOGLE_API_KEY=paste_your_google_key_here
ADMIN_API_KEY=generate_a_strong_random_key_32_chars_minimum
NODE_ENV=production
PORT=3000
```

### Important Security Notes

- **NEVER commit `.env` files to Git**
- **NEVER log API keys in production**
- **Use strong ADMIN_API_KEY** (min 32 characters, mix of alphanumeric + symbols)
- **Enable Row Level Security (RLS)** in Supabase if needed
- **Restrict API key access** in Supabase: use Anon key for public queries, Service Role key only for admin ops
- **Monitor rate limits** in production dashboard
- **Set up error logging** (Sentry, LogRocket, etc.) for production monitoring

---

## Build Commands Reference

| Command | Purpose |
|---------|---------|
| `npm install` | Install dependencies |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Run development server (watches for changes) |
| `npm run start:prod` | Run production-optimized server |
| `npm test` | Run unit tests (Jest) |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run lint` | Run ESLint checks |

---

## Rollback Procedure

**If deployment fails:**

### For Render:
1. Go to Render dashboard
2. Click service → Deployments
3. Select previous successful deployment
4. Click "Redeploy"

### For Fly.io:
```bash
flyctl releases
flyctl rollback <release-id>
```

### For Railway:
1. Go to deployment history
2. Click on previous working deployment
3. Click "Rollback to this deployment"

---

## Monitoring & Logs

### View Deployment Logs

**Render:**
```bash
# Stream logs from Render
render logs --service faq-bot --tail
```

**Fly.io:**
```bash
flyctl logs -a faq-bot
```

**Railway:**
- View in Railway dashboard under Logs tab

### Production Monitoring Checklist

- [ ] Enable error tracking (optional: Sentry.io, LogRocket)
- [ ] Monitor database query performance
- [ ] Set up alerts for:
  - High error rates
  - Database connection failures
  - Rate limit hitting (indicates DDoS or misconfiguration)
  - Response time spikes
- [ ] Regularly audit query logs for suspicious queries
- [ ] Backup database weekly (Supabase does this automatically)

---

## Database Backup Strategy

**Supabase handles automatic backups**, but you can:

```sql
-- Manual point-in-time backup request via Supabase UI
-- Or use pg_dump for local backup:
pg_dump postgresql://user:password@db.supabase.co:5432/postgres > backup.sql
```

---

## Success Criteria Checklist

Before marking as "Production Ready":

- [ ] All 5 feature tests pass locally
- [ ] `npm run build` completes with 0 errors
- [ ] All environment variables are set in deployment platform
- [ ] Health check endpoint responds with 200
- [ ] Admin API key authentication works
- [ ] Chat endpoint returns proper response structure
- [ ] Database queries return expected results
- [ ] Rate limiting triggers after 10 requests/60s
- [ ] Session-based chat memory works (multi-turn context preserved)
- [ ] Category analytics endpoint returns data
- [ ] Error logs are clean (no unhandled exceptions)
- [ ] Performance is acceptable (< 2s response time for chat queries)

---

## Quick Reference: Common Post-Deployment Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| 401 Unauthorized on admin endpoints | Missing or invalid API key | Set `ADMIN_API_KEY` env var, use it in header |
| Chat endpoint returns empty responses | Gemini API not working | Verify `GEMINI_API_KEY` and quota |
| Category analytics returns error | `matched_faq_category` column missing | Run ALTER TABLE SQL from schema guide |
| High latency on chat | Vector search timeout | Increase timeout or check pgvector indexes |
| 502 Bad Gateway | Server crash | Check logs, verify all env vars set |

---

## Post-Deployment Documentation

After successful deployment, document:

1. **Deployment Date**: ___________
2. **Deployment Platform**: ___________
3. **Service URL**: ___________
4. **Admin Dashboard URL**: ___________
5. **Deployment Notes**: ___________

---

**You're now ready to deploy to production! 🚀**

For questions on specific platforms, refer to:
- [Render Docs](https://render.com/docs)
- [Fly.io Docs](https://fly.io/docs)
- [Railway Docs](https://docs.railway.app)
- [Supabase Docs](https://supabase.com/docs)
