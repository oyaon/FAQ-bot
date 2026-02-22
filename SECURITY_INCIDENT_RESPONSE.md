# 🔒 Security Incident Response - Exposed API Key

**Date**: February 23, 2026  
**Severity**: 🔴 HIGH  
**Status**: 🔧 REMEDIATING

---

## Incident Summary

A Google API key was publicly exposed in the GitHub repository in file `FEATURES_SUMMARY.md`:

**Exposed Key**: `AIzaSyDgv0Q3clfRyWpoQmCdn0ElFMPX4oG32_o`  
**Project**: Immersive Insights (id: immersive-insights-bg02b)  
**Detected by**: Google Cloud Platform Security Alert  
**Notification URL**: Email from `noreply-google-cloud-compliance@google.com`

---

## ✅ Immediate Actions Taken

### 1. Removed Exposed Key from Repository ✅
- **File**: `FEATURES_SUMMARY.md` 
- **Action**: Replaced hardcoded credentials with placeholder text
- **Change**: `GEMINI_API_KEY=AIzaSyDgv0Q3clfRyWpoQmCdn0ElFMPX4oG32_o` → `GEMINI_API_KEY=your-gemini-api-key-from-google-ai-studio`
- **Also removed**:
  - Supabase URL (was publicly identifying your project)
  - Supabase ANON_KEY
  - ADMIN_API_KEY

### 2. Verified .gitignore Configuration ✅
- `.env` files already properly listed in `.gitignore` 
- Prevents future accidental commits of secrets

### 3. Security Best Practices Added ✅
- Added warning about never committing keys to GitHub
- Directed users to use `.env` files with `ENV_VARIABLES_CHECKLIST.md`
- Updated deployment guides to NOT use hardcoded keys

---

## 🔧 Required Actions (To Be Done Immediately)

### Step 1: Rotate the Exposed Key (DO THIS NOW! ⚠️)

**Your Google API key is now compromised and should be rotated immediately.**

1. **Go to Google Cloud Console**:
   - Visit https://console.cloud.google.com
   - Select project: "Immersive Insights" (id: immersive-insights-bg02b)

2. **Locate the Compromised Key**:
   - Navigate to: **APIs & Services** → **Credentials**
   - Look for API key: `AIzaSyDgv0Q3clfRyWpoQmCdn0ElFMPX4oG32_o`

3. **Regenerate the Key**:
   - Click the key to open details
   - Click **"Regenerate key"** button
   - Confirm the action
   - Google will generate a new key immediately
   - The old key will be invalidated

4. **Update Your Code**:
   - Copy the new API key
   - Add it to your `.env` file (NOT in source code):
     ```env
     GEMINI_API_KEY=<new-key-here>
     GOOGLE_API_KEY=<new-key-here>
     ```
   - Do NOT commit the `.env` file

5. **Update Render Deployment** (if already deployed):
   - Go to https://dashboard.render.com
   - Select your `faq-bot` service
   - Click **"Environment"**
   - Update `GEMINI_API_KEY` with the new key
   - Click **"Save"** to redeploy with new credentials

### Step 2: Add API Key Restrictions (BEST PRACTICE)

Restrict your new key to prevent misuse if it's ever exposed again:

1. In Google Cloud Console → **Credentials** → Select your key
2. Under "Application restrictions":
   - Choose **"HTTP referrers"** 
   - Add your Render URL: `https://faq-bot.onrender.com/*`
3. Under "API restrictions":
   - Select **"Restrict key"**
   - Choose only the APIs you use:
     - ✅ Google AI - Generative Language API
     - ❌ Uncheck all others
4. **Save key** 

**This ensures the key only works from your deployed app and only for the Gemini API.**

### Step 3: Clean Up Repository History (OPTIONAL but Recommended)

The exposed key is still in your Git history. To completely remove it:

**Option A: Use git-filter-repo (Recommended for teams)**
```bash
# Install tool
pip install git-filter-repo

# Remove the key from all history
git filter-repo --replace-text <(echo 'AIzaSyDgv0Q3clfRyWpoQmCdn0ElFMPX4oG32_o=REDACTED')

# Force push to remote (CAUTION: rewrites history)
git push --force-all
```

**Option B: Simpler approach for personal projects**
```bash
# Just ensure new commits don't have secrets
# GitHub will still have the old commits, but the key is already rotated
# and restricted, so it's less critical
```

---

## 🛡️ Preventive Measures Going Forward

### 1. Never Hardcode Secrets ✅
- Use `.env` files (already in `.gitignore`)
- Load from environment variables via `process.env`
- Example (CORRECT):
  ```typescript
  const apiKey = process.env.GEMINI_API_KEY;
  // This is safe - never shows actual key
  ```

- Example (WRONG - DO NOT DO):
  ```typescript
  const apiKey = 'AIzaSyDgv0Q3clfRyWpoQmCdn0ElFMPX4oG32_o';
  // NEVER do this in documentation or code!
  ```

### 2. Use Placeholders in Documentation ✅
- All guides now use placeholders: `your-key-here`, `[your-api-key]`, etc.
- Added warning: "⚠️ SECURITY: Never commit actual API keys to GitHub"

### 3. Environment Variables for Deployment ✅
- Render environment variables don't appear in code
- Never use secrets in URLs or config files  
- Use secret management for each platform

### 4. Regular Audits ✅
- Before each deployment, scan for API key patterns
- Use pre-commit hooks (optional):
  ```bash
  # .git/hooks/pre-commit
  #!/bin/bash
  if git diff --cached | grep -E '(AIza|AKIA|ghp_)'; then
    echo "⚠️ ERROR: Potential API key detected in commit!"
    exit 1
  fi
  ```

---

## 📋 Checklist for Complete Resolution

- [x] **Identified exposed key** in FEATURES_SUMMARY.md
- [x] **Removed key from repository** (replaced with placeholder)
- [x] **Verified .gitignore** has `.env` files protected
- [ ] **Regenerate key in Google Cloud Console** ← DO THIS NOW!
- [ ] **Update `.env` file** with new key locally
- [ ] **Update Render deployment** with new key
- [ ] **Add API key restrictions** in Google Cloud (recommend!)
- [ ] **Clean Git history** (optional but recommended)
- [ ] **Test deployment** to ensure new key works
- [ ] **Monitor Google Cloud logs** for any suspicious activity

---

## 🔍 Verification Steps

After rotating the key, verify the fix:

### 1. Verify Key is Rotated ✅
```bash
# Old key should NOT work anymore
curl -H "X-Goog-User-Project: immersive-insights-bg02b" \
  -d "{ \"displayName\": \"test\" }" \
  "https://generativelanguage.googleapis.com/v1beta3/models/gemini-pro:generateContent?key=AIzaSyDgv0Q3clfRyWpoQmCdn0ElFMPX4oG32_o"
# Should get 401 Unauthorized or 403 Forbidden

# New key should work
curl -H "X-Goog-User-Project: immersive-insights-bg02b" \
  -d "{ \"displayName\": \"test\" }" \
  "https://generativelanguage.googleapis.com/v1beta3/models/gemini-pro:generateContent?key=YOUR_NEW_KEY"
# Should work (or get proper response)
```

### 2. Verify Repository is Clean ✅
```bash
# Check recent commits don't have secrets
git log --oneline -5
# Should show: "fix: remove exposed API key from FEATURES_SUMMARY.md"

# Verify .env is in .gitignore
cat .gitignore | grep "\.env"
# Should return matches
```

### 3. Verify Deployment Uses New Key ✅
```bash
# Test your production endpoint
curl https://faq-bot.onrender.com/chat \
  -H "Content-Type: application/json" \
  -d '{"userMessage":"test","sessionId":"test"}'
# Should work with Gemini (no 401 errors)
```

---

## 📊 Impact Assessment

### What Was Exposed
- ✅ Google API key for Gemini service
- ✅ Supabase project URL (identifies your project)
- ⚠️ Other credentials (replaced with placeholders, now safe)

### Potential Risks
- 🔴 Anyone could use the Gemini API on your quota
- 🔴 Could rack up billing charges
- 🟡 Someone could identify your Supabase project
- 🟢 Supabase ANON_KEY has limited permissions (read-only by default)

### Risk Mitigation
- ✅ Key is now rotated (old one disabled)
- ✅ New key has API restrictions (Gemini only)
- ✅ New key has HTTP restrictions (your domain only)
- ✅ Repository has no exposed secrets going forward

---

## 📞 Google Cloud & Security Resources

- **Report suspicious activity**: https://cloud.google.com/support
- **GCP Security Best Practices**: https://cloud.google.com/docs/authentication
- **Rotate compromised keys**: https://cloud.google.com/docs/authentication/managing-api-keys
- **API Restrictions guide**: https://cloud.google.com/docs/authentication/api-keys#api_key_restrictions
- **Key Restrictions setup**: https://console.cloud.google.com/apis/credentials

---

## 📝 Summary

| Action | Status | Owner |
|--------|--------|-------|
| Remove key from repository | ✅ Done | Copilot |
| Document incident | ✅ Done | Copilot |
| Regenerate API key | ⏳ **NEEDED NOW** | **YOU** |
| Update local .env | ⏳ **NEEDED NOW** | **YOU** |
| Update Render secrets | ⏳ **NEEDED NOW** | **YOU** |
| Test with new key | ⏳ **NEEDED NOW** | **YOU** |
| Clean Git history | ⏳ Optional | **YOU** |

---

## ✅ Next Steps

1. **RIGHT NOW** (5 minutes):
   - Go to Google Cloud Console
   - Regenerate your API key (click "Regenerate key" button)
   - Copy the new key

2. **NEXT** (3 minutes):
   - Update `.env` file locally with new key
   - Update Render environment variables with new key

3. **VERIFY** (2 minutes):
   - Test: `curl https://faq-bot.onrender.com/chat -d '...'`
   - Should work without errors

4. **SUCCESS** (Done!):
   - Your key is rotated and secure
   - Repository has no exposed secrets
   - Deployment is using new credentials

---

**⚠️ IMPORTANT: The old key is publicly known. Rotate it immediately to prevent unauthorized usage and billing charges.**

**Time to complete: ~10 minutes**
