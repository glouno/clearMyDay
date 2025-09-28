'use client';

import React, { useState } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { expandRecurringEvents, type RecurringEvent } from '@/lib/recurrence-handler';

interface WeeklyCalendarPreviewProps {
  courseGroups: { [courseId: string]: string };
  selectedCourses: string[];
  selectedMasters: ('DAC' | 'IMA' | 'ANDROIDE')[];
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

export default function WeeklyCalendarPreview({ courseGroups, selectedCourses, selectedMasters }: WeeklyCalendarPreviewProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentView, setCurrentView] = useState('week');
  // Start with today's date for better UX
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [, setError] = useState<string | null>(null);

  // Function to navigate to today
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const fetchEvents = async () => {
    if (selectedCourses.length === 0 || selectedMasters.length === 0) {
      setError('Please select at least one master and one course');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      console.log('🚀 Fetching calendar events using simplified flow...');
      
      // Step 1: Generate calendar using the working API
      const response = await fetch('/api/generate-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Weekly Calendar Preview',
          filter: {
            masters: selectedMasters,
            courses: selectedCourses,
            groups: { td: '', tme: '' }, // Required by FilterConfig
            courseGroups: courseGroups,
            dateRange: {
              start: new Date('2024-01-01'),
              end: new Date('2025-12-31')
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
        
        // Navigate to today's date after loading events for better UX
        goToToday();

    } catch (error) {
      console.error('❌ Failed to fetch calendar events:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const parseICSToCalendarEvents = (icsContent: string): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    const lines = icsContent.split(/\r\n|\n/);

    let currentEvent: Partial<CalendarEvent> = {};
    let inEvent = false;

    for (const line of lines) {
      if (line.startsWith('BEGIN:VEVENT')) {
        inEvent = true;
        currentEvent = {};
      } else if (line.startsWith('END:VEVENT')) {
        if (currentEvent.title && currentEvent.start && currentEvent.end) {
          events.push(currentEvent as CalendarEvent);
        }
        inEvent = false;
      } else if (inEvent) {
        if (line.startsWith('SUMMARY:')) {
          currentEvent.title = line.substring(8);
        } else if (line.startsWith('DTSTART:')) {
          currentEvent.start = parseICSDate(line.substring(8));
        } else if (line.startsWith('DTEND:')) {
          currentEvent.end = parseICSDate(line.substring(8));
        } else if (line.startsWith('UID:')) {
          currentEvent.id = line.substring(4);
        }
      }
    }

    // Add resource info for styling
    return events.map(event => ({
      ...event,
      resource: {
        type: getEventType(event.title),
        group: getEventGroup(event.title)
      }
    }));
  };

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
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Weekly Calendar Preview</h3>
        <div className="flex gap-2">
          <button
            onClick={fetchEvents}
            disabled={loading || selectedCourses.length === 0}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : 'Load Calendar'}
          </button>
          <button
            onClick={goToToday}
            className="bg-green-600 text-white px-3 py-2 text-sm rounded-md hover:bg-green-700"
          >
            Today
          </button>
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentView('week')}
              className={`px-3 py-2 text-sm rounded-md ${currentView === 'week' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Week
            </button>
            <button
              onClick={() => setCurrentView('month')}
              className={`px-3 py-2 text-sm rounded-md ${currentView === 'month' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      <div className="calendar-container" style={{ height: '600px' }}>
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
            background-color: #FEF3C7;
          }
          .rbc-off-range-bg {
            background-color: #F9FAFB;
          }
          .rbc-toolbar {
            flex-wrap: wrap;
            margin-bottom: 16px;
          }
          .rbc-toolbar button {
            color: #374151;
            border: 1px solid #D1D5DB;
            background-color: #FFFFFF;
          }
          .rbc-toolbar button:hover {
            background-color: #F3F4F6;
          }
          .rbc-toolbar button.rbc-active {
            background-color: #3B82F6;
            border-color: #3B82F6;
            color: #FFFFFF;
          }
          .rbc-time-slot {
            border-top: 1px solid #E5E7EB;
          }
          .rbc-time-view .rbc-header {
            border-bottom: 1px solid #E5E7EB;
          }
        `}</style>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          view={currentView as 'week' | 'month'}
          onView={setCurrentView}
          date={currentDate}
          onNavigate={setCurrentDate}
          eventPropGetter={eventStyleGetter}
          messages={messages}
          culture="en-US"
          components={{
            event: ({ event }: { event: CalendarEvent }) => (
              <div className="truncate px-1">
                <div className="font-medium text-xs">{event.title}</div>
                {event.resource.group && (
                  <div className="text-xs opacity-90">
                    {event.resource.type.toUpperCase()} {event.resource.group}
                  </div>
                )}
              </div>
            )
          }}
        />
      </div>

      <div className="mt-4 space-y-3">
        {/* Event Type Legend */}
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#3B82F6' }}></div>
            <span>Cours</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#10B981' }}></div>
            <span>TD</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#8B5CF6' }}></div>
            <span>TME</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#EF4444' }}></div>
            <span>Exam</span>
          </div>
        </div>

        {/* Event Statistics */}
        {events.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div className="text-sm font-medium text-blue-800">
              Calendar Statistics
            </div>
            <div className="text-sm text-blue-700 mt-1">
              Total Events: {events.length} | 
              Recurring Events: {events.filter(e => e.title.includes('(R)')).length} | 
              One-time Events: {events.filter(e => !e.title.includes('(R)')).length}
            </div>
            <div className="text-xs text-blue-600 mt-1">
              Events marked with (R) are recurring occurrences expanded from RRULE
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
