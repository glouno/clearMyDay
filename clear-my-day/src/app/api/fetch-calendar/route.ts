// API endpoint for fetching calendar data from Sorbonne sources

import { NextRequest, NextResponse } from 'next/server';
import { caldavClient } from '@/lib/caldav-client';
import { calendarParser } from '@/lib/calendar-parser';
import { ApiResponse } from '@/lib/types';
import { ERROR_MESSAGES } from '@/lib/constants';

// Rate limiting storage (in production, use Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function getRateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
  return `rate_limit_${ip}`;
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 10;

  const current = rateLimitMap.get(key);
  
  if (!current || now > current.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (current.count >= maxRequests) {
    return false;
  }
  
  current.count++;
  return true;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Rate limiting
    const rateLimitKey = getRateLimitKey(request);
    if (!checkRateLimit(rateLimitKey)) {
      return NextResponse.json(
        {
          success: false,
          error: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
          timestamp: new Date().toISOString()
        } as ApiResponse<null>,
        { status: 429 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const sources = searchParams.get('sources')?.split(',') || ['DAC', 'IMA', 'ANDROIDE'];
    const includeGroups = searchParams.get('includeGroups') === 'true';

    // Validate sources
    const validSources = sources.filter(source => 
      ['DAC', 'IMA', 'ANDROIDE'].includes(source)
    ) as ('DAC' | 'IMA' | 'ANDROIDE')[];

    if (validSources.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid calendar sources specified',
          timestamp: new Date().toISOString()
        } as ApiResponse<null>,
        { status: 400 }
      );
    }

    // Fetch calendars using the new method
    const results = await caldavClient.fetchAllCalendars(validSources);

    // Combine all events
    const allEvents = Object.values(results)
      .filter(result => result.success)
      .flatMap(result => result.events);

    // Detect groups if requested
    let detectedGroups = undefined;
    if (includeGroups) {
      detectedGroups = calendarParser.detectGroups(allEvents);
    }

    const responseTime = Date.now() - startTime;

    return NextResponse.json(
      {
        success: true,
        data: {
          events: allEvents,
          sources: Object.entries(results).map(([source, result]) => ({
            source,
            success: result.success,
            error: result.error,
            eventCount: result.events.length
          })),
          detectedGroups,
          stats: {
            totalEvents: allEvents.length,
            responseTimeMs: responseTime,
            sourcesQueried: validSources.length,
            successfulSources: Object.values(results).filter(r => r.success).length
          }
        },
        timestamp: new Date().toISOString()
      },
      { 
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=900', // 15 minutes
          'X-Response-Time': `${responseTime}ms`
        }
      }
    );

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('Calendar fetch error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      } as ApiResponse<null>,
      { 
        status: 500,
        headers: {
          'X-Response-Time': `${responseTime}ms`
        }
      }
    );
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
