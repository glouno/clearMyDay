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

// Cache TTL (3 months = 90 days * 24 hours)
// Course groups are stable for entire semester
export const CACHE_TTL_HOURS = 2160;
