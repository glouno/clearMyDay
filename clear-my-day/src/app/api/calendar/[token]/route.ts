// API endpoint for serving personalized ICS calendar feeds

import { NextRequest, NextResponse } from 'next/server';
import { CalendarStorage } from '@/lib/calendar-storage';
import { caldavClient } from '@/lib/caldav-client';
import { ICSGenerator } from '@/lib/ics-generator';
import { CalendarParser } from '@/lib/calendar-parser';
import { supabase } from '@/lib/supabase';
import { CalendarEvent } from '@/lib/types';

// Rate limiting storage
const rateLimitStorage = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const maxRequests = 60;

  const current = rateLimitStorage.get(clientId);
  
  if (!current || now > current.resetTime) {
    rateLimitStorage.set(clientId, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (current.count >= maxRequests) {
    return false;
  }

  current.count++;
  return true;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

  // Check rate limits
  if (!checkRateLimit(clientIp)) {
    return new NextResponse('Rate limit exceeded', { status: 429 });
  }

  // Get configuration from token (Supabase or fallback)
  const config = await CalendarStorage.get(token);
  
  if (!config) {
    return new NextResponse('Invalid token', { status: 404 });
  }

  // Generate ETag based on token and config creation time
  const etag = `"${token}-${config.createdAt.getTime()}"`;
  const clientEtag = request.headers.get('if-none-match');

  // Check ETag - return 304 if calendar hasn't changed
  if (clientEtag === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        'ETag': etag,
        'Cache-Control': 'public, max-age=21600, s-maxage=43200, stale-while-revalidate=172800',
      }
    });
  }

  try {
    // Initialize calendar parser and ICS generator
    const calendarParser = new CalendarParser();
    const icsGenerator = new ICSGenerator();
    
    // Try to get CalDAV data from cache
    const cacheKey = `caldav-${config.filter.masters.sort().join('-')}`;
    let allEvents: CalendarEvent[] = [];
    let cacheHit = false;

    if (supabase) {
      try {
        const { data: cached } = await supabase
          .from('caldav_cache')
          .select('*')
          .eq('id', cacheKey)
          .gt('expires_at', new Date().toISOString())
          .single();

        if (cached && cached.events) {
          allEvents = cached.events as CalendarEvent[];
          cacheHit = true;
          console.log(`✅ CalDAV cache HIT for ${cacheKey}`);
        }
      } catch (cacheError) {
        console.log(`❌ CalDAV cache MISS for ${cacheKey}`);
      }
    }

    // If not in cache, fetch from Sorbonne CalDAV
    if (allEvents.length === 0) {
      const results = await caldavClient.fetchAllCalendars(config.filter.masters);
      
      // Combine all events from successful fetches
      allEvents = Object.values(results)
        .filter(result => result.success)
        .flatMap(result => result.events);

      // Cache the CalDAV response for 6 hours
      // Events are typically updated 1+ days in advance, so 6 hour lag is acceptable
      if (supabase && allEvents.length > 0) {
        try {
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + 6); // 6 hour cache

          await supabase
            .from('caldav_cache')
            .upsert({
              id: cacheKey,
              masters: config.filter.masters,
              events: allEvents,
              expires_at: expiresAt.toISOString()
            });

          console.log(`💾 Cached CalDAV response for ${cacheKey} (expires in 6 hours)`);
        } catch (cacheError: unknown) {
          console.warn('Failed to cache CalDAV response:', cacheError);
        }
      }
    }

    if (allEvents.length === 0) {
      throw new Error('No calendar events could be fetched');
    }

    // Ensure filter has required groups property and convert dates for backward compatibility
    const filterWithGroups = {
      ...config.filter,
      groups: config.filter.groups || { td: '', tme: '' },
      dateRange: {
        start: new Date(config.filter.dateRange.start),
        end: new Date(config.filter.dateRange.end)
      }
    };

    const filteredEvents = calendarParser.filterEvents(allEvents, filterWithGroups);

    // Generate ICS content
    const icsContent = icsGenerator.generateICS(filteredEvents, {
      id: `cal_${token}`,
      name: config.name,
      token: token,
      filter: filterWithGroups,
      createdAt: config.createdAt,
      lastUpdated: new Date()
    });

    // Return ICS file
    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `inline; filename="${config.name.replace(/[^a-zA-Z0-9]/g, '_')}.ics"`,
        'Cache-Control': 'public, max-age=21600, s-maxage=43200, stale-while-revalidate=172800',
        'ETag': etag,
        'X-Cache-Status': cacheHit ? 'HIT' : 'MISS',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY'
      }
    });

  } catch (error) {
    console.error('Error generating calendar:', error);
    return new NextResponse('Failed to generate calendar', { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
