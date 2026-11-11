// Debug endpoint to check calendar token and CalDAV cache status
import { NextRequest, NextResponse } from 'next/server';
import { CalendarStorage } from '@/lib/calendar-storage';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({
      error: 'Missing token parameter',
      usage: '/api/debug-cache?token=YOUR_TOKEN'
    }, { status: 400 });
  }

  try {
    // 1. Get token config from calendar_tokens table
    const config = await CalendarStorage.get(token);
    
    if (!config) {
      return NextResponse.json({
        error: 'Token not found',
        token
      }, { status: 404 });
    }

    // 2. Get raw token data from Supabase for timestamps
    let tokenData = null;
    if (supabase) {
      const { data, error } = await supabase
        .from('calendar_tokens')
        .select('*')
        .eq('token', token)
        .single();
      
      if (!error && data) {
        tokenData = data;
      }
    }

    // 3. Check CalDAV cache status
    const cacheKey = `caldav-${config.filter.masters.sort().join('-')}`;
    let cacheStatus = null;
    
    if (supabase) {
      const { data: cached, error } = await supabase
        .from('caldav_cache')
        .select('id, masters, created_at, expires_at, updated_at')
        .eq('id', cacheKey)
        .single();
      
      if (!error && cached) {
        const now = new Date();
        const expiresAt = new Date(cached.expires_at);
        const createdAt = new Date(cached.created_at);
        const updatedAt = cached.updated_at ? new Date(cached.updated_at) : null;
        
        cacheStatus = {
          cacheKey,
          found: true,
          createdAt: cached.created_at,
          updatedAt: cached.updated_at,
          expiresAt: cached.expires_at,
          isExpired: expiresAt < now,
          ageMinutes: Math.round((now.getTime() - createdAt.getTime()) / 60000),
          timeUntilExpireMinutes: Math.round((expiresAt.getTime() - now.getTime()) / 60000),
          masters: cached.masters
        };
      } else {
        cacheStatus = {
          cacheKey,
          found: false,
          error: error?.message
        };
      }
    }

    // 4. Get sample events from cache to check room numbers
    let sampleEvents = null;
    if (supabase) {
      const { data: cached } = await supabase
        .from('caldav_cache')
        .select('events')
        .eq('id', cacheKey)
        .single();
      
      if (cached?.events) {
        // Get 5 sample events with location info
        const events = cached.events as Array<{
          summary?: string;
          location?: string;
          dtstart?: string;
          uid?: string;
        }>;
        sampleEvents = events
          .filter(e => e.location)
          .slice(0, 10)
          .map(e => ({
            summary: e.summary,
            location: e.location,
            dtstart: e.dtstart,
            uid: e.uid?.substring(0, 20) + '...'
          }));
      }
    }

    const now = new Date();
    
    return NextResponse.json({
      success: true,
      checkedAt: now.toISOString(),
      token: {
        id: token,
        name: tokenData?.name || config.name,
        createdAt: tokenData?.created_at,
        updatedAt: tokenData?.updated_at,
        lastAccessed: tokenData?.last_accessed,
        accessCount: tokenData?.access_count,
        filter: config.filter,
        // Age calculations
        ageHours: tokenData?.created_at 
          ? Math.round((now.getTime() - new Date(tokenData.created_at).getTime()) / 3600000)
          : null,
        hoursSinceUpdate: tokenData?.updated_at
          ? Math.round((now.getTime() - new Date(tokenData.updated_at).getTime()) / 3600000)
          : null
      },
      caldavCache: cacheStatus,
      sampleEventsWithLocations: sampleEvents,
      diagnosis: {
        tokenFound: !!config,
        cacheFound: cacheStatus?.found || false,
        cacheExpired: cacheStatus?.isExpired || false,
        recommendation: cacheStatus?.isExpired 
          ? 'Cache is expired - next request will fetch fresh data from Sorbonne'
          : cacheStatus?.found
            ? `Cache is active, will expire in ${cacheStatus.timeUntilExpireMinutes} minutes. Force refresh by deleting cache entry.`
            : 'No cache found - will fetch fresh data on next request'
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Force cache refresh endpoint
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({
      error: 'Missing token parameter'
    }, { status: 400 });
  }

  try {
    const config = await CalendarStorage.get(token);
    
    if (!config) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    const cacheKey = `caldav-${config.filter.masters.sort().join('-')}`;
    
    if (supabase) {
      // Delete the cache entry to force refresh
      const { error } = await supabase
        .from('caldav_cache')
        .delete()
        .eq('id', cacheKey);

      if (error) {
        return NextResponse.json({
          success: false,
          error: error.message
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Cache entry '${cacheKey}' deleted. Next calendar request will fetch fresh data.`,
        cacheKey
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Supabase not configured'
    }, { status: 500 });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
