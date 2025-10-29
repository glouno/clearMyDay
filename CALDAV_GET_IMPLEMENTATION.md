# CalDAV GET Implementation - October 29, 2025

## Problem Identified

**Root Cause:** CalDAV REPORT with `<C:time-range>` filter strips EXDATE entries.

### Evidence

**CalDAV REPORT (with time-range filter):**
```
[CALDAV] Parsing EXDATE for C590FE73-DA0C-49B5-89DC-3D70B78FD724: type=object, isArray=true
[CALDAV]   Parsed 0 EXDATE entries from array  ← ZERO!
```

**Simple GET (no filter):**
```bash
curl "https://cal.ufr-info-p6.jussieu.fr/caldav.php/DAC/M1_DAC"
# Contains 848 EXDATE entries
# DALAS-Cours has EXDATE for Oct 20 and Oct 27
```

**Conclusion:** The Sorbonne CalDAV server strips EXDATE when time-range filtering is applied.

---

## Solution Implemented

### Changed Method: REPORT → GET

**Before:**
```typescript
method: 'REPORT',
body: reportBody  // with <C:time-range start="..." end="..."/>
```

**After:**
```typescript
method: 'GET'
// No time-range filter
// Date filtering done client-side in calendar-parser
```

### Files Modified

**`src/lib/caldav-client.ts`:**
1. ✅ Removed `getAcademicYearRange()` function (lines 9-38)
2. ✅ Removed CalDAV REPORT XML body generation (lines 75-88)
3. ✅ Changed method from 'REPORT' to 'GET' (line 97)
4. ✅ Removed XML-specific headers (Content-Type, Depth, body)
5. ✅ Removed `parseCalDAVMultiStatus()` function (lines 125-171)
6. ✅ Direct use of response text (ICS format)

**Result:** -60 lines of code, simpler implementation, EXDATE preserved!

---

## Impact Analysis

### Network Transfer

**Before (REPORT):**
- Request: ~400 bytes XML
- Response: ~200 KB (filtered to 2025-2027)
- Events: ~400 events

**After (GET):**
- Request: ~100 bytes (just GET)
- Response: ~850 KB (all historical data)
- Events: ~2190 events (2018-2025)

**Increase:** +650 KB per request (every 6 hours per master)

### Processing

**Date Distribution in Full Response:**
```
2018: 323 events
2019: 293 events
2020: 299 events
2021: 314 events
2022: 194 events
2023: 129 events
2024: 293 events
2025: 198 events  ← What we actually care about
```

**Total:** 2190 events, only 198 from 2025 (9%)

**Processing Steps:**
1. Fetch 850 KB (2190 events)
2. Parse all events with node-ical
3. Filter to 2025+ in calendar-parser (already implemented)
4. Cache only filtered events (~200 events, ~200 KB)

**Added overhead:** ~10ms parsing + filtering (negligible)

### Cache

**Before:**
- Cached data: ~200 events, ~200 KB
- TTL: 6 hours

**After:**
- Cached data: ~200 events, ~200 KB (same!)
- TTL: 6 hours

**No change:** Date filtering happens before caching.

---

## Benefits

1. ✅ **EXDATE preserved** (848 entries vs 0!)
2. ✅ **Simpler code** (-60 lines)
3. ✅ **No XML parsing** (direct ICS)
4. ✅ **More reliable** (standard HTTP GET)
5. ✅ **Cache size unchanged** (~200 KB)

## Trade-offs

1. ⚠️ **+650 KB network transfer** every 6 hours per master
2. ⚠️ **+10ms processing time** to filter 2190→200 events
3. ⚠️ **Process historical data** (then discard)

**Verdict:** Trade-offs are acceptable for 6-hour cache interval.

---

## Verification

### Before Deployment

```bash
# Check code compiles
npm run lint
# Should pass with only warnings (no errors)
```

### After Deployment

```bash
# 1. Check EXDATE in fresh cache (wait for cache refresh)
# Look for logs like:
[CALDAV] Parsing EXDATE for C590FE73-DA0C-49B5-89DC-3D70B78FD724: type=object, isArray=true
[CALDAV]   Parsed 2 EXDATE entries from array  ← Should be > 0!

# 2. Check EXDATE in calendar output
curl -fsSL "https://www.clearmyday.com/api/calendar/TOKEN" | grep -c "EXDATE"
# Should return > 0

# 3. Verify specific DALAS event has EXDATE
curl -fsSL "https://www.clearmyday.com/api/calendar/TOKEN" | grep -A 5 "C590FE73-DA0C-49B5-89DC-3D70B78FD724"
# Should show:
# EXDATE;TZID=Europe/Paris:20251020T134500,20251027T134500
```

---

## Deployment Steps

1. ✅ **Code changes committed**
2. ⏳ **Push to GitHub**
3. ⏳ **Vercel auto-deploys**
4. ⏳ **Wait for cache to expire** (current caches still have 6h TTL)
5. ⏳ **Verify EXDATE appears** in logs and output

---

## Expected Timeline

**Now (19:30 CET):**
- Code changed to use GET method

**After deployment (~19:35 CET):**
- New code deployed to Vercel
- Old caches still valid for ~6 hours

**First fresh fetch (~01:00 CET tomorrow):**
- Calendar apps poll subscription
- GET request to Sorbonne (850 KB with EXDATE)
- Parse events, filter to 2025+
- Cache ~200 events WITH EXDATE
- Return to calendar app

**User sees EXDATE (~01:00 CET tomorrow):**
- Holiday week Oct 27-31 shows empty ✅
- EXDATE lines present in ICS ✅

---

## Monitoring

### Logs to Watch

**Success indicators:**
```
📅 Fetching M1 MIND/DAC calendar (full data to preserve EXDATE)
[CALDAV] Parsing EXDATE for ...: type=object, isArray=true
[CALDAV]   Parsed X EXDATE entries from array  ← X > 0
💾 Cached CalDAV response for caldav-DAC-IMA (expires in 6 hours)
[PARSER] Base event ... has X EXDATE entries  ← X > 0
[ICS-GEN] Processing EXDATE for ...: X entries  ← X > 0
[ICS-GEN] Adding EXDATE line with X entries  ← SUCCESS
```

**Failure indicators:**
```
[CALDAV]   Parsed 0 EXDATE entries from array  ← Still broken
[PARSER] Base event ... has NO EXDATE  ← Problem
[ICS-GEN] Event ... has RRULE but no EXDATE  ← Not fixed
```

### Supabase Cache Check

```sql
-- After fresh fetch, verify EXDATE in cache
SELECT 
  id,
  created_at > '2025-10-29 19:30:00+00' as is_new_cache,
  jsonb_array_length(events) as total_events,
  (SELECT COUNT(*) 
   FROM jsonb_array_elements(events) as e 
   WHERE jsonb_array_length(COALESCE(e->'exdate', '[]'::jsonb)) > 0) as events_with_exdate
FROM caldav_cache 
WHERE id = 'caldav-DAC-IMA';

-- Expected:
-- is_new_cache: true
-- total_events: ~80
-- events_with_exdate: > 0 (should be ~10-20)
```

---

## Rollback Plan

If this causes issues:

```bash
git revert HEAD
git push origin main
```

Vercel will auto-deploy the previous version with REPORT method.

**Note:** Rolling back means EXDATE problem returns. Better to debug forward.

---

## Future Optimization

If 850 KB becomes problematic:

1. **Option 1:** Request only 2024-2025 data from Sorbonne
   - Contact Sorbonne IT to clean up historical events
   
2. **Option 2:** Cache raw GET response separately
   - First request: Fetch and cache 850 KB for 24h
   - Subsequent requests: Parse from cached raw data
   - Reduces Sorbonne server load

3. **Option 3:** Use REPORT without time-range
   - Try: `<C:calendar-query>` without `<C:time-range>`
   - May preserve EXDATE while reducing size
   - Needs testing

---

## Conclusion

**Problem:** REPORT with time-range strips EXDATE  
**Solution:** Use GET, filter client-side  
**Cost:** +650 KB every 6h (acceptable)  
**Benefit:** EXDATE works! ✅  

**Status:** ✅ Code implemented, ready to deploy
