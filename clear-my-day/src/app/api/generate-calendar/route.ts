import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { calendarConfigs, CalendarConfig } from '@/lib/calendar-storage';

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

    // Generate unique token for this calendar configuration
    const token = uuidv4();
    
    // Store the configuration
    calendarConfigs.set(token, {
      name,
      filter: {
        ...filter,
        dateRange: {
          start: new Date(filter.dateRange.start),
          end: new Date(filter.dateRange.end)
        }
      },
      createdAt: new Date()
    });

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

// Export the calendar configs for use by other API routes
export { calendarConfigs };
