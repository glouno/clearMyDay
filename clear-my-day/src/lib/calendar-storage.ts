// Production-ready calendar configuration storage using Supabase
import { supabase } from './supabase';
import crypto from 'crypto';

export interface CalendarConfig {
  name: string;
  filter: {
    masters: ('DAC' | 'IMA' | 'ANDROIDE')[];
    courses: string[];
    courseGroups?: { [courseId: string]: string }; // Single group number per course
    groups?: { td?: string; tme?: string }; // Legacy support
    dateRange: {
      start: string;
      end: string;
    };
  };
  createdAt: Date;
}

export interface CalendarTokenRow {
  token: string;
  name: string;
  filter: {
    masters: string[];
    courses: string[];
    courseGroups?: { [courseId: string]: string };
    groups?: { td?: string; tme?: string };
    dateRange: {
      start: string;
      end: string;
    };
  }; // JSONB in Supabase
  config_hash?: string; // MD5 hash for efficient deduplication
  created_at: string;
  updated_at: string;
  last_accessed: string;
  access_count: number;
}

function normalizeCourseGroups(
  courseGroups: CalendarConfig['filter']['courseGroups']
): Record<string, string> {
  if (!courseGroups) return {};

  return Object.keys(courseGroups)
    .sort()
    .reduce<Record<string, string>>((accumulator, key) => {
      accumulator[key] = courseGroups[key];
      return accumulator;
    }, {});
}

// Helper function to create a hash of filter + name for deduplication
// Including name allows each user to have their own personalized calendar
function hashFilterConfig(filter: CalendarConfig['filter'], name: string): string {
  const normalized = JSON.stringify({
    name: name.trim(), // Include name for personalized calendars
    masters: [...filter.masters].sort(),
    courses: [...filter.courses].sort(),
    courseGroups: normalizeCourseGroups(filter.courseGroups),
    // Ignore dates for deduplication - different dates shouldn't create new tokens
  });
  return crypto.createHash('md5').update(normalized).digest('hex');
}

// Production-ready calendar storage class
export class CalendarStorage {
  // Find existing token with same filter + name configuration (deduplication)
  static async findExisting(config: CalendarConfig): Promise<string | null> {
    const configHash = hashFilterConfig(config.filter, config.name);
    
    if (!supabase) {
      // Fallback to in-memory storage
      for (const [token, existingConfig] of calendarConfigs.entries()) {
        const existingHash = hashFilterConfig(existingConfig.filter, existingConfig.name);
        if (existingHash === configHash) {
          console.log(`♻️  Reusing existing token (in-memory): ${token}`);
          return token;
        }
      }
      return null;
    }

    try {
      // Direct hash lookup using indexed column (fast & scalable)
      const { data, error } = await supabase
        .from('calendar_tokens')
        .select('token')
        .eq('config_hash', configHash)
        .single();

      if (!error && data) {
        console.log(`♻️  Reusing existing token: ${data.token}`);
        return data.token;
      }

      // If hash column doesn't exist yet or error, try fallback migration method
      if (error?.code === 'PGRST116' || error?.message?.includes('config_hash')) {
        console.log('⚠️  config_hash column not found, using fallback migration');
        return await this.findExistingFallback(configHash);
      }

      return null;
    } catch (error) {
      console.error('Error finding existing token:', error);
      return null;
    }
  }

  // Fallback method for migration period (backfills hash for existing tokens)
  private static async findExistingFallback(configHash: string): Promise<string | null> {
    if (!supabase) return null;

    try {
      // Fetch all tokens and scan (only during migration)
      const { data, error } = await supabase
        .from('calendar_tokens')
        .select('token, name, filter');

      if (error || !data) return null;

      for (const row of data) {
        const existingHash = hashFilterConfig(row.filter, row.name);
        if (existingHash === configHash) {
          console.log(`♻️  Reusing existing token (fallback): ${row.token}`);
          
          // Backfill the hash for future lookups
          await supabase
            .from('calendar_tokens')
            .update({ config_hash: configHash })
            .eq('token', row.token);
          
          console.log(`✅ Backfilled hash for token: ${row.token}`);
          return row.token;
        }
      }

      return null;
    } catch (error) {
      console.error('Error in fallback token search:', error);
      return null;
    }
  }

  // Save calendar configuration to Supabase
  static async set(token: string, config: CalendarConfig): Promise<boolean> {
    if (!supabase) {
      // Fallback to in-memory storage if Supabase not available
      console.warn('Supabase not available, using in-memory storage (not persistent)');
      calendarConfigs.set(token, config);
      return true;
    }

    try {
      // Generate hash for deduplication (includes name for personalization)
      const configHash = hashFilterConfig(config.filter, config.name);

      const { error } = await supabase
        .from('calendar_tokens')
        .upsert({
          token,
          name: config.name,
          filter: config.filter,
          config_hash: configHash,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Failed to save calendar config to Supabase:', error);
        // Fallback to in-memory storage
        calendarConfigs.set(token, config);
        return false;
      }

      console.log(`✅ Calendar config saved to Supabase: ${token} (hash: ${configHash.substring(0, 8)}...)`);
      return true;
    } catch (error) {
      console.error('Error saving to Supabase:', error);
      // Fallback to in-memory storage
      calendarConfigs.set(token, config);
      return false;
    }
  }

  // Get calendar configuration from Supabase
  static async get(token: string): Promise<CalendarConfig | null> {
    if (!supabase) {
      // Fallback to in-memory storage
      return calendarConfigs.get(token) || null;
    }

    try {
      const { data, error } = await supabase
        .from('calendar_tokens')
        .select('*')
        .eq('token', token)
        .single();

      if (error || !data) {
        // Try fallback to in-memory storage
        const memoryConfig = calendarConfigs.get(token);
        if (memoryConfig) {
          console.log(`📦 Found config in memory fallback: ${token}`);
          return memoryConfig;
        }
        return null;
      }

      // Update last_accessed
      await supabase
        .from('calendar_tokens')
        .update({ 
          last_accessed: new Date().toISOString(),
          access_count: (data.access_count || 0) + 1
        })
        .eq('token', token);

      // Convert Supabase row to CalendarConfig
      const config: CalendarConfig = {
        name: data.name,
        filter: {
          ...data.filter,
          dateRange: {
            start: typeof data.filter.dateRange.start === 'string' 
              ? data.filter.dateRange.start 
              : new Date(data.filter.dateRange.start).toISOString(),
            end: typeof data.filter.dateRange.end === 'string' 
              ? data.filter.dateRange.end 
              : new Date(data.filter.dateRange.end).toISOString()
          }
        },
        createdAt: new Date(data.created_at)
      };

      console.log(`✅ Calendar config loaded from Supabase: ${token}`);
      return config;
    } catch (error) {
      console.error('Error loading from Supabase:', error);
      // Fallback to in-memory storage
      return calendarConfigs.get(token) || null;
    }
  }

  // List all tokens (for debugging)
  static async list(): Promise<CalendarTokenRow[]> {
    if (!supabase) {
      // Convert in-memory storage to similar format
      return Array.from(calendarConfigs.entries()).map(([token, config]) => ({
        token,
        name: config.name,
        filter: config.filter,
        created_at: config.createdAt.toISOString(),
        updated_at: config.createdAt.toISOString(),
        last_accessed: config.createdAt.toISOString(),
        access_count: 0
      }));
    }

    try {
      const { data, error } = await supabase
        .from('calendar_tokens')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error listing tokens:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error listing tokens:', error);
      return [];
    }
  }

  // Clean up old tokens (run periodically)
  static async cleanup(daysOld: number = 30): Promise<number> {
    if (!supabase) {
      return 0;
    }

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const { data, error } = await supabase
        .from('calendar_tokens')
        .delete()
        .lt('last_accessed', cutoffDate.toISOString())
        .select('token');

      if (error) {
        console.error('Error cleaning up tokens:', error);
        return 0;
      }

      const deletedCount = data?.length || 0;
      console.log(`🧹 Cleaned up ${deletedCount} old calendar tokens`);
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up tokens:', error);
      return 0;
    }
  }
}

// Legacy in-memory storage for fallback
const calendarConfigs = new Map<string, CalendarConfig>();

// Legacy exports for backward compatibility
export { calendarConfigs };
