-- CalDAV Cache Table for ClearMyDay
-- Caches CalDAV responses from Sorbonne servers to reduce API calls and CPU usage
-- Created: 2025-10-02

-- Drop table if exists (for development/testing)
-- DROP TABLE IF EXISTS caldav_cache;

-- Create caldav_cache table
CREATE TABLE IF NOT EXISTS caldav_cache (
  id TEXT PRIMARY KEY,
  masters TEXT[] NOT NULL,
  events JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create index on expires_at for efficient cache cleanup queries
CREATE INDEX IF NOT EXISTS idx_caldav_cache_expires_at ON caldav_cache(expires_at);

-- Create index on masters for efficient lookups by master combination
CREATE INDEX IF NOT EXISTS idx_caldav_cache_masters ON caldav_cache USING GIN(masters);

-- Enable Row Level Security (RLS)
ALTER TABLE caldav_cache ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (this is a cache table, no sensitive data)
-- In production, you might want to restrict INSERT/UPDATE to service role only
CREATE POLICY "Allow all operations on caldav_cache" ON caldav_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Optional: Create a function to clean up expired cache entries
-- This can be called manually or scheduled with pg_cron extension
CREATE OR REPLACE FUNCTION cleanup_expired_caldav_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM caldav_cache
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Optional: Comment on the function
COMMENT ON FUNCTION cleanup_expired_caldav_cache() IS 'Deletes expired entries from caldav_cache table. Returns count of deleted rows.';

-- Comments for documentation
COMMENT ON TABLE caldav_cache IS 'Caches CalDAV responses from Sorbonne servers for 1 hour to reduce API calls and CPU usage on Vercel';
COMMENT ON COLUMN caldav_cache.id IS 'Cache key in format: caldav-{master1}-{master2}';
COMMENT ON COLUMN caldav_cache.masters IS 'Array of master programs (e.g., DAC, IMA, ANDROIDE)';
COMMENT ON COLUMN caldav_cache.events IS 'Array of calendar events in JSON format';
COMMENT ON COLUMN caldav_cache.expires_at IS 'Timestamp when this cache entry expires (typically 1 hour after creation)';

-- Example usage:
-- 
-- To manually clean up expired entries:
--   SELECT cleanup_expired_caldav_cache();
--
-- To view cache statistics:
--   SELECT 
--     COUNT(*) as total_entries,
--     COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as active_entries,
--     COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) as expired_entries,
--     AVG(jsonb_array_length(events)) as avg_events_per_entry
--   FROM caldav_cache;
--
-- To view cache hit rate (requires application logging):
--   -- Check Vercel logs for "CalDAV cache HIT" vs "CalDAV cache MISS"
