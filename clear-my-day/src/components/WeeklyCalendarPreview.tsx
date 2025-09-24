'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { expandRecurringEvents, type RecurringEvent, type ExpandedEvent } from '@/lib/recurrence-handler';

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
  const [loading, setLoading] = useState(false);
  const [currentView, setCurrentView] = useState('week');
  // Start with a date that's more likely to have events (November 2024)
  const [currentDate, setCurrentDate] = useState(new Date(2024, 10, 20)); // November 20, 2024

  const fetchEvents = async () => {
    if (selectedCourses.length === 0 || selectedMasters.length === 0) return;

    setLoading(true);
    try {
      // Use debug endpoint to see what's happening
      const response = await fetch('/api/debug-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Calendar Preview',
          filter: {
            masters: selectedMasters,
            courses: selectedCourses,
            courseGroups: courseGroups,
            dateRange: {
              start: '2024-01-01',
              end: '2025-12-31'
            }
          }
        })
      });

      const debugData = await response.json();
      console.log('Debug Calendar Data:', debugData);
      console.log('Event Blocks:', debugData.debug?.eventBlocks);
      console.log('Parse Errors:', debugData.debug?.parseErrors);

      if (debugData.success) {
        // Log detailed info about event blocks
        debugData.debug.eventBlocks.forEach((block: any, index: number) => {
          console.log(`Event Block ${index}:`, {
            parsed: block.parsed,
            parseError: block.parseError,
            rrule: block.parsed?.rrule,
            rawLines: block.rawLines?.slice(0, 5) // First 5 lines only
          });
        });

        // Convert debug event blocks to recurring events
        const recurringEvents: RecurringEvent[] = debugData.debug.eventBlocks
          .filter((block: any) => block.parsed && !block.parseError)
          .map((block: any, index: number) => {
            // The API already returns properly parsed Date objects, use them directly
            const startDate = block.parsed.start instanceof Date ? block.parsed.start : new Date(block.parsed.start);
            const endDate = block.parsed.end instanceof Date ? block.parsed.end : new Date(block.parsed.end);
            
            console.log(`Event ${index}: ${block.parsed.title}`, {
              rawStart: block.parsed.rawStart,
              parsedStart: startDate.toISOString(),
              timezone: block.parsed.timezone
            });
            
            return {
              id: block.parsed.id || `event-${index}`,
              title: block.parsed.title,
              start: startDate,
              end: endDate,
              rrule: block.parsed.rrule,
              location: block.parsed.location,
              description: block.parsed.description
            };
          });

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
      } else {
        console.error('Debug failed:', debugData);
      }
    } catch (error) {
      console.error('Failed to fetch calendar events:', error);
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
    // Handle different ICS date formats
    if (dateStr.includes('T')) {
      // DateTime format: 20240101T080000Z
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      const hour = dateStr.substring(9, 11);
      const minute = dateStr.substring(11, 13);
      const second = dateStr.substring(13, 15);
      return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
    } else {
      // Date format: 20240101
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      return new Date(`${year}-${month}-${day}`);
    }
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
          view={currentView as any}
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
