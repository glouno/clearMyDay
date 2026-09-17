-- ICS Output Cache Table for ClearMyDay
-- Caches the final generated ICS content per token to avoid re-parsing/filtering on every request
-- This is the most impactful optimization for reducing CPU usage
-- Created: 2026-01-06

-- Create ics_output_cache table
CREATE TABLE IF NOT EXISTS ics_output_cache (
  token TEXT PRIMARY KEY,
  ics_content TEXT NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 0,
  filter_hash TEXT NOT NULL,  -- Hash of filter config to detect changes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on expires_at for efficient cache cleanup queries
CREATE INDEX IF NOT EXISTS idx_ics_output_cache_expires_at ON ics_output_cache(expires_at);

-- Enable Row Level Security (RLS)
ALTER TABLE ics_output_cache ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE ics_output_cache FROM anon, authenticated;

-- Optional: Create a function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_ics_output_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM ics_output_cache
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Comments for documentation
COMMENT ON TABLE ics_output_cache IS 'Caches final ICS output per token to avoid re-parsing events on every request';
COMMENT ON COLUMN ics_output_cache.token IS 'Calendar subscription token (same as calendar_tokens.token)';
COMMENT ON COLUMN ics_output_cache.ics_content IS 'Pre-generated ICS file content';
COMMENT ON COLUMN ics_output_cache.filter_hash IS 'MD5 hash of filter config - invalidate cache if filter changes';
COMMENT ON COLUMN ics_output_cache.expires_at IS 'Cache expiry (typically 1 hour, shorter than CalDAV cache)';
