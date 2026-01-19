'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { expandRecurringEvents, type RecurringEvent } from '@/lib/recurrence-handler';

interface WeeklyCalendarPreviewProps {
  courseGroups: { [courseId: string]: string };
  selectedCourses: string[];
  selectedMasters: ('DAC' | 'IMA' | 'ANDROIDE')[];
  autoLoad?: boolean;
  dateRange?: { start: Date; end: Date };
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    type: 'cours' | 'td' | 'tme' | 'exam' | 'other';
    group?: string;
  };
}

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export default function WeeklyCalendarPreview({ courseGroups, selectedCourses, selectedMasters, autoLoad = false, dateRange }: WeeklyCalendarPreviewProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentView, setCurrentView] = useState('work_week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [hasAutoLoaded, setHasAutoLoaded] = useState(false);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // Tailwind's md breakpoint
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-switch to day view on mobile on initial load
  useEffect(() => {
    if (isMobile && currentView === 'work_week') {
      setCurrentView('day');
    }
  }, [currentView, isMobile]);

  // Function to navigate to today
  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const goToRangeStart = useCallback(() => {
    if (dateRange?.start) {
      setCurrentDate(new Date(dateRange.start));
      return;
    }
    setCurrentDate(new Date());
  }, [dateRange?.start]);

  // Navigation functions
  const goToPrevious = () => {
    const newDate = new Date(currentDate);
    if (currentView === 'day') {
      newDate.setDate(newDate.getDate() - 1);
    } else if (currentView === 'work_week') {
      newDate.setDate(newDate.getDate() - 7);
    } else if (currentView === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (currentView === 'agenda') {
      newDate.setDate(newDate.getDate() - 30);
    }
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
    if (currentView === 'day') {
      newDate.setDate(newDate.getDate() + 1);
    } else if (currentView === 'work_week') {
      newDate.setDate(newDate.getDate() + 7);
    } else if (currentView === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (currentView === 'agenda') {
      newDate.setDate(newDate.getDate() + 30);
    }
    setCurrentDate(newDate);
  };

  // Auto-load calendar when component mounts if autoLoad is true
  const fetchEvents = useCallback(async () => {
    if (selectedCourses.length === 0 || selectedMasters.length === 0) {
      setError('Please select at least one master and one course');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🚀 Fetching calendar events using simplified flow...');

      // Step 1: Generate calendar using the working API
      // Note: Using a static preview name to avoid database pollution
      // All preview calendars share the same token (efficient for CalDAV caching)
      const response = await fetch('/api/generate-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '[Preview Calendar - Not for subscription]',
          filter: {
            masters: selectedMasters,
            courses: selectedCourses,
            groups: { td: '', tme: '' }, // Required by FilterConfig
            courseGroups: courseGroups,
            dateRange: {
              start: dateRange?.start || new Date('2024-09-01'),
              end: dateRange?.end || new Date(new Date().getFullYear() + 1, 11, 31) // Next year end
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate calendar');
      }

      console.log('✅ Calendar generated successfully:', data.data.token);

      // Step 2: Fetch the ICS content
      const icsResponse = await fetch(data.data.subscriptionUrl);

      if (!icsResponse.ok) {
        throw new Error(`ICS Fetch Error: ${icsResponse.status}`);
      }

      const icsContent = await icsResponse.text();
      console.log('✅ ICS content fetched, length:', icsContent.length);

      // Debug: Show first few lines of ICS to understand format
      const icsLines = icsContent.split('\n').slice(0, 30);
      console.log('📋 First 30 lines of ICS:', icsLines);

      // Step 3: Parse ICS content to extract recurring events
      const recurringEvents: RecurringEvent[] = [];
      const lines = icsContent.split('\n');
      let currentEvent: Record<string, string> = {};
      let inEvent = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line === 'BEGIN:VEVENT') {
          inEvent = true;
          currentEvent = {};
        } else if (line === 'END:VEVENT' && inEvent) {
          // Process the completed event
          if (currentEvent.SUMMARY) {
            const startDate = currentEvent.DTSTART ? parseICSDate(currentEvent.DTSTART) : new Date();
            const endDate = currentEvent.DTEND ? parseICSDate(currentEvent.DTEND) : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

            // Debug: Log event timing and raw data
            console.log(`📅 Event: ${currentEvent.SUMMARY}`, {
              rawStart: currentEvent.DTSTART,
              rawEnd: currentEvent.DTEND,
              allKeys: Object.keys(currentEvent),
              parsedStart: startDate.toLocaleString(),
              dayOfWeek: startDate.toLocaleDateString('en-US', { weekday: 'long' }),
              time: startDate.toLocaleTimeString()
            });

            recurringEvents.push({
              id: currentEvent.UID || `event-${recurringEvents.length}`,
              title: currentEvent.SUMMARY,
              start: startDate,
              end: endDate,
              rrule: currentEvent.RRULE,
              location: currentEvent.LOCATION,
              description: currentEvent.DESCRIPTION
            });
          }
          inEvent = false;
        } else if (inEvent && line.includes(':')) {
          const colonIndex = line.indexOf(':');
          const key = line.substring(0, colonIndex);
          const value = line.substring(colonIndex + 1);

          // Handle property parameters (like DTSTART;TZID=Europe/Paris:20241120T140000)
          const cleanKey = key.split(';')[0]; // Remove parameters like ;TZID=Europe/Paris
          currentEvent[cleanKey] = value;
        }
      }

      console.log('Recurring Events:', recurringEvents);

      // Expand recurring events using a wider range to capture all academic events
      // Include past events so users can see the full academic calendar
      const academicYearStart = new Date(2023, 8, 1); // September 1, 2023 (include past academic year)
      const academicYearEnd = new Date(2026, 6, 31); // July 31, 2026

      const expandedEvents = expandRecurringEvents(recurringEvents, {
        start: academicYearStart,
        end: academicYearEnd
      });

      console.log('Expanded Events:', expandedEvents);

      // Convert to calendar events
      const calendarEvents: CalendarEvent[] = expandedEvents.map((event, index) => {
        // Add detailed logging for problematic events
        if (event.start.getFullYear() >= 2025) {
          console.log(`🔍 2025+ Event ${index}:`, {
            title: event.title,
            originalStart: event.start.toISOString(),
            localStart: event.start.toLocaleString(),
            day: event.start.getDay(), // 0=Sunday, 1=Monday, etc.
            isRecurring: event.isRecurring
          });
        }

        return {
          id: event.id,
          title: event.title + (event.isRecurring ? ' (R)' : ''), // Mark recurring events
          start: event.start,
          end: event.end,
          resource: {
            type: getEventType(event.title),
            group: getEventGroup(event.title)
          }
        };
      });

      console.log('Final Calendar Events:', calendarEvents.length);
      setEvents(calendarEvents);

      const now = new Date();
      if (dateRange?.start && dateRange?.end && now >= dateRange.start && now <= dateRange.end) {
        goToToday();
      } else if (dateRange?.start) {
        goToRangeStart();
      } else {
        goToToday();
      }

    } catch (error) {
      console.error('❌ Failed to fetch calendar events:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [courseGroups, dateRange?.end, dateRange?.start, goToRangeStart, goToToday, selectedCourses, selectedMasters]);

  useEffect(() => {
    if (autoLoad && !hasAutoLoaded && selectedCourses.length > 0 && selectedMasters.length > 0) {
      setHasAutoLoaded(true);
      fetchEvents();
    }
  }, [autoLoad, fetchEvents, hasAutoLoaded, selectedCourses.length, selectedMasters.length]);

  // Removed unused parseICSToCalendarEvents function

  const parseICSDate = (dateStr: string): Date => {
    // Clean the date string
    const cleanDate = dateStr.trim();

    // Handle different ICS date formats
    if (cleanDate.includes('T')) {
      // DateTime format: 20241120T140000Z or 20241120T140000
      const isUTC = cleanDate.endsWith('Z');
      const dateTimePart = cleanDate.replace('Z', '');

      if (dateTimePart.length >= 15) { // YYYYMMDDTHHMMSS
        const year = parseInt(dateTimePart.substring(0, 4));
        const month = parseInt(dateTimePart.substring(4, 6)) - 1; // Month is 0-indexed
        const day = parseInt(dateTimePart.substring(6, 8));
        const hour = parseInt(dateTimePart.substring(9, 11));
        const minute = parseInt(dateTimePart.substring(11, 13));
        const second = parseInt(dateTimePart.substring(13, 15)) || 0;

        if (isUTC) {
          return new Date(Date.UTC(year, month, day, hour, minute, second));
        } else {
          // Local time - assume Paris timezone (UTC+1/+2)
          return new Date(year, month, day, hour, minute, second);
        }
      }
    } else if (cleanDate.length === 8) {
      // Date only format: 20241120
      const year = parseInt(cleanDate.substring(0, 4));
      const month = parseInt(cleanDate.substring(4, 6)) - 1;
      const day = parseInt(cleanDate.substring(6, 8));
      return new Date(year, month, day);
    }

    // Fallback to standard Date parsing
    console.warn('Unexpected date format:', cleanDate);
    return new Date(cleanDate);
  };

  const getEventType = (title: string): 'cours' | 'td' | 'tme' | 'exam' | 'other' => {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('exam')) return 'exam';
    if (lowerTitle.includes('td')) return 'td';
    if (lowerTitle.includes('tme')) return 'tme';
    if (lowerTitle.includes('cours')) return 'cours';
    return 'other';
  };

  const getEventGroup = (title: string): string | undefined => {
    const tdMatch = title.match(/td\s*(\d+)/i);
    if (tdMatch) return tdMatch[1];

    const tmeMatch = title.match(/tme\s*(\d+)/i);
    if (tmeMatch) return tmeMatch[1];

    return undefined;
  };

  const eventStyleGetter = (event: CalendarEvent) => {
    let backgroundColor = '#gray';
    let textColor = '#000';

    switch (event.resource.type) {
      case 'cours':
        backgroundColor = '#3B82F6'; // blue-500
        textColor = '#FFFFFF';
        break;
      case 'td':
        backgroundColor = '#10B981'; // green-500
        textColor = '#FFFFFF';
        break;
      case 'tme':
        backgroundColor = '#8B5CF6'; // purple-500
        textColor = '#FFFFFF';
        break;
      case 'exam':
        backgroundColor = '#EF4444'; // red-500
        textColor = '#FFFFFF';
        break;
      default:
        backgroundColor = '#6B7280'; // gray-500
        textColor = '#FFFFFF';
    }

    return {
      style: {
        backgroundColor,
        color: textColor,
        borderRadius: '4px',
        border: 'none',
        fontSize: '12px',
        fontWeight: '500'
      }
    };
  };

  const messages = {
    allDay: 'All Day',
    previous: 'Previous',
    next: 'Next',
    today: 'Today',
    month: 'Month',
    week: 'Week',
    day: 'Day',
    agenda: 'Agenda',
    date: 'Date',
    time: 'Time',
    event: 'Event',
    noEventsInRange: 'No events in this range.',
    showMore: (total: number) => `+${total} more`,
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg ${isMobile && currentView === 'work_week' ? 'p-1' : 'p-3 sm:p-6'}`}>
      {/* Header Section - Responsive */}
      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:justify-between sm:items-center">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900">Calendar Preview</h3>

        {/* Mobile: Stack buttons vertically */}
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
          <div className="flex gap-2">
            <button
              onClick={fetchEvents}
              disabled={loading || selectedCourses.length === 0}
              className="flex-1 sm:flex-none bg-blue-600 text-white px-3 sm:px-4 py-2 text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : (events.length > 0 ? 'Refresh Calendar' : 'Load Calendar')}
            </button>
            <button
              onClick={goToPrevious}
              className="bg-gray-600 text-white px-3 py-2 text-sm rounded-md hover:bg-gray-700"
              title="Previous"
            >
              ←
            </button>
            <button
              onClick={goToToday}
              className="bg-green-600 text-white px-3 py-2 text-sm rounded-md hover:bg-green-700"
            >
              Today
            </button>
            <button
              onClick={goToNext}
              className="bg-gray-600 text-white px-3 py-2 text-sm rounded-md hover:bg-gray-700"
              title="Next"
            >
              →
            </button>
          </div>

          {/* View Switcher */}
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentView('day')}
              className={`flex-1 sm:flex-none px-3 py-2 text-sm rounded-md ${currentView === 'day'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Day
            </button>
            <button
              onClick={() => setCurrentView('work_week')}
              className={`flex-1 sm:flex-none px-3 py-2 text-sm rounded-md ${currentView === 'work_week'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Week
            </button>
            {!isMobile && (
              <button
                onClick={() => setCurrentView('month')}
                className={`px-3 py-2 text-sm rounded-md ${currentView === 'month'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Month
              </button>
            )}
            <button
              onClick={() => setCurrentView('agenda')}
              className={`flex-1 sm:flex-none px-3 py-2 text-sm rounded-md ${currentView === 'agenda'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Container - Responsive Height */}
      <div className="calendar-container" style={{ height: isMobile ? '520px' : '600px' }}>
        <style jsx global>{`
          .rbc-calendar {
            font-family: inherit;
          }
          .rbc-header {
            padding: 8px 6px;
            font-weight: 600;
            color: #374151;
            background-color: #F9FAFB;
            border-bottom: 1px solid #E5E7EB;
          }
          .rbc-today {
            background-color: #DBEAFE !important;
          }
          .rbc-off-range-bg {
            background-color: #F9FAFB;
          }
          .rbc-time-view .rbc-header {
            border-bottom: 1px solid #E5E7EB;
          }
          /* Fix time labels contrast */
          .rbc-time-view .rbc-time-gutter .rbc-timeslot-group {
            color: #000 !important;
          }
          .rbc-time-view .rbc-time-gutter .rbc-label {
            color: #000 !important;
          }
          /* Fix header text */
          .rbc-header {
            color: #000 !important;
          }
          
          /* Completely hide all-day event row to eliminate gap */
          .rbc-time-view .rbc-allday-cell {
            display: none !important;
          }
          .rbc-time-header-content {
            border-bottom: none !important;
          }
          .rbc-time-header {
            border-bottom: 1px solid #E5E7EB !important;
          }
          
          /* Mobile-specific styles */
          @media (max-width: 768px) {
            .rbc-header {
              padding: 6px 2px;
              font-size: 11px;
            }
            .rbc-time-view .rbc-label {
              font-size: 10px;
            }
            .rbc-time-slot {
              min-height: 30px;
            }
            /* Compact week view on mobile */
            .rbc-time-view .rbc-time-gutter {
              width: 40px !important;
              min-width: 40px !important;
              max-width: 40px !important;
            }
            .rbc-time-view .rbc-allday-cell {
              display: none;
            }
            /* Only apply to week view, not day view */
            .rbc-time-view.rbc-day-view .rbc-event-content {
              white-space: normal !important;
            }
            .rbc-event-content {
              font-size: 10px !important;
              padding: 2px 3px !important;
              line-height: 1.2 !important;
            }
            .rbc-event-label {
              font-size: 9px !important;
            }
            .rbc-event {
              padding: 2px 3px !important;
            }
            /* Make agenda view more readable on mobile */
            .rbc-agenda-view {
              font-size: 14px;
            }
            .rbc-agenda-view .rbc-agenda-date-cell {
              padding: 8px 4px;
            }
            .rbc-agenda-view .rbc-agenda-time-cell {
              padding: 8px 4px;
            }
            .rbc-agenda-view .rbc-agenda-event-cell {
              padding: 8px 4px;
            }
          }
        `}</style>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          views={['day', 'work_week', 'month', 'agenda']}
          view={currentView as 'day' | 'work_week' | 'month' | 'agenda'}
          onView={setCurrentView}
          date={currentDate}
          onNavigate={setCurrentDate}
          eventPropGetter={eventStyleGetter}
          messages={messages}
          culture="en-US"
          toolbar={false}
          min={new Date(0, 0, 0, 8, 0, 0)}
          max={new Date(0, 0, 0, 20, 0, 0)}
          components={{
            event: ({ event }: { event: CalendarEvent }) => {
              // Extract course name from title (e.g., "UM4IN814-DALAS-Cours" -> "DALAS")
              const titleParts = event.title.split('-');
              const courseName = titleParts.length > 1 ? titleParts[1].trim() : titleParts[0].trim();
              const displayText = isMobile && currentView === 'work_week' ? courseName : event.title;

              return (
                <div className="px-1 truncate">
                  <div className="font-medium text-xs">
                    {displayText}
                  </div>
                  {event.resource.group && !isMobile && (
                    <div className="text-xs opacity-90">
                      {event.resource.type.toUpperCase()} {event.resource.group}
                    </div>
                  )}
                </div>
              );
            }
          }}
        />
      </div>

      <div className="mt-4 space-y-3">
        {/* Event Type Legend */}
        <div className="flex gap-4 text-sm text-black">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#3B82F6' }}></div>
            <span className="text-black">Cours</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#10B981' }}></div>
            <span className="text-black">TD</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#8B5CF6' }}></div>
            <span className="text-black">TME</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#EF4444' }}></div>
            <span className="text-black">Exam</span>
          </div>
        </div>

      </div>
    </div>
  );
}
