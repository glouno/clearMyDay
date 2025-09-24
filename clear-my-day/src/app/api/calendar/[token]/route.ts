// API endpoint for serving personalized ICS calendar feeds

import { NextRequest, NextResponse } from 'next/server';
import { CalendarParser } from '@/lib/calendar-parser';
import { caldavClient } from '@/lib/caldav-client';
import { ICSGenerator } from '@/lib/ics-generator';
import { calendarConfigs } from '@/lib/calendar-storage';

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

  // Get configuration from token
  const config = calendarConfigs.get(token);
  
  if (!config) {
    return new NextResponse('Invalid token', { status: 404 });
  }

  try {
    // Initialize calendar parser and ICS generator
    const calendarParser = new CalendarParser();
    const icsGenerator = new ICSGenerator();
    
    // Fetch calendar data
    const results = await caldavClient.fetchAllCalendars(config.filter.masters);
    
    // Combine all events from successful fetches
    const allEvents = Object.values(results)
      .filter(result => result.success)
      .flatMap(result => result.events);

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
        'Content-Disposition': `attachment; filename="${config.name.replace(/[^a-zA-Z0-9]/g, '_')}.ics"`,
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        'ETag': `"${token}-${config.createdAt.getTime()}"`,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
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
