// API endpoint for analyzing calendar events and detecting available groups

import { NextRequest, NextResponse } from 'next/server';
import { caldavClient } from '@/lib/caldav-client';
import { calendarParser } from '@/lib/calendar-parser';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sources = searchParams.get('sources')?.split(',') || [];

    if (sources.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No sources specified'
      }, { status: 400 });
    }

    console.log('Analyzing events for sources:', sources);

    // Fetch calendar data for all requested sources
    const results = await caldavClient.fetchAllCalendars(sources);
    
    // Combine all events from successful fetches
    const allEvents = Object.values(results)
      .filter(result => result.success)
      .flatMap(result => result.events);

    if (allEvents.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No events could be fetched from any source'
      }, { status: 500 });
    }

    console.log(`Analyzing ${allEvents.length} events`);

    // Analyze events by course
    const courseAnalysis: { [courseId: string]: {
      totalEvents: number;
      eventTypes: { [key: string]: { count: number; examples: string[]; groups?: string[] } };
      availableGroups: { td: string[]; tme: string[] };
    } } = {};
    const eventTypes = {
      cours: 0,
      td: 0,
      tme: 0,
      exam: 0,
      soutenance: 0,
      rattrapage: 0,
      other: 0
    };

    // Get all unique course IDs from events
    const courseIds = new Set<string>();
    allEvents.forEach(event => {
      const courseId = calendarParser.extractCourseId(event);
      if (courseId) {
        courseIds.add(courseId);
      }
    });

    // Analyze each course
    Array.from(courseIds).forEach(courseId => {
      const courseEvents = allEvents.filter(event => 
        calendarParser.extractCourseId(event) === courseId ||
        event.summary?.includes(courseId) ||
        event.description?.includes(courseId)
      );

      if (courseEvents.length === 0) return;

      // Analyze groups for this course
      const groupAnalysis = calendarParser.analyzeGroups(allEvents, [courseId]);
      const groups = groupAnalysis[courseId];

      // Count event types for this course
      const courseEventTypes: { [type: string]: number } = {};
      courseEvents.forEach(event => {
        const type = calendarParser.getEventType(event);
        courseEventTypes[type] = (courseEventTypes[type] || 0) + 1;
        if (type in eventTypes) {
          eventTypes[type as keyof typeof eventTypes] = (eventTypes[type as keyof typeof eventTypes] || 0) + 1;
        } else {
          eventTypes.other = (eventTypes.other || 0) + 1;
        }
      });

      // Create detailed event type analysis with group information
      const detailedEventTypes: { [key: string]: { count: number; examples: string[]; groups?: string[] } } = {};
      
      courseEvents.forEach(event => {
        const type = calendarParser.getEventType(event);
        const summary = event.summary || 'Untitled Event';
        
        // Extract group information from the event
        const text = `${event.summary} ${event.description} ${event.location}`.toLowerCase();
        const tdMatch = text.match(/td\s*(\d+)/i);
        const tmeMatch = text.match(/tme\s*([a-z\d]+)/i);
        
        let eventKey: string = type;
        if (tdMatch) {
          eventKey = `td_${tdMatch[1]}`;
        } else if (tmeMatch) {
          eventKey = `tme_${tmeMatch[1]}`;
        }

        if (!detailedEventTypes[eventKey]) {
          detailedEventTypes[eventKey] = {
            count: 0,
            examples: [],
            groups: []
          };
        }

        detailedEventTypes[eventKey].count++;
        if (detailedEventTypes[eventKey].examples.length < 3) {
          detailedEventTypes[eventKey].examples.push(summary);
        }

        // Add group information
        if (tdMatch && !detailedEventTypes[eventKey].groups?.includes(tdMatch[1])) {
          detailedEventTypes[eventKey].groups?.push(tdMatch[1]);
        }
        if (tmeMatch && !detailedEventTypes[eventKey].groups?.includes(tmeMatch[1])) {
          detailedEventTypes[eventKey].groups?.push(tmeMatch[1]);
        }
      });

      courseAnalysis[courseId] = {
        totalEvents: courseEvents.length,
        eventTypes: detailedEventTypes,
        availableGroups: {
          td: groups.td,
          tme: groups.tme
        }
      };
    });

    // Calculate top patterns
    const patternCounts = new Map<string, number>();
    allEvents.forEach(event => {
      const summary = event.summary || '';
      // Extract common patterns
      const patterns = summary.match(/\b[A-Z]{2,6}\d*\b/g) || [];
      patterns.forEach(pattern => {
        patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
      });
    });

    const topPatterns = Array.from(patternCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([pattern, count]) => ({ pattern, count }));

    return NextResponse.json({
      success: true,
      data: {
        totalEvents: allEvents.length,
        courseAnalysis,
        topPatterns,
        eventTypes,
        sources: sources.map(source => ({
          id: source,
          success: results[source]?.success || false,
          eventCount: results[source]?.events.length || 0,
          error: results[source]?.error
        }))
      }
    });

  } catch (error) {
    console.error('Error analyzing events:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to analyze events',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
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
