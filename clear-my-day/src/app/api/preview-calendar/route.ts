// API endpoint for temporary calendar previews (no persistent storage)
import { NextRequest, NextResponse } from 'next/server';
import { caldavClient } from '@/lib/caldav-client';
import { ICSGenerator } from '@/lib/ics-generator';
import { CalendarParser } from '@/lib/calendar-parser';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, filter } = body;

    // Validate input
    if (!name || !filter) {
      return NextResponse.json(
        { success: false, error: 'Name and filter are required' },
        { status: 400 }
      );
    }

    // Validate filter structure
    if (!filter.masters || !Array.isArray(filter.masters) || filter.masters.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one master program must be selected' },
        { status: 400 }
      );
    }

    console.log(`🔍 Preview request for: ${name} with masters: ${filter.masters.join(', ')}`);

    // Fetch calendar data directly (no token storage)
    const results = await caldavClient.fetchAllCalendars(filter.masters);
    
    // Check if we got any events
    const allEvents = Object.values(results)
      .filter(result => result.success)
      .flatMap(result => result.events);

    if (allEvents.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No calendar events could be fetched from the selected masters',
        details: Object.entries(results).map(([source, result]) => ({
          source,
          success: result.success,
          error: result.error,
          eventCount: result.events.length
        }))
      }, { status: 404 });
    }

    // Initialize calendar parser and ICS generator
    const calendarParser = new CalendarParser();
    const icsGenerator = new ICSGenerator();
    
    // Filter events based on the configuration
    const filteredEvents = calendarParser.filterEvents(allEvents, {
      masters: filter.masters,
      courses: filter.courses || [],
      courseGroups: filter.courseGroups || {},
      groups: filter.groups || {},
      dateRange: {
        start: new Date(filter.dateRange.start),
        end: new Date(filter.dateRange.end)
      }
    });

    console.log(`📊 Preview: ${allEvents.length} total → ${filteredEvents.length} filtered events`);

    // Generate ICS content for preview
    const icsContent = icsGenerator.generateICS(filteredEvents, {
      id: 'preview',
      name: `${name} (Preview)`,
      token: 'preview-token',
      filter: {
        ...filter,
        dateRange: {
          start: new Date(filter.dateRange.start),
          end: new Date(filter.dateRange.end)
        }
      },
      createdAt: new Date(),
      lastUpdated: new Date()
    });

    return NextResponse.json({
      success: true,
      preview: true, // Indicate this is a preview, not a persistent calendar
      data: {
        totalEvents: allEvents.length,
        filteredEvents: filteredEvents.length,
        events: filteredEvents.slice(0, 50), // Return first 50 events for preview
        icsContent: icsContent.substring(0, 2000), // Return first 2000 chars of ICS for preview
        sources: Object.entries(results).map(([source, result]) => ({
          source,
          success: result.success,
          error: result.error,
          eventCount: result.events.length
        }))
      },
      message: 'Preview generated successfully (not saved to database)'
    });

  } catch (error) {
    console.error('Error generating calendar preview:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate calendar preview' },
      { status: 500 }
    );
  }
}
