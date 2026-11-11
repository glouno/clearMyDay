# Deployment Guide

## Quick Start

### Prerequisites
- Node.js 18+ installed
- Vercel account (for production deployment)
- Supabase project created
- Sorbonne CalDAV credentials

---

## Environment Setup

### Required Environment Variables

Create `.env.local` in `clear-my-day/` directory:

```bash
# CalDAV Credentials (Sorbonne)
CALDAV_USERNAME=student.master
CALDAV_PASSWORD=guest

# Supabase Configuration
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # Optional, for admin operations

# Rate Limiting (Optional)
RATE_LIMIT_REDIS_URL=redis://...  # Falls back to in-memory if not set

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Dev
# NEXT_PUBLIC_APP_URL=https://www.clearmyday.com  # Production
```

### Vercel Environment Variables

Add the same variables in Vercel dashboard:
1. Go to Project Settings → Environment Variables
2. Add all variables from `.env.local`
3. Set `NEXT_PUBLIC_APP_URL` to your production domain

---

## Supabase Setup

### 1. Create Tables

Run these SQL scripts in Supabase SQL Editor (in order):

#### Calendar Tokens & Analyze Events Cache

```sql
-- See: supabase-calendar-tokens-schema.sql
-- Creates: calendar_tokens, analyze_events_cache tables
-- Adds: Indexes, RLS policies, auto-cleanup function
```

#### CalDAV Cache

```sql
-- See: supabase-caldav-cache-schema.sql
-- Creates: caldav_cache table
-- Adds: GIN index on masters, cleanup function
```

### 2. Verify Tables

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('calendar_tokens', 'analyze_events_cache', 'caldav_cache');

-- Should return 3 rows
```

### 3. Test Connection

```bash
cd clear-my-day
npm run dev
# Navigate to http://localhost:3000
# Generate a test calendar
# Check Supabase dashboard for new rows in calendar_tokens
```

---

## Local Development

### Install Dependencies

```bash
cd clear-my-day
npm install
```

### Start Development Server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### Testing

```bash
# Lint code
npm run lint

# Build for production (verifies no errors)
npm run build

# Run tests (if configured)
npm run test
```

### Verify Local Deployment

1. **Generate a test calendar:**
   - Select "DAC" master
   - Choose date range: Sept 1, 2025 - Dec 31, 2025
   - Click "Generate Calendar"

2. **Copy subscription URL**

3. **Subscribe in calendar client:**
   - Apple Calendar: File → New Calendar Subscription
   - Google Calendar: Add calendar by URL
   - Paste: `http://localhost:3000/api/calendar/TOKEN`

4. **Verify:**
   - Events load correctly
   - Holiday weeks appear empty
   - Cancelled events don't appear

---

## Vercel Deployment

### First-Time Setup

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Link project:**
   ```bash
   cd clear-my-day
   vercel link
   ```

3. **Set environment variables:**
   ```bash
   vercel env add CALDAV_USERNAME
   vercel env add CALDAV_PASSWORD
   vercel env add SUPABASE_URL
   vercel env add SUPABASE_ANON_KEY
   vercel env add NEXT_PUBLIC_APP_URL
   ```

### Deploy to Preview

```bash
# Create feature branch
git checkout -b feature/your-feature

# Make changes, commit
git add .
git commit -m "feat: your feature description"

# Push to GitHub
git push origin feature/your-feature
```

Vercel automatically creates preview deployment. Check:
- Vercel dashboard for preview URL
- GitHub PR for deployment status

### Deploy to Production

```bash
# Merge to main branch
git checkout main
git pull
git merge feature/your-feature
git push origin main
```

Vercel automatically deploys to production (typically 2-3 minutes).

### Verify Production Deployment

```bash
# Check health endpoint
curl https://www.clearmyday.com/api/health

# Test calendar endpoint
curl -I https://www.clearmyday.com/api/calendar/YOUR_TOKEN

# Should return 200 OK with Cache-Control headers
```

---

## Deployment Checklist

### Before Deploy

- [ ] All tests pass locally (`npm run build`)
- [ ] Environment variables set in Vercel
- [ ] Supabase tables created
- [ ] Code committed and pushed to GitHub

### After Deploy

- [ ] Health check returns 200 (`/api/health`)
- [ ] Test calendar subscription works
- [ ] Vercel logs show no errors
- [ ] Supabase cache is being populated
- [ ] EXDATE appears in calendar output

---

## Deployment Strategies

### Option A: Browser Testing (Recommended for First Deploy)

1. **Start local dev server**
2. **Test in browser at http://localhost:3000**
3. **Subscribe test calendar**
4. **Verify behavior**
5. **Deploy to production**

### Option B: Preview Deployment

1. **Push to feature branch**
2. **Get preview URL from Vercel**
3. **Test preview URL**
4. **Merge to main if successful**

### Option C: Direct Production

1. **Push to main branch**
2. **Vercel auto-deploys**
3. **Monitor for issues**

**Recommended:** Use Option A or B for significant changes, Option C for minor fixes.

---

## Verification Steps

### Calendar Behavior Checklist

After deploying, verify:

- [ ] **Holiday weeks empty** (e.g., Oct 27-31, 2025)
- [ ] **Cancelled events hidden** (events with "séance annulée")
- [ ] **Rescheduled events appear** on correct dates
- [ ] **Weekly events continue** normally
- [ ] **RRULE preserved** in ICS output
- [ ] **EXDATE present** in ICS output

### Technical Verification

```bash
# Check EXDATE count
curl -fsSL "https://www.clearmyday.com/api/calendar/TOKEN" | grep -c "EXDATE"
# Should return > 0

# Check RRULE format
curl -fsSL "https://www.clearmyday.com/api/calendar/TOKEN" | grep "RRULE"
# Should be single-line: RRULE:FREQ=WEEKLY;...

# Check cache headers
curl -I "https://www.clearmyday.com/api/calendar/TOKEN"
# Should include: Cache-Control: public, max-age=21600
```

---

## Rollback Plan

### If Deployment Has Issues

**Vercel Dashboard Method:**
1. Go to Vercel dashboard
2. Select Deployments tab
3. Find previous working deployment
4. Click "Promote to Production"

**Git Revert Method:**
```bash
git revert HEAD
git push origin main
```

Vercel automatically deploys the reverted code.

---

## Common Deployment Issues

### Build Fails

**Symptoms:** Vercel build fails, red X on deployment

**Solutions:**
```bash
# Test build locally
npm run build

# Check for TypeScript errors
npm run lint

# Verify all imports exist
# Check for missing dependencies
```

### Environment Variables Missing

**Symptoms:** 500 errors, "undefined" in logs

**Solutions:**
1. Check Vercel dashboard → Environment Variables
2. Verify all required variables present
3. Redeploy after adding missing variables

### Supabase Connection Fails

**Symptoms:** Calendars don't save, cache doesn't work

**Solutions:**
1. Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY`
2. Check Supabase project is active
3. Verify tables exist in Supabase
4. Test connection locally first

### CalDAV Fetch Fails

**Symptoms:** No events load, CalDAV errors in logs

**Solutions:**
1. Verify `CALDAV_USERNAME` and `CALDAV_PASSWORD`
2. Check Sorbonne server status
3. Review retry logs (client retries 3x with backoff)
4. Check firewall settings (see `docs/domain-notes.md`)

---

## Post-Deployment

### Monitor Deployment Health

**Vercel Dashboard:**
- CPU usage (target: <15 min/month)
- Error rate
- Response times
- Cache hit/miss ratio

**Supabase Dashboard:**
- Table sizes (caldav_cache should stay small)
- Query performance
- Connection count

**Logs to Watch:**
- `✅ CalDAV cache HIT` (good)
- `❌ CalDAV cache MISS` (expect every 6 hours per master)
- `[CALDAV] Parsing EXDATE for ...` (EXDATE working)
- `[ICS-GEN] Adding EXDATE line` (EXDATE output)

### Synthetic Monitoring (Optional)

Set up periodic checks:

```bash
# Health check
*/5 * * * * curl -f https://www.clearmyday.com/api/health || alert

# Calendar availability
*/15 * * * * curl -f https://www.clearmyday.com/api/calendar/TEST_TOKEN || alert
```

---

## Performance Optimization

### Cache Strategy

**Current Configuration:**
- **HTTP Cache:** 6 hours (max-age=21600)
- **Supabase Cache:** 6 hours per master combo
- **ETag:** Token + creation timestamp
- **Stale-while-revalidate:** 48 hours

**Expected Behavior:**
- First request: Slow (CalDAV fetch)
- Subsequent requests: Fast (cache hit)
- Calendar clients: Poll every 15-60 min
- Server cache: Refresh every 6 hours

### CPU Usage

**Target:** <15 CPU minutes/month

**Optimization tactics:**
1. Leverage Supabase cache
2. Use HTTP caching headers
3. Preserve RRULE (don't expand)
4. Efficient filtering algorithms

---

## Security Considerations

### Rate Limiting

Default: ~60 requests/hour per IP

```typescript
// Configured in lib/constants.ts
RATE_LIMIT_REQUESTS_PER_MINUTE: 60
RATE_LIMIT_REQUESTS_PER_TOKEN: 10
```

### CalDAV Credentials

- Store in environment variables (never commit)
- Use read-only credentials if possible
- Rotate periodically

### Supabase Security

- Use `SUPABASE_ANON_KEY` for public operations
- Reserve `SERVICE_ROLE_KEY` for admin scripts only
- Enable Row Level Security (RLS) policies
- Auto-purge old tokens (30 days)

---

## Updating Dependencies

```bash
# Check for updates
npm outdated

# Update specific package
npm update package-name

# Update all packages
npm update

# Test after updates
npm run build
npm run lint
```

**After major updates:**
1. Test locally
2. Deploy to preview
3. Verify functionality
4. Deploy to production

---

## Additional Resources

- **Operations Guide:** `docs/operations.md` - Monitoring, maintenance, runbooks
- **Troubleshooting:** `docs/troubleshooting.md` - Common issues, debugging
- **Calendar Engine:** `docs/calendar-engine.md` - Architecture details
- **Domain Notes:** `docs/domain-notes.md` - Sorbonne-specific info
- **Changelog:** `docs/changelog.md` - Version history

---

## Support Checklist

If deployment issues persist:

1. [ ] Check Vercel deployment logs
2. [ ] Verify environment variables
3. [ ] Test Supabase connection
4. [ ] Review error logs in Vercel
5. [ ] Check CalDAV credentials
6. [ ] Verify DNS/domain configuration
7. [ ] Review recent code changes
8. [ ] Test in local environment
9. [ ] Check Supabase table structure
10. [ ] Consult troubleshooting guide

---

## Expected Outcomes

After successful deployment:

✅ Calendar subscriptions work reliably  
✅ Holiday weeks appear empty  
✅ Cancelled events don't appear  
✅ EXDATE preserved in output  
✅ Minimal server CPU usage  
✅ Fast response times (cached)  
✅ Supabase cache functioning  
✅ No errors in logs  
