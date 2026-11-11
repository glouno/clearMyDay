'use client';

import React, { useState } from 'react';
import { Calendar, momentLocalizer, Event, View } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import ICAL from 'ical.js';

const localizer = momentLocalizer(moment);

interface SimpleCalendarPreviewProps {
  courseGroups: { [courseId: string]: string };
  selectedCourses: string[];
  selectedMasters: ('DAC' | 'IMA' | 'ANDROIDE')[];
}

interface CalendarEvent extends Event {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource?: {
    type: string;
    location?: string;
    description?: string;
    isRecurring?: boolean;
  };
}

export default function SimpleCalendarPreview({ 
  courseGroups, 
  selectedCourses, 
  selectedMasters 
}: SimpleCalendarPreviewProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date()); // Today's date
  const [currentView, setCurrentView] = useState<View>('month');

  const fetchEvents = async () => {
    if (selectedCourses.length === 0 || selectedMasters.length === 0) {
      setError('Please select at least one master and one course');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      console.log('🚀 Using working generate-calendar API...');
      
      // Step 1: Use the working generate-calendar API
      const response = await fetch('/api/generate-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Calendar Preview',
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

      // Step 2: Fetch the ICS content using the working API
      const icsResponse = await fetch(data.data.subscriptionUrl);
      
      if (!icsResponse.ok) {
        throw new Error(`ICS Fetch Error: ${icsResponse.status}`);
      }

      const icsContent = await icsResponse.text();
      console.log('✅ ICS content fetched, length:', icsContent.length);

      // Step 3: Parse ICS using reliable ical.js library
      const jcalData = ICAL.parse(icsContent);
      const vcalendar = new ICAL.Component(jcalData);
      const vevents = vcalendar.getAllSubcomponents('vevent');

      console.log('✅ Found', vevents.length, 'events in ICS');

      // Step 4: Convert to calendar events (including recurring events)
      const calendarEvents: CalendarEvent[] = [];
      
      vevents.forEach((vevent, index) => {
        const event = new ICAL.Event(vevent);
        
        // Get basic event info
        const summary = event.summary || 'Untitled Event';
        const location = event.location || '';
        const description = event.description || '';
        const eventType = getEventType(summary);

        // Handle recurring events with better time handling
        if (event.isRecurring()) {
          console.log(`🔄 Processing recurring event: ${summary}`);
          
          // Use a more limited date range for better performance
          const startRange = new Date();
          startRange.setMonth(startRange.getMonth() - 2); // 2 months ago
          const endRange = new Date();
          endRange.setMonth(endRange.getMonth() + 6); // 6 months ahead
          
          try {
            const iterator = event.iterator(ICAL.Time.fromJSDate(startRange));
            let next;
            let occurrenceCount = 0;
            const maxOccurrences = 50; // Much lower limit to prevent clustering
            
            while ((next = iterator.next()) && occurrenceCount < maxOccurrences) {
              const nextDate = next.toJSDate();
              
              // Stop if we're past our end range
              if (nextDate > endRange) break;
              
              // Get the original event's time components
              const originalStart = event.startDate?.toJSDate();
              const originalEnd = event.endDate?.toJSDate();
              
              if (originalStart && originalEnd) {
                // Use the recurrence date/time directly from the iterator
                // The iterator should already provide the correct date and time
                const startTime = nextDate;
                const duration = originalEnd.getTime() - originalStart.getTime();
                const endTime = new Date(startTime.getTime() + duration);
                
                // Debug: Log the timing
                console.log(`⏰ ${summary}: ${startTime.toLocaleString()} → ${endTime.toLocaleString()}`);
                
                calendarEvents.push({
                  id: `recurring-${index}-${occurrenceCount}`,
                  title: summary,
                  start: startTime,
                  end: endTime,
                  resource: {
                    type: eventType,
                    location,
                    description,
                    isRecurring: true
                  }
                });
              }
              
              occurrenceCount++;
            }
            
            console.log(`✅ Found ${occurrenceCount} occurrences for ${summary}`);
          } catch (error) {
            console.warn(`⚠️ Error processing recurring event ${summary}:`, error);
            // Fallback to single event with original times
            const startDate = event.startDate?.toJSDate() || new Date();
            const endDate = event.endDate?.toJSDate() || new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
            
            calendarEvents.push({
              id: `fallback-${index}`,
              title: summary,
              start: startDate,
              end: endDate,
              resource: {
                type: eventType,
                location,
                description,
                isRecurring: false
              }
            });
          }
        } else {
          // Single event
          const startDate = event.startDate?.toJSDate() || new Date();
          const endDate = event.endDate?.toJSDate() || new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
          
          calendarEvents.push({
            id: `single-${index}`,
            title: summary,
            start: startDate,
            end: endDate,
            resource: {
              type: eventType,
              location,
              description,
              isRecurring: false
            }
          });
        }
      });

      // Step 5: Handle recurring events (ical.js handles this automatically)
      console.log('✅ Processed', calendarEvents.length, 'calendar events');
      setEvents(calendarEvents);

    } catch (error) {
      console.error('❌ Calendar preview error:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Comprehensive event type detection
  const getEventType = (title: string): string => {
    const lowerTitle = title.toLowerCase();
    
    // Check for exam types first
    if (lowerTitle.includes('exam') || lowerTitle.includes('examen') || 
        lowerTitle.includes('controle') || lowerTitle.includes('partiel')) {
      return 'exam';
    }
    
    // Check for TD
    if (lowerTitle.includes('td') || lowerTitle.includes('travaux dirigés')) {
      return 'td';
    }
    
    // Check for TME/TP
    if (lowerTitle.includes('tme') || lowerTitle.includes('tp') || 
        lowerTitle.includes('travaux pratiques')) {
      return 'tme';
    }
    
    // Check for courses
    if (lowerTitle.includes('cours') || lowerTitle.includes('lecture') || 
        lowerTitle.includes('cm') || title.match(/^[A-Z]{2,6}\d*$/)) {
      return 'cours';
    }
    
    // If it contains a course code, it's likely a course
    if (title.match(/\b(MLBDA|DALAS|MAPSI|MOGPL|LRC)\b/i)) {
      return 'cours';
    }
    
    return 'other';
  };

  // Event styling - matching the color scheme from the image
  const eventStyleGetter = (event: CalendarEvent) => {
    const type = event.resource?.type || 'other';
    const colors = {
      cours: { backgroundColor: '#3b82f6', color: 'white' }, // Blue
      td: { backgroundColor: '#10b981', color: 'white' },    // Green  
      tme: { backgroundColor: '#8b5cf6', color: 'white' },   // Purple
      exam: { backgroundColor: '#ef4444', color: 'white' },  // Red
      other: { backgroundColor: '#6b7280', color: 'white' }
    };
    return { style: colors[type as keyof typeof colors] || colors.other };
  };

  // Calculate statistics
  const stats = {
    total: events.length,
    recurring: events.filter(e => e.resource?.isRecurring).length,
    oneTime: events.filter(e => !e.resource?.isRecurring).length,
    byType: {
      cours: events.filter(e => e.resource?.type === 'cours').length,
      td: events.filter(e => e.resource?.type === 'td').length,
      tme: events.filter(e => e.resource?.type === 'tme').length,
      exam: events.filter(e => e.resource?.type === 'exam').length,
      other: events.filter(e => e.resource?.type === 'other').length
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Calendar Preview</h3>
        <div className="flex gap-2">
          <button
            onClick={fetchEvents}
            disabled={loading || selectedCourses.length === 0}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : 'Load Calendar'}
          </button>
        </div>
      </div>

      {/* Event Type Legend */}
      {events.length > 0 && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg">
          <div className="flex flex-wrap gap-4 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#3b82f6' }}></div>
              <span className="text-sm font-medium">Cours</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#10b981' }}></div>
              <span className="text-sm font-medium">TD</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#8b5cf6' }}></div>
              <span className="text-sm font-medium">TME</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ef4444' }}></div>
              <span className="text-sm font-medium">Exam</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#6b7280' }}></div>
              <span className="text-sm font-medium">Other</span>
            </div>
          </div>
          
          <div className="text-sm text-blue-800">
            <div className="font-semibold mb-1">Calendar Statistics</div>
            <div>Total Events: {stats.total} | Recurring: {stats.recurring} | One-time: {stats.oneTime}</div>
            <div className="text-xs mt-1">
              By Type: Cours: {stats.byType.cours} | TD: {stats.byType.td} | TME: {stats.byType.tme} | Exam: {stats.byType.exam} | Other: {stats.byType.other}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div style={{ height: 600 }} className="calendar-container">
        <style jsx global>{`
          .rbc-calendar {
            font-family: inherit;
          }
          .rbc-event {
            border-radius: 4px;
            border: none;
            font-size: 12px;
            font-weight: 500;
          }
          .rbc-toolbar {
            margin-bottom: 1rem;
          }
          .rbc-toolbar button {
            border-radius: 4px;
            border: 1px solid #d1d5db;
            background: white;
            color: #374151;
            padding: 0.5rem 1rem;
            margin: 0 2px;
          }
          .rbc-toolbar button:hover {
            background: #f3f4f6;
          }
          .rbc-toolbar button.rbc-active {
            background: #3b82f6;
            color: white;
            border-color: #3b82f6;
          }
        `}</style>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          date={currentDate}
          view={currentView}
          onNavigate={setCurrentDate}
          onView={setCurrentView}
          eventPropGetter={eventStyleGetter}
          views={['month', 'week', 'day', 'agenda']}
          popup
          tooltipAccessor={(event) => `${event.title}\n${event.resource?.location || ''}`}
          min={new Date(0, 0, 0, 8, 0, 0)} // Start at 8 AM
          max={new Date(0, 0, 0, 20, 0, 0)} // End at 8 PM
          scrollToTime={new Date(0, 0, 0, 9, 0, 0)} // Scroll to 9 AM
        />
      </div>
    </div>
  );
}
