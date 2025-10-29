# Troubleshooting Guide

## Common Issues

### Missing EXDATE in Calendar Output

**Symptoms:**
- Recurring events show up during holiday weeks when they shouldn't
- Calendar shows events on dates that should be excluded
- Room changes not reflected
- Events appear during university closure periods

**Root Cause:**
The EXDATE (exception dates) issue was caused by stale Supabase cache created before EXDATE parsing was implemented.

**Timeline:**
- **Early October 2025:** Initial caches created without EXDATE data
- **Mid October 2025:** EXDATE parsing code added to caldav-client, calendar-parser, and ics-generator
- **October 29, 2025:** Long-TTL caches identified and cleared

**Solution (RESOLVED):**
1. Cache TTL reduced to 6 hours (from accidental 24-30 days)
2. Stale caches deleted on Oct 29, 2025
3. Fresh caches now include EXDATE data

**Verification:**
```bash
# Check if EXDATE is present in calendar output
curl -fsSL "https://www.clearmyday.com/api/calendar/YOUR_TOKEN" | grep -c "EXDATE"
# Should return > 0

# Check EXDATE in source CalDAV
./test/simple_exdate_check.sh
```

---

### EXDATE Pipeline

The EXDATE pipeline has three stages:

#### 1. CalDAV Client (`caldav-client.ts` lines 258-278)
Parses EXDATE from node-ical and converts to Date array:

```typescript
let exdates: Date[] | undefined = undefined;
if (event.exdate) {
  if (Array.isArray(event.exdate)) {
    exdates = event.exdate.map((d) => new Date(d));
  } else if (typeof event.exdate === 'object') {
    const exdateValues = Object.values(event.exdate);
    exdates = exdateValues.map((d) => new Date(d));
  }
}
```

**Logging:** `[CALDAV] Parsing EXDATE for {uid}`

#### 2. Calendar Parser (`calendar-parser.ts` lines 130-165)
Preserves EXDATE through normalization:

```typescript
const exdateMap = new Map<string, Date>();
if (base.exdate && base.exdate.length > 0) {
  base.exdate.forEach(ex => {
    const date = new Date(ex);
    const key = makeKey(date);
    exdateMap.set(key, date);
  });
}
```

**Logging:** `[PARSER] Base event {uid} has X EXDATE entries`

#### 3. ICS Generator (`ics-generator.ts` lines 116-142)
Outputs EXDATE lines in final ICS:

```typescript
if (event.exdate && Array.isArray(event.exdate) && event.exdate.length > 0) {
  const entries = event.exdate
    .map(date => this.formatDateTime(new Date(date)))
    .filter(entry => entry && entry.length > 0);
  
  if (entries.length > 0) {
    lines.push(`EXDATE;TZID=Europe/Paris:${entries.join(',')}`);
  }
}
```

**Logging:** `[ICS-GEN] Processing EXDATE for {uid}: X entries`

---

### Cache Issues

#### Cache Not Refreshing

**Check cache status:**
```sql
SELECT 
  id,
  created_at,
  expires_at,
  expires_at < NOW() as is_expired,
  EXTRACT(EPOCH FROM (expires_at - created_at))/3600 as ttl_hours
FROM caldav_cache 
ORDER BY expires_at ASC;
```

**Expected TTL:** 6 hours  
**If TTL > 24 hours:** Old cache with wrong expiry

**Solution:**
```sql
-- Delete caches with abnormal TTL
DELETE FROM caldav_cache 
WHERE EXTRACT(EPOCH FROM (expires_at - created_at)) > 86400;
```

Caches will auto-repopulate when calendar apps next poll (15-60 minutes).

#### Identifying Which Cache is Used

Calendar tokens use caches based on their master programs:

```
Masters: ["DAC"]           → caldav-DAC
Masters: ["IMA"]           → caldav-IMA
Masters: ["DAC", "IMA"]    → caldav-DAC-IMA
Masters: ["DAC_M2"]        → caldav-DAC_M2
```

**Find which cache a token uses:**
```sql
SELECT 
  token,
  name,
  'caldav-' || ARRAY_TO_STRING(
    (SELECT ARRAY_AGG(elem ORDER BY elem) 
     FROM jsonb_array_elements_text(filter->'masters') elem), 
    '-'
  ) as cache_key
FROM calendar_tokens
WHERE token = 'YOUR_TOKEN_HERE';
```

#### Cache Contains No EXDATE

**Check EXDATE in cache:**
```sql
SELECT 
  id,
  jsonb_array_length(events) as total_events,
  (SELECT COUNT(*) 
   FROM jsonb_array_elements(events) as e 
   WHERE jsonb_array_length(COALESCE(e->'exdate', '[]'::jsonb)) > 0) as events_with_exdate
FROM caldav_cache;
```

**If events_with_exdate = 0:**
1. Cache was created before EXDATE parsing code was deployed
2. Delete the cache to force refresh
3. Verify fresh cache has EXDATE > 0

---

### Debugging Tools

#### Verify EXDATE in Source CalDAV

```bash
./test/simple_exdate_check.sh
```

Checks:
- EXDATE count in source ICS
- EXDATE for specific holiday dates
- Sample EXDATE from DALAS events

#### Fetch Fresh CalDAV Data

```bash
./test/fetch_caldav.sh
```

Downloads latest ICS from Sorbonne CalDAV server for manual inspection.

#### Audit Calendar Output

```bash
./test/ics-verify.sh audit_all "https://www.clearmyday.com/api/calendar/YOUR_TOKEN"
```

Compares:
- Source CalDAV vs ClearMyDay output
- EXDATE counts
- Event counts
- RRULE formatting

#### Verify EXDATE Pipeline

```bash
node ./test/verify_exdate_pipeline.mjs
```

Documents the complete EXDATE flow from source to output.

---

### Production Logs

Enable detailed logging by checking Vercel logs for:

```
[CALDAV] Parsing EXDATE for {uid}: type={type}, isArray={bool}
[CALDAV]   Parsed X EXDATE entries from {source}
[PARSER] Base event {uid} has X EXDATE entries
[PARSER]   Added EXDATE: {date} (key: {key})
[ICS-GEN] Processing EXDATE for {uid}: X entries
[ICS-GEN]   EXDATE entry: {iso_date} -> {formatted}
[ICS-GEN] Adding EXDATE line with X entries
```

**If logs show:**
- `exdate: undefined` → Cache has no EXDATE data
- `exdate: , isArray: true, length: 0` → Cache has empty EXDATE array
- `NO EXDATE` → Event genuinely has no exceptions

---

### CalDAV Method: GET vs REPORT

**Why we use GET instead of REPORT:**

The Sorbonne CalDAV server strips EXDATE entries when using REPORT with `<C:time-range>` filter:

**REPORT with time-range (OLD):**
```typescript
method: 'REPORT',
body: '<C:time-range start="20250901T000000Z" end="20270831T235959Z"/>'
// Result: 0 EXDATE entries (stripped by server)
```

**Simple GET (CURRENT):**
```typescript
method: 'GET'
// Result: 848 EXDATE entries preserved
```

**Trade-off:**
- Fetch 850 KB instead of 200 KB (4x more data)
- Includes historical events 2018-2025 (filtered client-side)
- Worth it to preserve EXDATE!

**Date filtering:** Happens in `calendar-parser.ts` after fetch, so only 2025+ events are cached and returned.

---

### Historical Context

**October 2-5, 2025:**
- Initial caches created with 24-30 day TTL (bug/misconfiguration)
- EXDATE parsing code not yet deployed
- All caches created with `exdate: []`

**October 14, 2025:**
- EXDATE parsing added to caldav-client
- EXDATE preservation added to calendar-parser
- EXDATE output added to ics-generator
- Cache TTL changed to 6 hours (correct)

**October 29, 2025 (Morning):**
- Old long-TTL caches still serving stale data
- Cache analysis revealed 0 events with EXDATE
- Long-TTL caches deleted
- Issue resolved with fresh caches

**October 29, 2025 (Evening - 19:30 CET):**
- Discovered root cause: CalDAV REPORT with time-range strips EXDATE
- Fresh caches had 0 EXDATE despite correct parsing code
- Simple GET returns 848 EXDATE entries
- Switched from REPORT to GET method
- Date filtering moved to client-side (calendar-parser)
- Trade-off: +650 KB fetch size for EXDATE preservation

**Key Lessons:** 
- Cache invalidation matters. Always verify cache refresh after code changes.
- CalDAV server behavior varies. Test different fetch methods if data is missing.
- Time-range filtering can strip recurrence data on some servers.

---

## Quick Reference

### Expected Behavior
- ✅ Source CalDAV has EXDATE for holidays
- ✅ caldav-client parses EXDATE from node-ical
- ✅ calendar-parser preserves EXDATE
- ✅ ics-generator outputs EXDATE lines
- ✅ Cache TTL is 6 hours
- ✅ Production ICS contains EXDATE

### Red Flags
- ❌ Cache TTL > 24 hours
- ❌ events_with_exdate = 0 in cache
- ❌ No EXDATE in production ICS output
- ❌ Events showing during holiday weeks
- ❌ Logs showing "NO EXDATE" for recurring events

### Quick Fixes
1. **Delete stale cache:** `DELETE FROM caldav_cache WHERE id = 'cache-key';`
2. **Force refresh:** Access calendar URL (triggers fetch if cache expired)
3. **Verify:** Check `grep EXDATE` in output ICS
