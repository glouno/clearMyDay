// Database abstraction layer for ClearMyDay
// Supports both Supabase (current) and direct PostgreSQL (for cloud migration)
//
// To migrate to direct PostgreSQL:
// 1. npm install pg
// 2. Set DATABASE_URL environment variable
// 3. The code will automatically use pg when DATABASE_URL is set

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Database client type - either Supabase or will be pg.Pool after migration
type DatabaseClient = SupabaseClient | null;

// Initialize database client based on environment
function initializeDatabase(): DatabaseClient {
  // Check for direct PostgreSQL connection (future cloud deployment)
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    // TODO: For cloud migration, replace this with pg.Pool
    // const { Pool } = require('pg');
    // return new Pool({ connectionString: databaseUrl });
    console.log('DATABASE_URL detected - direct PostgreSQL support coming soon');
  }

  // Fall back to Supabase
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('Database credentials not found. Caching will be disabled.');
    return null;
  }

  return createClient(supabaseUrl, supabaseKey);
}

// Export singleton database client
export const db = initializeDatabase();

// Re-export as supabase for backward compatibility
export const supabase = db;

// ============================================================
// Database operations abstraction (for future pg migration)
// ============================================================

export interface CaldavCacheRow {
  id: string;
  masters: string[];
  events: unknown[];
  expires_at: string;
  updated_at?: string;
}

export interface IcsOutputCacheRow {
  token: string;
  ics_content: string;
  filter_hash: string;
  event_count: number;
  expires_at: string;
  updated_at?: string;
}

export interface CalendarTokenRow {
  token: string;
  name: string;
  filter: Record<string, unknown>;
  config_hash?: string;
  created_at: string;
  updated_at?: string;
  last_accessed?: string;
  access_count?: number;
}

// Helper functions that work with both Supabase and future pg implementation
export const DatabaseOperations = {
  // CalDAV cache operations
  async getCaldavCache(cacheKey: string): Promise<CaldavCacheRow | null> {
    if (!db) return null;
    
    const { data, error } = await db
      .from('caldav_cache')
      .select('*')
      .eq('id', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (error || !data) return null;
    return data as CaldavCacheRow;
  },

  async setCaldavCache(row: CaldavCacheRow): Promise<boolean> {
    if (!db) return false;
    
    const { error } = await db
      .from('caldav_cache')
      .upsert(row);
    
    return !error;
  },

  // ICS output cache operations
  async getIcsOutputCache(token: string): Promise<IcsOutputCacheRow | null> {
    if (!db) return null;
    
    const { data, error } = await db
      .from('ics_output_cache')
      .select('*')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (error || !data) return null;
    return data as IcsOutputCacheRow;
  },

  async setIcsOutputCache(row: IcsOutputCacheRow): Promise<boolean> {
    if (!db) return false;
    
    const { error } = await db
      .from('ics_output_cache')
      .upsert(row);
    
    return !error;
  },

  // Calendar token operations
  async getCalendarToken(token: string): Promise<CalendarTokenRow | null> {
    if (!db) return null;
    
    const { data, error } = await db
      .from('calendar_tokens')
      .select('*')
      .eq('token', token)
      .single();
    
    if (error || !data) return null;
    return data as CalendarTokenRow;
  },

  async setCalendarToken(row: CalendarTokenRow): Promise<boolean> {
    if (!db) return false;
    
    const { error } = await db
      .from('calendar_tokens')
      .upsert(row);
    
    return !error;
  },

  async findCalendarTokenByHash(configHash: string): Promise<string | null> {
    if (!db) return null;
    
    const { data, error } = await db
      .from('calendar_tokens')
      .select('token')
      .eq('config_hash', configHash)
      .single();
    
    if (error || !data) return null;
    return data.token;
  }
};

export default db;
