-- Supabase table for caching analyze-events results
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS analyze_events_cache (
  id TEXT PRIMARY KEY,
  sources TEXT[] NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_analyze_events_cache_expires_at 
ON analyze_events_cache(expires_at);

-- Internal server table: service-role access only.
ALTER TABLE analyze_events_cache ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE analyze_events_cache FROM anon, authenticated;

-- Clean up expired entries (run this periodically or set up a cron job)
-- DELETE FROM analyze_events_cache WHERE expires_at < NOW();
