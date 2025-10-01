# Cache Optimization - Analyze Events API

## Problem Identified

The previous caching strategy had two major issues:

1. **TTL too short**: Cache was set to 4 hours, but course groups are stable for entire semester (3 months)
2. **Wrong cache key strategy**: Caching by master combinations instead of individual masters

### Example of the Problem:
```
Old cache keys:
- "analyze-events-DAC"           (when user selects only DAC)
- "analyze-events-DAC-IMA"       (when user selects DAC + IMA together)
- "analyze-events-ANDROIDE_M2"   (when user selects only ANDROIDE_M2)
- "analyze-events-DAC-IMA-ANDROIDE_M2" (when user selects all three)
```

This resulted in:
- **Duplicate data**: Same master data cached multiple times in different combinations
- **Cache misses**: User selecting [DAC, IMA] won't hit cache from someone who selected [IMA, DAC]
- **Storage waste**: Storing redundant data for every possible combination
- **Short validity**: Data expired after 4 hours despite being stable for months

## Solution Implemented

### 1. Extended Cache TTL
**Changed from 4 hours to 2160 hours (90 days / 3 months)**

File: `src/lib/supabase.ts`
```typescript
// Cache TTL (3 months = 90 days * 24 hours)
// Course groups are stable for entire semester
export const CACHE_TTL_HOURS = 2160;
```

### 2. Individual Master Caching Strategy
**Now caching each master independently**

New cache keys:
- `"analyze-events-DAC"` - Always this key for DAC data
- `"analyze-events-IMA"` - Always this key for IMA data  
- `"analyze-events-ANDROIDE_M2"` - Always this key for ANDROIDE_M2 data

### 3. Smart Cache Composition

When a user requests multiple masters (e.g., `sources=DAC,IMA`):

1. **Check cache for each master individually**
   - DAC cached? → Use cached data
   - IMA cached? → Use cached data
   - ANDROIDE not cached? → Fetch from server

2. **Fetch only uncached masters**
   - Only fetches what's missing from cache
   - Significantly reduces server load

3. **Cache newly fetched data individually**
   - Each master cached with its own key
   - Cached with 3-month TTL

4. **Merge results for response**
   - Combines cached + fetched results
   - Returns unified courseAnalysis, patterns, and statistics

## Benefits

### Storage Efficiency
- **Before**: 10 users × 8 combinations = 80 cache entries (duplicated data)
- **After**: 10 users × 3 masters = 3 cache entries (shared across all users)
- **Reduction**: ~96% fewer cache entries

### Performance
- **Faster responses**: Most requests hit cache (3-month validity)
- **Reduced server load**: Only fetch uncached masters
- **Better user experience**: Instant group detection for cached masters

### Scalability
- **Supabase-friendly**: Less storage, fewer writes
- **Predictable growth**: Only grows with number of masters (3), not combinations (8+)

## Technical Implementation

### File: `src/app/api/analyze-events/route.ts`

Key changes:
1. Added `SourceAnalysisResult` interface for type safety
2. Modified cache lookup to check each master individually:
   ```typescript
   for (const source of validSources) {
     const cacheKey = `analyze-events-${source}`; // Individual key
     // Check cache for this specific master
   }
   ```
3. Created `analyzeSourceEvents()` helper function to analyze individual sources
4. Merge logic combines cached + fetched results intelligently

### Data Structure

Each cached entry contains:
```typescript
{
  id: "analyze-events-DAC",
  sources: ["DAC"],  // Single source
  data: {
    success: true,
    summary: { totalEvents, coursesFound, ... },
    courseAnalysis: { MLBDA: { groups: { td: [1,2,3], tme: [1,2,3] } }, ... },
    topPatterns: [...]
  },
  expires_at: "2025-03-29T..." // 3 months from now
}
```

## Migration Notes

- **Existing cache entries**: Will coexist with new strategy, gradually replaced as they expire
- **No breaking changes**: API response format unchanged
- **Backward compatible**: Works with old and new cache entries

## Testing

Build tested and successful:
```bash
npm run build
✓ Compiled successfully
```

All TypeScript errors resolved with proper type safety.
