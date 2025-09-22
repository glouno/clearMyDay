'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

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
  'fr': fr,
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

  const fetchEvents = async () => {
    if (selectedCourses.length === 0 || selectedMasters.length === 0) return;

    setLoading(true);
    try {
      // Generate a test calendar with the selected groups
      const response = await fetch('/api/generate-calendar', {
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

      const data = await response.json();
      if (data.success) {
        // Fetch the filtered calendar
        const calendarResponse = await fetch(data.data.subscriptionUrl);
        const icsContent = await calendarResponse.text();

        // Parse ICS content to extract events
        const parsedEvents = parseICSToCalendarEvents(icsContent);
        setEvents(parsedEvents);
      }
    } catch (error) {
      console.error('Failed to fetch calendar events:', error);
    } finally {
      setLoading(false);
    }
  };

  const parseICSToCalendarEvents = (icsContent: string): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    const lines = icsContent.split('\n');

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
    allDay: 'Toute la journée',
    previous: 'Précédent',
    next: 'Suivant',
    today: 'Aujourd\'hui',
    month: 'Mois',
    week: 'Semaine',
    day: 'Jour',
    agenda: 'Agenda',
    date: 'Date',
    time: 'Heure',
    event: 'Événement',
    noEventsInRange: 'Aucun événement dans cette période.',
    showMore: (total: number) => `+${total} autres`,
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
          eventPropGetter={eventStyleGetter}
          messages={messages}
          culture="fr"
          components={{
            event: ({ event }: { event: CalendarEvent }) => (
              <div className="truncate px-1">
                <div className="font-medium">{event.title}</div>
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

      <div className="mt-4 flex gap-4 text-sm">
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
    </div>
  );
}
