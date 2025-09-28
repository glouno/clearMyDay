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

-- Enable Row Level Security (optional, for security)
ALTER TABLE analyze_events_cache ENABLE ROW LEVEL SECURITY;

-- Policy to allow all operations (adjust as needed)
CREATE POLICY "Allow all operations on analyze_events_cache" 
ON analyze_events_cache FOR ALL 
USING (true);

-- Clean up expired entries (run this periodically or set up a cron job)
-- DELETE FROM analyze_events_cache WHERE expires_at < NOW();
