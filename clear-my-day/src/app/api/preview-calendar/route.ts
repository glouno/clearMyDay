// API endpoint for temporary calendar previews (no persistent storage)
import { NextRequest, NextResponse } from 'next/server';
import { caldavClient } from '@/lib/caldav-client';
import { ICSGenerator } from '@/lib/ics-generator';
import { CalendarParser } from '@/lib/calendar-parser';
import { resolveDateRange } from '@/lib/date-range-policy';
import { validateCalendarRequest } from '@/lib/request-validation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, filter } = body;

    const validationError = validateCalendarRequest(body);
    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError },
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
    
    const effectiveRange = resolveDateRange(
      filter.dateRangePolicy,
      filter.dateRange,
      filter.academicYearStart
    );

    // Filter events based on the same perennial window used by subscriptions.
    const filteredEvents = calendarParser.filterEvents(allEvents, {
      masters: filter.masters,
      courses: filter.courses || [],
      courseGroups: filter.courseGroups || {},
      groups: filter.groups || {},
      dateRange: {
        start: effectiveRange.start,
        end: effectiveRange.end
      },
      dateRangePolicy: effectiveRange.policy,
      academicYearStart: effectiveRange.academicYearStart
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
          start: effectiveRange.start,
          end: effectiveRange.end
        },
        dateRangePolicy: effectiveRange.policy,
        academicYearStart: effectiveRange.academicYearStart
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
        icsContent,
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
