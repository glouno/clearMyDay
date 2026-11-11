// Persistent storage implementation for Vercel deployment
// Supports both Supabase (production) and in-memory (development)

import { CalendarConfig } from './calendar-storage';

// Environment-based storage interface
interface PersistentStorage {
  get(token: string): Promise<CalendarConfig | null>;
  set(token: string, config: CalendarConfig): Promise<void>;
  delete(token: string): Promise<void>;
  cleanup(): Promise<number>; // Returns number of deleted expired configs
}

// In-memory storage for development
class InMemoryStorage implements PersistentStorage {
  private storage = new Map<string, CalendarConfig>();

  async get(token: string): Promise<CalendarConfig | null> {
    return this.storage.get(token) || null;
  }

  async set(token: string, config: CalendarConfig): Promise<void> {
    this.storage.set(token, config);
  }

  async delete(token: string): Promise<void> {
    this.storage.delete(token);
  }

  async cleanup(): Promise<number> {
    const now = new Date();
    const expiredTokens: string[] = [];
    
    for (const [token, config] of this.storage.entries()) {
      const daysSinceCreation = (now.getTime() - config.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCreation > 365) { // 1 year expiry
        expiredTokens.push(token);
      }
    }
    
    expiredTokens.forEach(token => this.storage.delete(token));
    return expiredTokens.length;
  }
}

// Supabase storage for production
class SupabaseStorage implements PersistentStorage {
  private supabaseUrl: string;
  private supabaseKey: string;

  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL || '';
    this.supabaseKey = process.env.SUPABASE_ANON_KEY || '';
    
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.warn('Supabase credentials not found, falling back to in-memory storage');
    }
  }

  async get(token: string): Promise<CalendarConfig | null> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error('Supabase not configured');
    }

    try {
      const response = await fetch(`${this.supabaseUrl}/rest/v1/calendar_configs?token=eq.${token}`, {
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Supabase query failed: ${response.status}`);
      }

      const data = await response.json();
      if (data.length === 0) return null;

      const row = data[0];
      return {
        name: row.name,
        filter: JSON.parse(row.filter_json),
        createdAt: new Date(row.created_at)
      };
    } catch (error) {
      console.error('Failed to get from Supabase:', error);
      return null;
    }
  }

  async set(token: string, config: CalendarConfig): Promise<void> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error('Supabase not configured');
    }

    try {
      const response = await fetch(`${this.supabaseUrl}/rest/v1/calendar_configs`, {
        method: 'POST',
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          token,
          name: config.name,
          filter_json: JSON.stringify(config.filter),
          created_at: config.createdAt.toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Supabase insert failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to set in Supabase:', error);
      throw error;
    }
  }

  async delete(token: string): Promise<void> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error('Supabase not configured');
    }

    try {
      const response = await fetch(`${this.supabaseUrl}/rest/v1/calendar_configs?token=eq.${token}`, {
        method: 'DELETE',
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Supabase delete failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to delete from Supabase:', error);
      throw error;
    }
  }

  async cleanup(): Promise<number> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error('Supabase not configured');
    }

    try {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const response = await fetch(`${this.supabaseUrl}/rest/v1/calendar_configs?created_at=lt.${oneYearAgo.toISOString()}`, {
        method: 'DELETE',
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
          'Prefer': 'return=representation'
        }
      });

      if (!response.ok) {
        throw new Error(`Supabase cleanup failed: ${response.status}`);
      }

      const deletedRows = await response.json();
      return deletedRows.length;
    } catch (error) {
      console.error('Failed to cleanup Supabase:', error);
      return 0;
    }
  }
}

// Factory function to get appropriate storage
function createStorage(): PersistentStorage {
  if (process.env.NODE_ENV === 'production' && process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    return new SupabaseStorage();
  } else {
    return new InMemoryStorage();
  }
}

// Export singleton instance
export const persistentStorage = createStorage();
export type { PersistentStorage };

// SQL for Supabase table creation (run this manually in Supabase SQL editor):
/*
CREATE TABLE calendar_configs (
  id SERIAL PRIMARY KEY,
  token VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  filter_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast token lookups
CREATE INDEX idx_calendar_configs_token ON calendar_configs(token);

-- Index for cleanup queries
CREATE INDEX idx_calendar_configs_created_at ON calendar_configs(created_at);

-- Enable Row Level Security (optional, for additional security)
ALTER TABLE calendar_configs ENABLE ROW LEVEL SECURITY;

-- Policy to allow all operations (adjust as needed for your security requirements)
CREATE POLICY "Allow all operations on calendar_configs" ON calendar_configs
  FOR ALL USING (true);
*/
