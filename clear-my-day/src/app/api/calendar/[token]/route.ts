// API endpoint for serving personalized ICS calendar feeds
// Optimized with two-tier caching: ICS output cache (fastest) + CalDAV cache (fallback)

import { NextRequest, NextResponse } from 'next/server';
import { CalendarStorage, CalendarConfig } from '@/lib/calendar-storage';
import { caldavClient } from '@/lib/caldav-client';
import { ICSGenerator } from '@/lib/ics-generator';
import { CalendarParser } from '@/lib/calendar-parser';
import { cleanupExpiredCaches, supabase } from '@/lib/supabase';
import { CalendarEvent } from '@/lib/types';
import { APP_CONFIG } from '@/lib/constants';
import { resolveDateRange } from '@/lib/date-range-policy';
import crypto from 'crypto';

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

// Generate a hash of the filter config to detect changes
function hashFilterConfig(filter: {
  masters: string[];
  courses: string[];
  courseGroups?: Record<string, string>;
  groups?: { td?: string; tme?: string };
  dateRangePolicy?: string;
  academicYearStart?: number;
  dateRange: { start: string | Date; end: string | Date };
}): string {
  const normalized = JSON.stringify({
    masters: [...filter.masters].sort(),
    courses: [...filter.courses].sort(),
    courseGroups: filter.courseGroups || {},
    groups: filter.groups || {},
    dateRangePolicy: filter.dateRangePolicy,
    academicYearStart: filter.academicYearStart,
    dateRange: {
      start: new Date(filter.dateRange.start).toISOString(),
      end: new Date(filter.dateRange.end).toISOString()
    },
    v: APP_CONFIG.LOGIC_VERSION // Versioning to force cache invalidation on logic changes
  });
  return crypto.createHash('md5').update(normalized).digest('hex');
}

// Helper to create ICS response with proper headers
function createICSResponse(
  icsContent: string,
  config: CalendarConfig,
  cacheStatus: string,
  clientEtag: string | null
) {
  // Generator timestamps change on every render; exclude them so the ETag tracks
  // actual calendar semantics (events, recurrence, locations and filtering).
  const semanticContent = icsContent.replace(/^(CREATED|LAST-MODIFIED|DTSTAMP):.*\r?$/gm, '');
  const contentHash = crypto.createHash('sha256').update(semanticContent).digest('hex').slice(0, 24);
  const etag = `"${contentHash}"`;
  // Calendar clients already poll conservatively. Keep edge staleness bounded so
  // upstream changes are visible shortly after the six-hour CalDAV cache rolls.
  const cacheControl = 'public, max-age=900, s-maxage=1800, stale-while-revalidate=3600';

  if (clientEtag === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { 'ETag': etag, 'Cache-Control': cacheControl }
    });
  }

  return new NextResponse(icsContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="${config.name.replace(/[^a-zA-Z0-9]/g, '_')}.ics"`,
      'Cache-Control': cacheControl,
      'ETag': etag,
      'X-Cache-Status': cacheStatus,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY'
    }
  });
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

  const clientEtag = request.headers.get('if-none-match');

  try {
    const effectiveRange = resolveDateRange(
      config.filter.dateRangePolicy,
      config.filter.dateRange,
      config.filter.academicYearStart,
      config.createdAt
    );
    const filterWithGroups = {
      ...config.filter,
      dateRangePolicy: effectiveRange.policy,
      academicYearStart: effectiveRange.academicYearStart,
      groups: config.filter.groups || { td: '', tme: '' },
      dateRange: {
        start: effectiveRange.start,
        end: effectiveRange.end
      }
    };
    const filterHash = hashFilterConfig(filterWithGroups);

    // ============================================================
    // OPTIMIZATION: Check ICS output cache first (fastest path)
    // This avoids re-parsing and re-filtering events on every request
    // ============================================================
    if (supabase) {
      try {
        const { data: cachedICS } = await supabase
          .from('ics_output_cache')
          .select('ics_content, filter_hash')
          .eq('token', token)
          .gt('expires_at', new Date().toISOString())
          .single();

        if (cachedICS && cachedICS.ics_content && cachedICS.filter_hash === filterHash) {
          console.log(`⚡ ICS output cache HIT for ${token}`);
          return createICSResponse(cachedICS.ics_content, config, 'ICS-HIT', clientEtag);
        }
      } catch {
        // Cache miss - continue to generate
      }
    }

    // ============================================================
    // ICS cache miss - need to generate ICS content
    // ============================================================
    const calendarParser = new CalendarParser();
    const icsGenerator = new ICSGenerator();

    // Try to get CalDAV data from cache
    const caldavCacheKey = `caldav-${config.filter.masters.sort().join('-')}`;
    let allEvents: CalendarEvent[] = [];
    let caldavCacheHit = false;

    if (supabase) {
      try {
        const { data: cached } = await supabase
          .from('caldav_cache')
          .select('*')
          .eq('id', caldavCacheKey)
          .gt('expires_at', new Date().toISOString())
          .single();

        if (cached && cached.events) {
          allEvents = cached.events as CalendarEvent[];
          caldavCacheHit = true;
          console.log(`✅ CalDAV cache HIT for ${caldavCacheKey}`);
        }
      } catch (cacheError) {
        console.log(`❌ CalDAV cache MISS for ${caldavCacheKey}`, cacheError);
      }
    }

    // If not in cache, fetch from Sorbonne CalDAV
    if (allEvents.length === 0) {
      const results = await caldavClient.fetchAllCalendars(config.filter.masters);

      // Combine all events from successful fetches
      allEvents = Object.values(results)
        .filter(result => result.success)
        .flatMap(result => result.events);

      // Cache the CalDAV response (configurable TTL, default 6 hours)
      if (supabase && allEvents.length > 0) {
        try {
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + APP_CONFIG.CALDAV_CACHE_TTL_HOURS);

          await supabase
            .from('caldav_cache')
            .upsert({
              id: caldavCacheKey,
              masters: config.filter.masters,
              events: allEvents,
              expires_at: expiresAt.toISOString(),
              updated_at: new Date().toISOString()
            });

          console.log(`💾 Cached CalDAV response for ${caldavCacheKey} (expires in ${APP_CONFIG.CALDAV_CACHE_TTL_HOURS} hours)`);
          await cleanupExpiredCaches();
        } catch (cacheError: unknown) {
          console.warn('Failed to cache CalDAV response:', cacheError);
        }
      }
    }

    if (allEvents.length === 0) {
      throw new Error('No calendar events could be fetched');
    }

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

    // ============================================================
    // OPTIMIZATION: Cache the generated ICS output
    // This is the most impactful optimization - avoids re-parsing on every request
    // ============================================================
    if (supabase) {
      try {
        const icsExpiresAt = new Date();
        icsExpiresAt.setHours(icsExpiresAt.getHours() + APP_CONFIG.ICS_OUTPUT_CACHE_TTL_HOURS);

        await supabase
          .from('ics_output_cache')
          .upsert({
            token: token,
            ics_content: icsContent,
            event_count: filteredEvents.length,
            filter_hash: filterHash,
            expires_at: icsExpiresAt.toISOString(),
            updated_at: new Date().toISOString()
          });

        console.log(`💾 Cached ICS output for ${token} (${filteredEvents.length} events, expires in ${APP_CONFIG.ICS_OUTPUT_CACHE_TTL_HOURS}h)`);
      } catch (cacheError: unknown) {
        console.warn('Failed to cache ICS output:', cacheError);
      }
    }

    // Return ICS file
    const cacheStatus = caldavCacheHit ? 'CALDAV-HIT' : 'MISS';
    return createICSResponse(icsContent, config, cacheStatus, clientEtag);

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
