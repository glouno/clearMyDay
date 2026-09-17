-- Supabase table for storing calendar subscription tokens
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS calendar_tokens (
  token TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  filter JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  access_count INTEGER DEFAULT 0
);

-- Index for faster lookups by creation date
CREATE INDEX IF NOT EXISTS idx_calendar_tokens_created_at 
ON calendar_tokens(created_at);

-- Index for cleanup of old tokens
CREATE INDEX IF NOT EXISTS idx_calendar_tokens_last_accessed 
ON calendar_tokens(last_accessed);

-- Internal server table: service-role access only.
ALTER TABLE calendar_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE calendar_tokens FROM anon, authenticated;

-- Function to update last_accessed automatically
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

-- Trigger to update last_accessed when token is used
CREATE TRIGGER update_calendar_token_access
  BEFORE UPDATE ON calendar_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_last_accessed();

-- Clean up old tokens (run this periodically or set up a cron job)
-- DELETE FROM calendar_tokens WHERE last_accessed < NOW() - INTERVAL '30 days';
