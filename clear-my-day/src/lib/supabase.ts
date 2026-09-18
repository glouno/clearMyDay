// Supabase client for caching analyze-events results
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
// This client is server-only. Production database tables deliberately deny
// access to anon/authenticated roles, so writes must use the service role.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  || (process.env.NODE_ENV !== 'production' ? process.env.SUPABASE_ANON_KEY : undefined);

if (!supabaseUrl || !supabaseKey) {
  console.warn('Server-side Supabase credentials not found. Persistence and caching are disabled.');
}

export const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Cache interface for analyze-events results
export interface AnalyzeEventsCache {
  id: string;
  sources: string[];
  data: {
    summary: {
      totalEvents: number;
      analyzedEvents: number;
      coursesFound: number;
      eventsByType: Record<string, number>;
    };
    courseAnalysis: Record<string, unknown>;
    topPatterns: Array<{ pattern: string; count: number }>;
    sources: Array<{ source: string; success: boolean; error?: string; eventCount: number }>;
  };
  created_at: string;
  expires_at: string;
}

// Cache key generator
export function getCacheKey(sources: string[]): string {
  return `analyze-events-${sources.sort().join('-')}`;
}

// Check if cache entry is valid
export function isCacheValid(cacheEntry: AnalyzeEventsCache): boolean {
  return new Date(cacheEntry.expires_at) > new Date();
}

// Schedules and group labels can change during a semester. A daily refresh
// keeps discovery current without repeatedly downloading full CalDAV feeds.
export const CACHE_TTL_HOURS = 24;

/** Remove expired cache rows. Call only on cache writes, not on cache hits. */
export async function cleanupExpiredCaches(): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase.rpc('cleanup_expired_cache_rows');
  if (error) {
    // Cache cleanup is maintenance and must never make calendar generation fail.
    console.warn('Expired cache cleanup failed:', error.message);
  }
}
