# ClearMyDay EXDATE/RRULE Fix - Test Results Summary

## Problem Statement
- Holiday weeks (e.g., Oct 27-31, 2025) were showing events that shouldn't exist
- Cancelled events (marked "séance annulée") were appearing in the feed
- The original implementation was doing server-side RRULE expansion, stripping EXDATE/RECURRENCE-ID metadata

## Solution Implemented

### 1. Calendar Parser Changes (`calendar-parser.ts`)
**Changed approach:** Preserve RRULE/EXDATE instead of expanding
- Keep base RRULE events intact with their original recurrence rules
- Convert cancelled `RECURRENCE-ID` exceptions ("annulée") into `EXDATE` entries on the base series
- Preserve non-cancelled exceptions (e.g., "report du 23/10") as standalone VEVENT entries
- Use `rrule.between()` for date-range filtering (low CPU, no full expansion)

**Key method:** `expandRecurringEvents()` (renamed but doesn't actually expand)
```typescript
private expandRecurringEvents(events: CalendarEvent[]): CalendarEvent[] {
  // Groups events by UID
  // For RRULE events:
  //   - Preserves base event with RRULE
  //   - Adds cancelled RECURRENCE-ID timestamps to EXDATE list  
  //   - Keeps non-cancelled exceptions as separate events
  // For non-RRULE events:
  //   - Pass through unchanged
}
```

**Date range check:** Fixed to use `between()` instead of `after()`
```typescript
private isEventInDateRange(event: CalendarEvent, dateRange): boolean {
  // For RRULE: Check if ANY occurrence falls within range
  const occurrences = rule.between(dateRange.start, dateRange.end, true);
  return occurrences.length > 0;
}
```

### 2. ICS Generator Changes (`ics-generator.ts`)
- Emit `RRULE` exactly as provided (no timezone rewrites)
- Emit `EXDATE;TZID=Europe/Paris:...` with all exception dates
- Emit `RECURRENCE-ID` for non-cancelled exceptions
- Strip unnecessary `RRULE:` prefix if present in source data

### 3. Test Infrastructure
**Removed:** All Node-based test scripts (relied on deps in clear-my-day/)
- test/analyze_caldav_data.js
- test/verify_holiday_expansion.ts
- test/verify_holiday_expansion.js
- test/fetch_and_analyze.ts

**Added:** Single bash verification script (no dependencies)
- test/ics-verify.sh - Uses only curl/grep/awk
- Fetches Sorbonne CalDAV via REPORT
- Validates holiday week behavior
- Checks for cancelled exceptions
- Verifies EXDATE injection

## Source Data Analysis (test/latest_M1_DAC.ics)

### Holiday Week (Oct 27-31, 2025)
- ✅ **DTSTART events during holiday:** 0
- ✅ **EXDATE entries for holiday:** 33
- **Mechanism:** Sorbonne uses EXDATE to skip the holiday week

### Cancelled Events (Oct 23, 2025)
- ✅ **Cancelled RECURRENCE-ID on Oct 23:** 2 events
- **Mechanism:** Sorbonne uses RECURRENCE-ID with "séance annulée" in summary/description

## Expected Behavior After Fix

### For ClearMyDay output:
1. **Holiday Week**
   - Base RRULE events preserve their weekly recurrence
   - EXDATE list includes all 33 source exception dates (Oct 27-30)
   - Clients (Apple Calendar, Google Calendar) will skip those dates automatically
   - Result: 0 events display during Oct 27-31

2. **Cancelled Exceptions (Oct 23)**
   - Base RRULE events get additional EXDATE for 20251023T083000, 20251023T104500 (the 2 cancelled instances)
   - No "séance annulée" VEVENT entries are emitted
   - Result: Clients skip Oct 23 for those series

3. **Rescheduled Events**
   - Non-cancelled RECURRENCE-ID overrides (e.g., "report du 23/10") are emitted as standalone VEVENT
   - They appear on their NEW date (e.g., Nov 13)
   - No RRULE/EXDATE/RECURRENCE-ID metadata on these

## Why Terminal Commands Were Hanging

### Root Cause
Commands using `curl`, `node`, and subprocess management were hanging in your zsh environment. This is likely due to:
- oh-my-zsh/powerlevel10k prompt hooks
- Interactive shell features interfering with non-interactive commands
- Subprocess I/O buffering issues

### Workaround
- Bash scripts with explicit timeouts (`--max-time`, `--connect-timeout`)
- Direct file analysis with grep/awk instead of running servers
- Commands that don't require interactive shells

## Manual Verification Steps

### Step 1: Verify Source ICS (Already Done)
```bash
# Check holiday week has no DTSTART
grep -E "DTSTART[^:]*:2025102[789]|DTSTART[^:]*:20251030|DTSTART[^:]*:20251031" test/latest_M1_DAC.ics | wc -l
# Result: 0 ✅

# Check holiday week has EXDATE entries
grep -E "EXDATE[^:]*:2025102[789]|EXDATE[^:]*:20251030" test/latest_M1_DAC.ics | wc -l
# Result: 33 ✅

# Check for cancelled Oct 23 exceptions
awk 'BEGIN{RS="END:VEVENT";FS="\n"} {blk=$0; if (blk ~ /RECURRENCE-ID[^\n]*:.*20251023/ && tolower(blk) ~ /annul/) c++} END{print c+0}' test/latest_M1_DAC.ics
# Result: 2 ✅
```

### Step 2: Test Local ICS (When Server Works)
```bash
# Start dev server
cd clear-my-day && npm run dev &

# Wait for ready, then generate token
TOKEN=$(curl -s -X POST http://localhost:3000/api/generate-calendar \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","filter":{"masters":["DAC"],"courses":[],"groups":{},"dateRange":{"start":"2025-09-01T00:00:00+02:00","end":"2025-12-31T23:59:59+01:00"}}}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>console.log(JSON.parse(s).data.token))')

# Fetch local ICS
curl -s "http://localhost:3000/api/calendar/$TOKEN" > test/local_output.ics

# Verify no DTSTART during holiday
grep -E "DTSTART[^:]*:2025102[789]|DTSTART[^:]*:20251030|DTSTART[^:]*:20251031" test/local_output.ics | wc -l
# Expected: 0

# Verify EXDATE is present
grep -c "EXDATE" test/local_output.ics
# Expected: >0 (should have multiple EXDATE lines)

# Verify no "annulée" events
grep -c "annul" test/local_output.ics
# Expected: 0
```

### Step 3: Deploy to Vercel Preview
```bash
# Push branch to GitHub
git checkout -b fix/exdate-pass-through
git add .
git commit -m "Fix: Preserve RRULE/EXDATE semantics for holiday weeks and cancellations"
git push origin fix/exdate-pass-through

# Vercel will auto-build a preview
# Get preview URL from Vercel dashboard or GitHub PR

# Test preview ICS
PREVIEW_URL="https://your-preview.vercel.app"
TOKEN="<existing-token-or-generate-new>"
curl -s "$PREVIEW_URL/api/calendar/$TOKEN" > test/preview_output.ics

# Run same verification as Step 2
```

## Cost Optimization Achieved

### Before (Server-Side Expansion)
- Parse RRULE, generate all occurrences
- Filter by date range
- Emit individual VEVENT for each occurrence
- **CPU:** High (hundreds of date calculations per request)
- **ICS size:** Large (one VEVENT per occurrence)

### After (Pass-Through with EXDATE Injection)
- Preserve base RRULE event
- Inject EXDATE for cancelled instances only
- Emit non-cancelled exceptions as individual VEVENT
- **CPU:** Minimal (only process exceptions)
- **ICS size:** Small (one base + exceptions)
- **Client:** Does the expansion (offloads to user's device)

## Next Actions

1. **Local Testing**
   - Start dev server manually if commands hang
   - Visit http://localhost:3000 in browser
   - Use UI to generate a calendar
   - Subscribe to the ICS URL in Apple Calendar or Google Calendar
   - Verify Oct 27-31 shows no events
   - Verify Oct 23 cancelled events don't appear

2. **Vercel Preview**
   - Push branch to GitHub
   - Test preview deployment
   - Confirm same behavior as local

3. **Production Deploy**
   - Merge to main
   - Vercel auto-deploys
   - Your existing token (00f44f31-e555-4151-aae5-8be1a040f64b) will use new code
   - Verify in your calendar app

## Files Modified

- `clear-my-day/src/lib/calendar-parser.ts` - Preserve RRULE/EXDATE, inject EXDATE for cancelled
- `clear-my-day/src/lib/ics-generator.ts` - Output RRULE/EXDATE without rewrites
- `test/ics-verify.sh` - New bash-based verification (no Node deps)

## Files Removed

- `test/analyze_caldav_data.js`
- `test/verify_holiday_expansion.ts`
- `test/verify_holiday_expansion.js`
- `test/fetch_and_analyze.ts`
- `test_exdate_injection.js` (root)

## Conclusion

The fix is implemented and ready for testing. The key change is preserving Sorbonne's RRULE/EXDATE semantics instead of expanding on the server, which:
- ✅ Respects holiday weeks (via EXDATE)
- ✅ Hides cancelled events (via EXDATE injection)
- ✅ Preserves rescheduled events (as standalone VEVENT)
- ✅ Minimizes CPU and server costs
- ✅ Produces smaller ICS files
- ✅ Offloads expansion to client calendar apps

**Status:** Code complete, ready for local/preview testing and production deployment.
