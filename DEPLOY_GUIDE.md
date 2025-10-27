# Quick Deployment Guide

## Current Status
✅ **Code Changes Complete**
- Calendar parser preserves RRULE/EXDATE
- Cancelled exceptions converted to EXDATE
- ICS generator outputs clean RRULE/EXDATE
- Date range filtering uses `rrule.between()`

## Testing Options (Pick One)

### Option A: Browser Test (Simplest)
Since terminal commands are hanging, test directly in your browser:

1. **Start dev server manually in a separate terminal**
   ```bash
   cd clear-my-day
   npm run dev
   ```

2. **Open browser to http://localhost:3000**

3. **Generate a test calendar using the UI**
   - Select "DAC" master
   - Date range: Sept 1, 2025 - Dec 31, 2025
   - Click "Generate Calendar"

4. **Copy the subscription URL**

5. **Subscribe in Apple Calendar or Google Calendar**
   - File → New Calendar Subscription (Apple Calendar)
   - Paste the http://localhost:3000/api/calendar/... URL
   - Check Oct 27-31, 2025 → should be empty
   - Check Oct 23, 2025 → should not show "séance annulée" events

### Option B: Direct Deploy to Vercel Preview
Skip local testing, go straight to preview:

1. **Commit and push**
   ```bash
   git checkout -b fix/exdate-pass-through
   git add clear-my-day/src/lib/calendar-parser.ts clear-my-day/src/lib/ics-generator.ts test/
   git commit -m "Fix: Preserve RRULE/EXDATE for holiday weeks and cancellations"
   git push origin fix/exdate-pass-through
   ```

2. **Get Vercel preview URL**
   - Check Vercel dashboard
   - Or GitHub PR checks will show preview link

3. **Test preview URL in calendar app**
   - Use your existing token or generate a new one via preview UI
   - Subscribe to: https://your-preview.vercel.app/api/calendar/<token>
   - Verify Oct 27-31 and Oct 23 behavior

### Option C: Direct Production Deploy (If Confident)
1. **Merge to main**
   ```bash
   git checkout main
   git pull
   git merge fix/exdate-pass-through
   git push origin main
   ```

2. **Vercel auto-deploys to production**

3. **Your existing calendar subscription will use new code**
   - URL: https://www.clearmyday.com/api/calendar/00f44f31-e555-4151-aae5-8be1a040f64b
   - Wait ~2 minutes for cache to expire
   - Refresh your calendar app
   - Verify Oct 27-31 shows empty
   - Verify Oct 23 has no "séance annulée"

## Verification Checklist

After deploying (local, preview, or prod), verify:

- [ ] Holiday week Oct 27-31, 2025 shows **zero events**
- [ ] Oct 23, 2025 does **not** show events with "séance annulée" in title
- [ ] Rescheduled events (e.g., "report du 23/10") **do** appear on their new date (Nov 13)
- [ ] Regular weekly events continue to appear normally
- [ ] ICS file contains `RRULE:FREQ=WEEKLY...` lines (not expanded individual events)
- [ ] ICS file contains `EXDATE;TZID=Europe/Paris:...` lines

## What Changed

### Before (Broken)
```
RRULE events → Server expands all occurrences → Strips RRULE/EXDATE
→ Output: Individual VEVENT for each occurrence
→ Problem: Cancelled/holiday exceptions lost
```

### After (Fixed)
```
RRULE events → Preserve RRULE + EXDATE → Add EXDATE for cancelled
→ Output: Base RRULE + EXDATE list + non-cancelled exceptions
→ Result: Clients skip cancelled/holiday dates automatically
```

## Quick File Inspection (If You Want to Verify Code)

### Check parser preserves RRULE
```bash
grep -A 20 "private expandRecurringEvents" clear-my-day/src/lib/calendar-parser.ts | head -25
```
Should see: "Keep base RRULE events intact"

### Check generator outputs EXDATE
```bash
grep -B 2 -A 2 "EXDATE" clear-my-day/src/lib/ics-generator.ts
```
Should see: `EXDATE;TZID=Europe/Paris:...`

## Rollback Plan (If Something Goes Wrong)

### Vercel Production
1. Go to Vercel dashboard
2. Deployments tab
3. Click on previous working deployment
4. Click "Promote to Production"

### Local
```bash
git revert HEAD
git push origin main
```

## Support

If issues persist:
1. Check test/dev.log for errors
2. Review TEST_RESULTS_SUMMARY.md for detailed analysis
3. Verify Supabase env vars are set (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)

## Expected Outcome

After deployment, your calendar will correctly:
- Show empty holiday weeks (Oct 27-31)
- Hide cancelled events (séance annulée)
- Display rescheduled events on correct dates
- Use minimal server CPU (client does expansion)
- Generate smaller ICS files (one RRULE + exceptions vs hundreds of individual events)

**Recommendation:** Start with Option A (browser test) or Option B (Vercel preview) before production.
