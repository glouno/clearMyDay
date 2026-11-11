// Debug endpoint to analyze event patterns and filtering logic

import { NextRequest, NextResponse } from 'next/server';
import { caldavClient } from '@/lib/caldav-client';
import { calendarParser } from '@/lib/calendar-parser';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sources = searchParams.get('sources')?.split(',') || ['DAC'];
    const limit = parseInt(searchParams.get('limit') || '50');
    
    // Fetch calendar data
    const results = await caldavClient.fetchAllCalendars(sources);
    const allEvents = Object.values(results)
      .filter(result => result.success)
      .flatMap(result => result.events);

    // Analyze event patterns
    const eventAnalysis = {
      totalEvents: allEvents.length,
      sampleEvents: allEvents.slice(0, limit).map(event => ({
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: event.start,
        end: event.end
      })),
      patterns: {
        tdEvents: allEvents.filter(e => /td\d+/i.test(e.summary)).slice(0, 20).map(e => e.summary),
        tmeEvents: allEvents.filter(e => /tme\d+/i.test(e.summary)).slice(0, 20).map(e => e.summary),
        courseEvents: allEvents.filter(e => /4I\d+|MU\d+IN\d+/i.test(e.summary)).slice(0, 20).map(e => e.summary),
        otherEvents: allEvents.filter(e => !/td\d+|tme\d+|4I\d+|MU\d+IN\d+/i.test(e.summary)).slice(0, 20).map(e => e.summary)
      },
      groupDetection: calendarParser.detectGroups(allEvents),
      eventTypes: {
        withTD: allEvents.filter(e => /td/i.test(e.summary)).length,
        withTME: allEvents.filter(e => /tme/i.test(e.summary)).length,
        withCourseCode: allEvents.filter(e => /4I\d+|MU\d+IN\d+/i.test(e.summary)).length,
        other: allEvents.filter(e => !/td|tme|4I\d+|MU\d+IN\d+/i.test(e.summary)).length
      }
    };

    // Test filtering with different configurations
    const testFilters = [
      {
        name: "No groups specified",
        filter: {
          masters: sources as ('DAC' | 'IMA' | 'ANDROIDE')[],
          courses: [],
          groups: {},
          dateRange: {
            start: new Date('2018-01-01'),
            end: new Date('2025-12-31')
          }
        }
      },
      {
        name: "TD1 only",
        filter: {
          masters: sources as ('DAC' | 'IMA' | 'ANDROIDE')[],
          courses: [],
          groups: { td: '1' },
          dateRange: {
            start: new Date('2018-01-01'),
            end: new Date('2025-12-31')
          }
        }
      },
      {
        name: "TME1 only",
        filter: {
          masters: sources as ('DAC' | 'IMA' | 'ANDROIDE')[],
          courses: [],
          groups: { tme: '1' },
          dateRange: {
            start: new Date('2018-01-01'),
            end: new Date('2025-12-31')
          }
        }
      }
    ];

    const filterResults = testFilters.map(test => {
      const filtered = calendarParser.filterEvents(allEvents, test.filter);
      return {
        filterName: test.name,
        originalCount: allEvents.length,
        filteredCount: filtered.length,
        sampleFiltered: filtered.slice(0, 10).map(e => e.summary)
      };
    });

    return NextResponse.json({
      analysis: eventAnalysis,
      filterTests: filterResults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Debug events error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
