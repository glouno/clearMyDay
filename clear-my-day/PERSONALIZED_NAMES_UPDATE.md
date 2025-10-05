# Personalized Calendar Names Update

## Summary of Changes

This update allows users to have personalized calendar names while maintaining efficient CalDAV caching for CPU optimization.

### What Changed

1. **Calendar Storage (`calendar-storage.ts`)**
   - Hash function now includes `name` in deduplication
   - Each unique (filter + name) combination gets its own token
   - Users can have personalized calendar names without conflicts

2. **WeeklyCalendarPreview Component**
   - Changed hardcoded name from `"Weekly Calendar Preview"` to `"[Preview Calendar - Not for subscription]"`
   - Makes it clear this is a preview, not a production calendar
   - All previews share the same token (reduces database rows)

3. **Security Fixes (SQL Functions)**
   - Added `SET search_path = public, pg_temp` to both functions
   - Prevents search path injection attacks
   - Resolves Supabase security advisor warnings

### Impact on Performance

**CalDAV Cache (CPU optimization):** ✅ **Unchanged**
- Cache key still based on `masters` only: `caldav-${masters.join('-')}`
- 100 users with same masters → still 1 CalDAV fetch per hour
- **CPU optimization fully preserved**

**Supabase Storage:** ✅ **Minimal impact**
- More tokens stored (one per unique name+filter combination)
- Each token: ~1KB
- Free tier: 500MB = 500,000 tokens capacity
- **Well within free tier limits**

**User Experience:** ✅ **Improved**
- Users see their own calendar names in Apple Calendar/Google Calendar
- No more confusion with "Weekly Calendar Preview"
- No name conflicts between users

## Deployment Steps

### 1. Run SQL Updates in Supabase

Copy and run this SQL in your Supabase SQL Editor:

```sql
-- Fix security warnings for both functions
-- This updates existing functions with proper search_path

-- Update cleanup_expired_caldav_cache function
CREATE OR REPLACE FUNCTION cleanup_expired_caldav_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM caldav_cache
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Update update_last_accessed function
CREATE OR REPLACE FUNCTION update_last_accessed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.last_accessed = NOW();
  NEW.access_count = OLD.access_count + 1;
  RETURN NEW;
END;
$$;
```

### 2. Deploy Code Changes

The following files have been updated and need to be deployed:

- `src/lib/calendar-storage.ts` - Personalized name hashing
- `src/components/WeeklyCalendarPreview.tsx` - Preview calendar name fix
- `supabase-caldav-cache-schema.sql` - Security fix (for reference)
- `supabase-calendar-tokens-schema.sql` - Security fix (for reference)

### 3. Verify Changes

After deployment:

1. **Security Check:**
   - Go to Supabase Dashboard → Database → Advisors
   - Verify the `function_search_path_mutable` warnings are gone

2. **Functionality Check:**
   - Create a new calendar with a custom name (e.g., "Paul's Sorbonne Calendar")
   - Subscribe to it in Apple Calendar
   - Verify the name appears correctly
   - Create another calendar with same filters but different name
   - Verify it gets a different token

3. **Preview Check:**
   - Use the "Show Weekly Calendar" preview feature
   - Check Supabase `calendar_tokens` table
   - Should see `[Preview Calendar - Not for subscription]` entries

## Migration Notes

### Existing Tokens
- Old tokens with "Weekly Calendar Preview" will remain in database
- They can be manually deleted if desired
- Or leave them - they'll auto-cleanup after 30 days of no access

### Hash Migration
- The `findExistingFallback()` method handles migration automatically
- Old tokens without `config_hash` will be backfilled on first access
- No manual intervention needed

## Monitoring

### Storage Usage
Check your Supabase storage periodically:

```sql
-- View total tokens and storage estimate
SELECT 
  COUNT(*) as total_tokens,
  pg_size_pretty(pg_total_relation_size('calendar_tokens')) as table_size
FROM calendar_tokens;
```

### CalDAV Cache Efficiency
Check cache hit rates in Vercel logs:

```bash
# Search for cache status
"CalDAV cache HIT"   # Good - saved CPU time
"CalDAV cache MISS"  # Expected for first request or after expiry
```

## Rollback Plan

If needed, revert to generic names by changing the hash function:

```typescript
// In calendar-storage.ts, remove name from hash:
function hashFilterConfig(filter: CalendarConfig['filter']): string {
  const normalized = JSON.stringify({
    // name: name.trim(), // REMOVE THIS LINE
    masters: [...filter.masters].sort(),
    courses: [...filter.courses].sort(),
    courseGroups: filter.courseGroups || {},
  });
  return crypto.createHash('md5').update(normalized).digest('hex');
}
```

## Questions?

This update maintains your CPU optimization strategy while improving UX. The CalDAV cache (your main CPU saver) is completely unaffected.
