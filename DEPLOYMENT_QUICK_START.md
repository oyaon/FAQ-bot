# 🚀 Render Deployment Quick Start

**Your FAQ bot is ready for production on Render.**

---

## ✅ Pre-Deployment Checklist

- [x] Code pushed to GitHub (`oyaon/FAQ-bot`)
- [x] Build verified locally (`npm run build` passing)
- [x] All 5 features implemented:
  - ✅ API Key Authentication
  - ✅ Rate Limiting
  - ✅ Pagination
  - ✅ Chat with Memory
  - ✅ Category Analytics

---

## 📝 Environment Variables You'll Need

**Complete the [ENV_VARIABLES_CHECKLIST.md](ENV_VARIABLES_CHECKLIST.md) first** to gather:

1. `SUPABASE_URL` - Get from Supabase dashboard
2. `SUPABASE_ANON_KEY` - Get from Supabase dashboard
3. `GEMINI_API_KEY` - Get from Google AI Studio
4. `GOOGLE_API_KEY` - Get from Google Cloud Console
5. `ADMIN_API_KEY` - Generate yourself (min 32 chars, random)

---

## 🎯 Deploy in 5 Steps

### Step 1: Go to Render
Visit [render.com](https://render.com) and log in (or sign up with GitHub)

### Step 2: Create Web Service
- Click "New +" (top-right)
- Select "Web Service"
- Connect your GitHub repository: `oyaon/FAQ-bot`

### Step 3: Configure Service
Fill in the form:

| Field | Value |
|-------|-------|
| Name | `faq-bot` |
| Environment | `Node` |
| Region | `Oregon (us-west)` or closest |
| Branch | `main` |
| Build Command | `npm install && npm run build` |
| Start Command | `npm run start:prod` |

### Step 4: Add Environment Variables
Click "Add Environment Variable" and add (one by one):

```
SUPABASE_URL = [your value from checklist]
SUPABASE_ANON_KEY = [your value from checklist]
GEMINI_API_KEY = [your value from checklist]
GOOGLE_API_KEY = [your value from checklist]
ADMIN_API_KEY = [your value from checklist]
NODE_ENV = production
PORT = 3000
```

### Step 5: Deploy
- Choose a plan (Free works for testing)
- Click "Create Web Service"
- Wait 2-5 minutes for build and deployment
- Watch logs in real-time

---

## ✅ After Deployment

Once you see "Live" status, test your endpoints:

### Health Check
```bash
curl https://faq-bot.onrender.com/health
# Should return: {"status":"ok"}
```

### Admin Authentication
```bash
# Without key (should fail)
curl https://faq-bot.onrender.com/admin/dashboard
# Should return: 401 Unauthorized

# With key (should work)
curl -H "x-api-key: YOUR_ADMIN_API_KEY" \
  https://faq-bot.onrender.com/admin/dashboard
# Should return: { "totalQueries": 0, ... }
```

### Chat Endpoint
```bash
curl -X POST https://faq-bot.onrender.com/chat \
  -H "Content-Type: application/json" \
  -d '{"userMessage":"What is your return policy?","sessionId":"test-123"}'
# Should return: { "answer": "...", "confidence": 0.X, ... }
```

### Category Analytics
```bash
curl -H "x-api-key: YOUR_ADMIN_API_KEY" \
  https://faq-bot.onrender.com/admin/categories
# Should return: { "categories": [...], "total": X }
```

---

## 🔄 Future Deployments

**Good news:** Render auto-deploys whenever you push to `main` branch!

```bash
# Make changes, commit, push
git add .
git commit -m "Your change description"
git push origin main

# Render automatically redeploys (1-2 minutes)
```

---

## 📚 Full Guides

- **[RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md)** - Complete step-by-step with screenshots
- **[ENV_VARIABLES_CHECKLIST.md](ENV_VARIABLES_CHECKLIST.md)** - Where to get each value
- **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** - Deployment testing & monitoring

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| Build fails | Check Render logs → verify `npm install` and `npm run build` pass locally |
| 401 on admin endpoints | Verify `ADMIN_API_KEY` env var is set correctly in Render |
| Chat returns error | Check `GEMINI_API_KEY` and `SUPABASE_URL` are correct and valid |
| Database connection fails | Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are from correct Supabase project |

---

## 🎉 You're Ready!

Your FAQ bot with all 5 features is production-ready. Follow the 5 steps above to deploy!

**Questions?** Refer to [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) for detailed instructions.

---

**Perfect timing: Your code is committed, build is clean, and deployment guides are ready.** 

→ Start with the [ENV_VARIABLES_CHECKLIST.md](ENV_VARIABLES_CHECKLIST.md) and gather your values, then follow the 5 steps above! 🚀
