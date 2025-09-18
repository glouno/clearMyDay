'use client';

import { useState, useEffect } from 'react';
import { Calendar, momentLocalizer, View } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { CalendarEvent, FilterConfig } from '@/lib/types';

const localizer = momentLocalizer(moment);

interface CalendarPreviewProps {
  filter: FilterConfig;
  onGenerateCalendar: (name: string) => void;
  loading?: boolean;
}

interface PreviewEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource?: {
    location?: string;
    description?: string;
    course?: string;
  };
}

interface FilterStats {
  originalCount: number;
  filteredCount: number;
  reductionPercent: number;
}

export default function CalendarPreview({ filter, onGenerateCalendar, loading = false }: CalendarPreviewProps) {
  const [events, setEvents] = useState<PreviewEvent[]>([]);
  const [originalEvents, setOriginalEvents] = useState<CalendarEvent[]>([]);
  const [stats, setStats] = useState<FilterStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [calendarName, setCalendarName] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<View>('week');

  useEffect(() => {
    if (filter.masters.length > 0) {
      fetchAndFilterEvents();
    }
  }, [filter]);

  const fetchAndFilterEvents = async () => {
    setIsLoadingEvents(true);
    setError(null);

    try {
      const response = await fetch(`/api/fetch-calendar?sources=${filter.masters.join(',')}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch calendar data');
      }

      const allEvents = data.data.events;
      setOriginalEvents(allEvents);

      // Apply client-side filtering for preview
      const filteredEvents = filterEventsForPreview(allEvents, filter);
      
      // Convert to preview format
      const previewEvents: PreviewEvent[] = filteredEvents.map(event => ({
        id: event.uid,
        title: event.summary,
        start: new Date(event.start),
        end: new Date(event.end),
        resource: {
          location: event.location,
          description: event.description,
          course: extractCourse(event.summary)
        }
      }));

      setEvents(previewEvents);
      
      // Calculate stats
      setStats({
        originalCount: allEvents.length,
        filteredCount: filteredEvents.length,
        reductionPercent: Math.round(((allEvents.length - filteredEvents.length) / allEvents.length) * 100)
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setEvents([]);
      setStats(null);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const filterEventsForPreview = (events: CalendarEvent[], filter: FilterConfig): CalendarEvent[] => {
    return events.filter(event => {
      // Date range filter
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      if (eventStart < filter.dateRange.start || eventEnd > filter.dateRange.end) {
        return false;
      }

      // Course filter
      if (filter.courses.length > 0) {
        const eventText = `${event.summary} ${event.description || ''}`.toLowerCase();
        const matchesCourse = filter.courses.some(course => 
          eventText.includes(course.toLowerCase())
        );
        if (!matchesCourse) return false;
      }

      // Course-specific group filter
      if (filter.courseGroups && Object.keys(filter.courseGroups).length > 0) {
        const eventText = `${event.summary} ${event.description || ''}`;
        
        // Extract course from event summary
        const courseId = extractCourseFromEvent(event);
        
        if (courseId && filter.courseGroups[courseId]) {
          const courseGroups = filter.courseGroups[courseId];
          
          // Check TD group if specified for this course
          if (courseGroups.td) {
            const tdPatterns = [
              new RegExp(`4I\\d+-TD${courseGroups.td}-${courseId}`, 'i'),        // 4I806-TD1-IAMSI
              new RegExp(`4I\\d+\\s*-\\s*TD${courseGroups.td}\\s+${courseId}`, 'i'), // 4I802 - TD2 ARF
              new RegExp(`MU4IN\\d+-${courseId}-TD${courseGroups.td}`, 'i'),     // Future format
              new RegExp(`\\bTD${courseGroups.td}\\b.*${courseId}`, 'i'),       // Generic TD1 COURSE
              new RegExp(`${courseId}.*\\bTD${courseGroups.td}\\b`, 'i')        // COURSE TD1
            ];
            
            const matchesTd = tdPatterns.some(pattern => pattern.test(eventText));
            if (!matchesTd) return false;
          }
          
          // Check TME group if specified for this course
          if (courseGroups.tme) {
            const tmePatterns = [
              new RegExp(`4I\\d+-TME${courseGroups.tme}-${courseId}`, 'i'),      // 4I806-TME1-IAMSI
              new RegExp(`4I\\d+\\s*-\\s*TME${courseGroups.tme}\\s+${courseId}`, 'i'), // 4I802 -TME1 ARF
              new RegExp(`MU4IN\\d+-${courseId}-TME${courseGroups.tme}`, 'i'),   // MU4IN806-IAMSI-TME1
              new RegExp(`\\bTME${courseGroups.tme}\\b.*${courseId}`, 'i'),     // Generic TME1 COURSE
              new RegExp(`${courseId}.*\\bTME${courseGroups.tme}\\b`, 'i')      // COURSE TME1
            ];
            
            const matchesTme = tmePatterns.some(pattern => pattern.test(eventText));
            if (!matchesTme) return false;
          }
        }
      }

      return true;
    });
  };

  const extractCourseFromEvent = (event: CalendarEvent): string | null => {
    const summary = event.summary;
    
    // Try different patterns to extract course
    const patterns = [
      /^4I\d+-(?:TD|TME)\d+-([A-Z]+)/i,           // 4I806-TD1-IAMSI -> IAMSI
      /^MU4IN\d+-([A-Z]+)-/i,                     // MU4IN806-IAMSI-TME1 -> IAMSI
      /^UM4IN\d+-([A-Z]+)-/i,                     // UM4IN814-DALAS-TD1 -> DALAS
      /MU4IN\d+-([A-Z]+)-(?:TD|TME|Cours|ER)/i,   // MU4IN811-ML-TD1 -> ML
      /4I\d+\s*-\s*(?:TD|TME)\d+\s+([A-Z]+)/i,    // 4I802 - TD2 ARF -> ARF
    ];
    
    for (const pattern of patterns) {
      const match = summary.match(pattern);
      if (match) {
        return match[1].toUpperCase();
      }
    }
    
    // Fallback: check for known course codes
    const courses = ['DALAS', 'LRC', 'MLBDA', 'MAPSI', 'MOGPL', 'IAMSI', 'ARF', 'BDR', 'ML', 'SAM', 'BIUM'];
    for (const course of courses) {
      if (summary.toUpperCase().includes(course)) {
        return course;
      }
    }
    
    return null;
  };

  const extractCourse = (summary: string): string => {
    const courses = ['DALAS', 'LRC', 'MLBDA', 'MAPSI', 'MOGPL'];
    for (const course of courses) {
      if (summary.toUpperCase().includes(course)) {
        return course;
      }
    }
    return 'Other';
  };

  const eventStyleGetter = (event: PreviewEvent) => {
    const course = event.resource?.course || 'Other';
    const colors = {
      'DALAS': { backgroundColor: '#3B82F6', borderColor: '#1D4ED8' },
      'LRC': { backgroundColor: '#10B981', borderColor: '#047857' },
      'MLBDA': { backgroundColor: '#F59E0B', borderColor: '#D97706' },
      'MAPSI': { backgroundColor: '#EF4444', borderColor: '#DC2626' },
      'MOGPL': { backgroundColor: '#8B5CF6', borderColor: '#7C3AED' },
      'Other': { backgroundColor: '#6B7280', borderColor: '#4B5563' }
    };

    return {
      style: {
        backgroundColor: colors[course as keyof typeof colors]?.backgroundColor || colors.Other.backgroundColor,
        borderColor: colors[course as keyof typeof colors]?.borderColor || colors.Other.borderColor,
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        fontSize: '12px'
      }
    };
  };

  const handleGenerateCalendar = () => {
    onGenerateCalendar(calendarName);
  };

  const handleNavigate = (date: Date) => {
    setCurrentDate(date);
  };

  const handleViewChange = (view: View) => {
    setCurrentView(view);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const goBack = () => {
    const newDate = new Date(currentDate);
    if (currentView === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (currentView === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const goNext = () => {
    const newDate = new Date(currentDate);
    if (currentView === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (currentView === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  if (isLoadingEvents) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading calendar events...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <svg className="h-12 w-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium">Error Loading Calendar</h3>
          </div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchAndFilterEvents}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics */}
      {stats && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Filter Results</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.originalCount}</div>
              <div className="text-sm text-gray-600">Original Events</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.filteredCount}</div>
              <div className="text-sm text-gray-600">Filtered Events</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${stats.reductionPercent >= 80 ? 'text-green-600' : 'text-yellow-600'}`}>
                {stats.reductionPercent}%
              </div>
              <div className="text-sm text-gray-600">Noise Reduced</div>
            </div>
          </div>
          
          {stats.reductionPercent >= 80 ? (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-green-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-green-800 text-sm font-medium">
                  Great! You've achieved the target of 80%+ noise reduction.
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-yellow-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="text-yellow-800 text-sm">
                  Consider adjusting your filters to reduce more noise (target: 80%+).
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Calendar Preview */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Calendar Preview</h3>
          <div className="text-sm text-gray-600">
            Showing {events.length} events
          </div>
        </div>

        {events.length === 0 ? (
          <div className="text-center py-12">
            <svg className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h4 className="text-lg font-medium text-gray-900 mb-2">No Events Found</h4>
            <p className="text-gray-600">
              Try adjusting your filters to include more events.
            </p>
          </div>
        ) : (
          <>
            {/* Calendar Navigation Controls */}
            <div className="flex justify-between items-center mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <button
                  onClick={goToToday}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Today
                </button>
                <button
                  onClick={goBack}
                  className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  ← Back
                </button>
                <button
                  onClick={goNext}
                  className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Next →
                </button>
              </div>
              
              <div className="flex items-center space-x-1">
                {(['month', 'week', 'day'] as View[]).map((view) => (
                  <button
                    key={view}
                    onClick={() => handleViewChange(view)}
                    className={`px-3 py-1 text-sm rounded capitalize ${
                      currentView === view
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  >
                    {view}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ height: '500px' }}>
              <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                titleAccessor="title"
                eventPropGetter={eventStyleGetter}
                views={['month', 'week', 'day']}
                view={currentView}
                date={currentDate}
                onNavigate={handleNavigate}
                onView={handleViewChange}
                popup
                tooltipAccessor={(event: PreviewEvent) => 
                  `${event.title}\n${event.resource?.location || ''}\n${event.resource?.description || ''}`
                }
              />
            </div>
          </>
        )}
      </div>

      {/* Generate Calendar */}
      {events.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Generate Your Calendar</h3>
          
          <div className="mb-4">
            <label htmlFor="calendar-name" className="block text-sm font-medium text-gray-700 mb-2">
              Calendar Name
            </label>
            <input
              id="calendar-name"
              type="text"
              value={calendarName}
              onChange={(e) => setCalendarName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="My Sorbonne Calendar"
            />
          </div>

          <button
            onClick={handleGenerateCalendar}
            disabled={loading || !calendarName.trim()}
            className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Generating Calendar...
              </div>
            ) : (
              'Generate Subscription Link'
            )}
          </button>

          <p className="text-sm text-gray-600 mt-2 text-center">
            This will create a subscription URL you can add to any calendar app
          </p>
        </div>
      )}
    </div>
  );
}
