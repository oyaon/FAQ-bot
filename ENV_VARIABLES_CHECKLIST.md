# Environment Variables Checklist for Render Deployment

**Use this checklist to gather all required values BEFORE starting Render setup.**

---

## 📋 Required Environment Variables

### 1. SUPABASE_URL
**Where to find it:**
- Go to [supabase.com](https://supabase.com)
- Select your project
- Click "Settings" (bottom-left sidebar)
- Click "API"
- Copy "Project URL" (looks like `https://xxxxx.supabase.co`)

**Your value:**
```
SUPABASE_URL = ____________________________________
```

---

### 2. SUPABASE_ANON_KEY
**Where to find it:**
- Same page as above (Settings → API)
- Copy "anon public" key (looks like `eyJ0eXAiOiJKV1QiLCJhbGc...`)
- This is your **anonymous public key** (safe to share in code)

**Your value:**
```
SUPABASE_ANON_KEY = ____________________________________
```

---

### 3. GEMINI_API_KEY
**Where to find it:**
- Go to [aistudio.google.com](https://aistudio.google.com)
- Click "Get API Key" (top-right)
- Create new API key (or use existing one)
- Copy the key (looks like `AIzaSy...`)

**Your value:**
```
GEMINI_API_KEY = ____________________________________
```

---

### 4. GOOGLE_API_KEY (Optional, can be same as GEMINI_API_KEY)
**Where to find it:**
- Go to [console.cloud.google.com](https://console.cloud.google.com)
- Create a new project (if needed)
- Enable "Generative Language API"
- Create API key in "Credentials"
- Copy the key (looks like `AIzaSy...`)

**Your value:**
```
GOOGLE_API_KEY = ____________________________________
```

---

### 5. ADMIN_API_KEY (Generate a strong one yourself!)
**What it is:**
- A secret key for protecting admin endpoints
- Should be long, random, with letters, numbers, and symbols
- Used in header: `-H "x-api-key: YOUR_ADMIN_API_KEY"`

**Generate one:**
- Option 1 (Online): https://www.uuidgenerator.net/ (generate 2-3 times for extra length)
- Option 2 (PowerShell):
  ```powershell
  [Convert]::ToBase64String([System.Guid]::NewGuid().ToByteArray()) -replace '[^a-zA-Z0-9]','x'
  ```
- Option 3 (Simple): Create a strong password, min 32 characters with mix of:
  - Uppercase letters (A-Z)
  - Lowercase letters (a-z)
  - Numbers (0-9)
  - Symbols (!@#$%^&*)

**Example value (do NOT use this one!):**
```
ADMIN_API_KEY = xK9mP2wL7qR5vN8bJ4dF6gH3sZ1tY9o+XmQ7pW2r6E4cV=
```

**Your value (generate a unique one):**
```
ADMIN_API_KEY = ____________________________________
```

---

### 6. ALLOWED_ORIGINS (CORS Security - NEW!)
**What it is:**
- Comma-separated list of allowed origins for CORS (Cross-Origin Resource Sharing)
- Restricts which websites can call your API
- Critical security setting to prevent unauthorized access

**Default value:**
```
ALLOWED_ORIGINS = https://faq-bot-lwt1.onrender.com,http://localhost:3000
```

**Format:**
- Comma-separated URLs (no spaces)
- Include production URL and any development URLs
- Example: `https://your-app.onrender.com,http://localhost:3000,http://localhost:5173`

**Your value:**
```
ALLOWED_ORIGINS = ____________________________________
```

---

## 🔍 Verification Checklist


Before entering into Render, verify each value:

- [ ] `SUPABASE_URL` starts with `https://` and ends with `.supabase.co`
- [ ] `SUPABASE_ANON_KEY` starts with `eyJ` (JWT token)
- [ ] `GEMINI_API_KEY` starts with `AIzaSy`
- [ ] `GOOGLE_API_KEY` starts with `AIzaSy`
- [ ] `ADMIN_API_KEY` is at least 32 characters long
- [ ] `ALLOWED_ORIGINS` includes your production URL (comma-separated, no spaces)
- [ ] All values are copied exactly (no extra spaces)
- [ ] All values are kept private (never commit to Git)


---

## ✅ Ready to Deploy?

Once all values are gathered above, you're ready to:

1. Go to [render.com](https://render.com)
2. Create Web Service
3. Connect GitHub repository (`oyaon/FAQ-bot`)
4. Set build: `npm install && npm run build`
5. Set start: `npm run start:prod`
6. Add these 5 environment variables with your values above
7. Click "Create Web Service"

**Deployment takes 2-5 minutes.** You can watch logs in real-time! 🚀

---

## 🔐 Security Notes

**DO:**
- ✅ Keep `ADMIN_API_KEY` secret (only use in env vars, never in code)
- ✅ Use Render's secure variable storage (not .env files)
- ✅ Rotate `ADMIN_API_KEY` periodically (change it in Render)

**DON'T:**
- ❌ Commit any keys to GitHub
- ❌ Share `ADMIN_API_KEY` with anyone
- ❌ Use simple passwords for `ADMIN_API_KEY`
- ❌ Put keys in README or documentation

---

## 📱 Test Keys After Deployment

Once deployed, test authentication:

```bash
# Without API key (should return 401)
curl https://faq-bot.onrender.com/admin/dashboard

# With API key (should return data)
curl -H "x-api-key: YOUR_ADMIN_API_KEY" https://faq-bot.onrender.com/admin/dashboard
```

If you get `{"status":"ok"}` response, everything is working! ✅

---

## Need Help?

If you can't find a value:

| Provider | Help Document |
|----------|----------------|
| Supabase | https://supabase.com/docs/guides/getting-started/quickstarts/setup |
| Google Gemini | https://ai.google.dev/tutorials/setup |
| Google Cloud Console | https://cloud.google.com/docs/authentication/api-keys |
| Render | https://render.com/docs/environment-variables |

---

**Once all values are ready, you're 100% prepared for deployment!**
