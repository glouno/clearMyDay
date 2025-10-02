# Favicon Not Updating on Vercel - Fix Instructions

## Problem
Vercel caches the old `favicon.ico` in build cache, preventing updates from deploying.

---

## Solution: Choose ONE of these methods

### ✅ Method 1: Redeploy Without Build Cache (RECOMMENDED - Fastest)

**Steps:**
1. Go to Vercel Dashboard → Your Project → Deployments
2. Find the latest deployment (at the top)
3. Click the three dots (⋯) menu
4. Click **"Redeploy"**
5. **IMPORTANT:** Uncheck "Use existing Build Cache"
6. Click "Redeploy"

**Time:** 2-3 minutes  
**Result:** Favicon will update immediately

---

### ✅ Method 2: Purge Data Cache (Also Effective)

**Steps:**
1. Go to Vercel Dashboard → Your Project → Settings
2. Navigate to **Data Cache** section
3. Click **"Purge Cache"** button
4. Wait for confirmation
5. Trigger a new deployment (push a commit or click Redeploy)

**Time:** 2-3 minutes  
**Result:** All caches cleared, favicon will update

---

### ✅ Method 3: CLI Force Deploy (If You Prefer Terminal)

**Steps:**
```bash
cd /Users/glouno/sourceCode/RANDOM/clearMyDay/clear-my-day
vercel --force --prod
```

**Requirements:** Vercel CLI installed (`npm i -g vercel`)  
**Time:** 2-3 minutes  
**Result:** Forces rebuild without cache

---

### Method 4: Rename Favicon (If Cache Issues Persist)

This is a workaround if the above methods don't work:

**Steps:**
1. Rename `src/app/favicon.ico` to `src/app/icon.ico`
2. Update code references (Next.js will auto-detect)
3. Commit and push

**Why it works:** New filename bypasses the cache entirely

---

## After Any Method: Clear Browser Cache

Even after Vercel updates, your browser may still show the old favicon:

**Desktop:**
- Chrome/Edge: `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
- Firefox: `Ctrl+Shift+Delete`
- Safari: `Cmd+Option+E`

**Quick test:**
- Open incognito/private browsing window
- Visit your site
- If favicon shows correctly → it's just your browser cache

**Force refresh:**
- Chrome/Edge: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Firefox: `Ctrl+F5`
- Safari: `Cmd+Option+R`

---

## Best Practice Moving Forward

According to Next.js 15 docs, the **optimal approach** is to use file-based icons in `/app`:

### Current Setup (What We Have)
```
src/app/favicon.ico          ✅ Correct location
src/app/layout.tsx           ✅ Metadata configured
```

This is already correct! The issue is purely Vercel's build cache.

---

## Verification Checklist

After redeploying:

- [ ] Visit https://clearmyday.com in incognito/private window
- [ ] Check favicon appears in browser tab
- [ ] Test on mobile device (Safari/Chrome)
- [ ] Check in different browsers
- [ ] Verify on desktop (Chrome, Firefox, Safari)

If favicon still doesn't appear after all this:
- Wait 5-10 minutes for CDN propagation
- Check if `favicon.ico` file size is reasonable (should be ~4KB, not 1MB)
- Verify file exists at `https://clearmyday.com/favicon.ico`

---

## Summary

**RECOMMENDED ACTION:**
1. Go to Vercel Dashboard → Deployments → Latest Deployment → ⋯ → Redeploy
2. **Uncheck** "Use existing Build Cache"
3. Click Redeploy
4. Wait 2-3 minutes
5. Clear browser cache or test in incognito
6. Done! ✅

**Total Time:** 5 minutes
