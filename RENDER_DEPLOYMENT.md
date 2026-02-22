# Render Deployment Guide - Step-by-Step

## Overview
Your FAQ bot is ready for production. Render is the recommended platform—it auto-deploys from GitHub and has excellent Node.js support.

---

## Prerequisites ✅

- ✅ Code pushed to GitHub (`oyaon/FAQ-bot` on `main` branch)
- ✅ Build verified locally (`npm run build` passes)
- ✅ All environment variables identified

---

## Step 1: Create Render Account & Connect GitHub

1. Go to **[render.com](https://render.com)**
2. Click **"Sign Up"** (or login if you have an account)
3. Choose **"Sign up with GitHub"** for easiest setup
4. Authorize Render to access your GitHub account
5. Select repository access: Choose **"Only select repositories"** → Select **`oyaon/FAQ-bot`**

---

## Step 2: Create a New Web Service

1. From Render dashboard, click **"New +"** (top-right)
2. Select **"Web Service"**
3. Select your repository: **`oyaon/FAQ-bot`**
4. Click **"Connect"**

---

## Step 3: Configure Build & Deploy Settings

Fill in the form with these exact values:

| Field | Value |
|-------|-------|
| **Name** | `faq-bot` |
| **Environment** | `Node` |
| **Region** | `Oregon (us-west)` (or closest to you) |
| **Branch** | `main` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run start:prod` |

---

## Step 4: Add Environment Variables

In the same form, scroll to **"Environment Variables"** section.

Click **"Add Environment Variable"** and add these 4 variables:

### Variable 1: SUPABASE_URL
```
Key: SUPABASE_URL
Value: https://your-project-id.supabase.co
```
*(Get from Supabase dashboard: Settings → API → Project URL)*

### Variable 2: SUPABASE_ANON_KEY
```
Key: SUPABASE_ANON_KEY
Value: eyJ0eXAiOiJKV1QiLCJhbGc... (your full anon key)
```
*(Get from Supabase dashboard: Settings → API → anon public key)*

### Variable 3: GEMINI_API_KEY
```
Key: GEMINI_API_KEY
Value: AIzaSy... (your full Gemini API key)
```
*(Get from Google AI Studio or Google Cloud Console)*

### Variable 4: GOOGLE_API_KEY
```
Key: GOOGLE_API_KEY
Value: AIzaSy... (same or different Google API key)
```
*(Get from Google Cloud Console)*

### Variable 5: ADMIN_API_KEY
```
Key: ADMIN_API_KEY
Value: your_super_secret_key_min_32_characters_long_random_string_with_letters_numbers_and_symbols
```
*(Generate a strong random key for admin authentication)*

### Optional Variables:

```
Key: NODE_ENV
Value: production
```

```
Key: PORT
Value: 3000
```

---

## Step 5: Review & Deploy

1. Scroll to the bottom of the form
2. Choose a plan: **Free** plan works for testing, **Paid** for production
3. Click **"Create Web Service"**
4. Render will automatically:
   - Build your project
   - Install dependencies
   - Run tests
   - Deploy to production
   
   **This takes 2-5 minutes.** You can watch the logs in real-time.

---

## Step 6: Verify Production Deployment

Once deployment completes, you'll see a URL like:
```
https://faq-bot.onrender.com
```

### Test Health Endpoint
```bash
curl https://faq-bot.onrender.com/health
# Expected response: {"status":"ok"}
```

### Test API Key Authentication
```bash
# Without API key (should fail with 401)
curl https://faq-bot.onrender.com/admin/dashboard
# Expected: 401 Unauthorized

# With valid API key (should work)
curl -H "x-api-key: YOUR_ADMIN_API_KEY" https://faq-bot.onrender.com/admin/dashboard
# Expected: { "totalQueries": 0, "averageSimilarity": 0, ... }
```

### Test Chat Endpoint
```bash
curl -X POST https://faq-bot.onrender.com/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userMessage": "What is your return policy?",
    "sessionId": "test-session-123"
  }'
# Expected response with answer, confidence, etc.
```

### Test Category Analytics
```bash
curl -H "x-api-key: YOUR_ADMIN_API_KEY" \
  https://faq-bot.onrender.com/admin/categories
# Expected: { "categories": [...], "total": X }
```

---

## Step 7: Auto-Deployment Setup

Great news! Render auto-deploys whenever you push to the `main` branch in GitHub.

To deploy new changes:
```bash
git add .
git commit -m "Fix: description of changes"
git push origin main
```

Render automatically pulls changes and redeploys (usually within 1-2 minutes).

---

## Common Issues & Fixes

### ❌ Build Fails with "Module not found"
- **Cause**: Dependencies not installed
- **Fix**: View logs in Render dashboard → check `npm install` output
- **Action**: Verify `package.json` has all dependencies listed

### ❌ Returns 401 on Admin Endpoints
- **Cause**: API key header missing or incorrect
- **Fix**: 
  - Verify header is exactly: `x-api-key: YOUR_KEY` (lowercase)
  - Use the exact value from your `ADMIN_API_KEY` env var

### ❌ Chat Returns Error About Gemini
- **Cause**: `GEMINI_API_KEY` not set or invalid
- **Fix**: 
  - Verify key is set in Render environment variables
  - Regenerate key in Google Cloud Console
  - Re-deploy: Click "Manual Deploy" in Render dashboard

### ❌ Database Queries Time Out
- **Cause**: Supabase query taking too long or connection issue
- **Fix**:
  - Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct
  - Check Supabase database is running
  - View Render logs for SQL error details

### ❌ "Port already in use" Error
- **Cause**: Process already running on port 3000
- **Fix**: Automatic on Render (ignore this for cloud deployment)

---

## Post-Deployment Checklist

After deployment succeeds, verify:

- [ ] Health check returns 200: `curl https://your-domain.com/health`
- [ ] Admin endpoints require API key:
  - [ ] `curl https://your-domain.com/admin/dashboard` returns 401
  - [ ] `curl -H "x-api-key: KEY" https://your-domain.com/admin/dashboard` returns 200
- [ ] Chat works: `POST /chat` with valid message returns answer
- [ ] Category analytics work: `GET /admin/categories` returns category breakdown
- [ ] Rate limiting works (test with rapid requests)
- [ ] No errors in Render logs

---

## Monitoring & Logs

### View Live Logs
In Render dashboard → Your service → **"Logs"**

You'll see:
- Build logs (npm install, tsc compilation)
- Runtime logs (server startup, request handling)
- Errors (if any)

**Pro tip**: Filter by "Error" to quickly find issues

### Enable Email Alerts (Optional)
Settings → Notifications → Add notification email
(Get alerted if service crashes or deploys fail)

---

## Redeploy / Restart Service

If you need to redeploy without code changes:

1. Go to Render dashboard
2. Click your service (`faq-bot`)
3. Click **"Manual Deploy"** → "Deploy latest"
4. Render redeploys within 1-2 minutes

---

## Custom Domain (Optional)

To use your own domain (e.g., `api.example.com`):

1. In Render service settings, find **"Custom Domain"**
2. Enter your domain: `api.example.com`
3. Render provides CNAME record to add to your DNS
4. Add CNAME to your domain registrar's DNS settings
5. Wait ~5-10 minutes for DNS to propagate
6. Service now accessible at `https://api.example.com`

---

## Environment Variables Reference

| Variable | Where to Get It | Example |
|----------|-----------------|---------|
| `SUPABASE_URL` | Supabase dashboard → Settings → API | `https://abc123.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase dashboard → Settings → API | `eyJ0eXAiOiJKV1QiLCJhbGc...` |
| `GEMINI_API_KEY` | Google AI Studio or Google Cloud Console | `AIzaSy...` |
| `GOOGLE_API_KEY` | Google Cloud Console | `AIzaSy...` |
| `ADMIN_API_KEY` | Generate yourself (random, min 32 chars) | `your-secret-key-here-min-32-chars` |
| `NODE_ENV` | Hardcode for app | `production` |
| `PORT` | Hardcode for app | `3000` |

---

## Useful Render Links

- **Dashboard**: https://dashboard.render.com
- **Service Status**: https://render-status.com
- **Documentation**: https://render.com/docs
- **Support**: https://render.com/support

---

## Success! 🚀

Once your service shows "Live" in the Render dashboard and health check passes, **your FAQ bot is in production!**

Next steps:
- Share the URL: `https://faq-bot.onrender.com`
- Test all 5 features
- Monitor logs for any issues
- Optional: Set up custom domain

---

**Your production FAQ bot is now live!**

For questions or issues, check Render logs first, then refer to:
- Supabase docs: https://supabase.com/docs
- NestJS docs: https://docs.nestjs.com
- Render docs: https://render.com/docs
