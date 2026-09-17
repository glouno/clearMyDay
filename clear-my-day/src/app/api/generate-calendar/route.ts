import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { CalendarStorage, CalendarConfig } from '@/lib/calendar-storage';
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

    const createdAt = new Date();
    const effectiveRange = resolveDateRange(
      filter.dateRangePolicy,
      filter.dateRange,
      filter.academicYearStart,
      createdAt
    );

    // Store a canonical, pinned academic window rather than client-computed dates.
    const config: CalendarConfig = {
      name,
      filter: {
        ...filter,
        dateRangePolicy: effectiveRange.policy,
        academicYearStart: effectiveRange.academicYearStart,
        dateRange: {
          start: effectiveRange.start.toISOString(),
          end: effectiveRange.end.toISOString()
        }
      },
      createdAt
    };
    
    // Check if a token with the same configuration already exists (deduplication)
    let token = await CalendarStorage.findExisting(config);
    
    if (!token) {
      // Generate unique token for new configuration
      token = uuidv4();
      
      // Store the configuration in Supabase
      const saved = await CalendarStorage.set(token, config);
      if (!saved) {
        console.warn('Failed to save to Supabase, but continuing with fallback storage');
      }
    } else {
      // Update stored config even when reusing a token, so dateRange doesn't become stale
      const saved = await CalendarStorage.set(token, config);
      if (!saved) {
        console.warn('Failed to update config in Supabase, but continuing with existing token');
      }
    }

    // Generate subscription URL
    const baseUrl = process.env.NODE_ENV === 'production'
      ? `https://${request.headers.get('host')}`  // Dynamic Vercel URL
      : `http://localhost:${process.env.PORT || 3000}`;
    
    const subscriptionUrl = `${baseUrl}/api/calendar/${token}`;

    return NextResponse.json({
      success: true,
      data: {
        token,
        subscriptionUrl,
        calendarName: name
      }
    });

  } catch (error) {
    console.error('Error generating calendar:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate calendar' },
      { status: 500 }
    );
  }
}

// Export the calendar storage for use by other API routes
export { CalendarStorage };
