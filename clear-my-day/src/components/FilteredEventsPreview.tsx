'use client';

import React, { useState } from 'react';

interface FilteredEventsPreviewProps {
  courseGroups: { [courseId: string]: string };
  selectedCourses: string[];
  selectedMasters: ('DAC' | 'IMA' | 'ANDROIDE')[];
}

interface EventSummary {
  summary: string;
  type: 'cours' | 'td' | 'tme' | 'exam' | 'other';
  group?: string;
}

export default function FilteredEventsPreview({ courseGroups, selectedCourses, selectedMasters }: FilteredEventsPreviewProps) {
  const [filteredEvents, setFilteredEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const fetchFilteredEvents = async () => {
    if (selectedCourses.length === 0 || selectedMasters.length === 0) return;

    setLoading(true);
    try {
      // Generate a test calendar with the selected groups
      const response = await fetch('/api/generate-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Preview Test',
          filter: {
            masters: selectedMasters,
            courses: selectedCourses,
            groups: { td: '', tme: '' }, // Required by FilterConfig interface
            courseGroups: courseGroups,
            dateRange: {
              start: new Date('2024-01-01'),
              end: new Date('2025-12-31')
            }
          }
        })
      });

      const data = await response.json();
      if (data.success) {
        // Fetch the filtered calendar using relative URL to avoid CORS issues
        const token = data.data.token;
        const calendarResponse = await fetch(`/api/calendar/${token}`);
        const icsContent = await calendarResponse.text();
        
        // Parse the ICS content to extract event summaries
        const eventSummaries = icsContent.match(/SUMMARY:([^\r\n]+)/g) || [];
        const summaries = eventSummaries.map(line => line.replace('SUMMARY:', ''));
        
        // Analyze and categorize events
        const events: EventSummary[] = [];
        const uniqueSummaries = [...new Set(summaries)]; // Deduplicate
        
        uniqueSummaries.forEach(summary => {
          let type: EventSummary['type'] = 'other';
          let group: string | undefined;
          
          const lowerSummary = summary.toLowerCase();
          
          if (lowerSummary.includes('cours')) {
            type = 'cours';
          } else if (lowerSummary.includes('exam')) {
            type = 'exam';
          } else if (lowerSummary.includes('td')) {
            type = 'td';
            const tdMatch = summary.match(/td\s*(\d+)/i);
            if (tdMatch) group = tdMatch[1];
          } else if (lowerSummary.includes('tme')) {
            type = 'tme';
            const tmeMatch = summary.match(/tme\s*(\d+)/i);
            if (tmeMatch) group = tmeMatch[1];
          }
          
          events.push({ summary, type, group });
        });

        // Sort events by type and group
        events.sort((a, b) => {
          const typeOrder = { cours: 0, td: 1, tme: 2, exam: 3, other: 4 };
          if (a.type !== b.type) {
            return typeOrder[a.type] - typeOrder[b.type];
          }
          if (a.group && b.group) {
            return parseInt(a.group) - parseInt(b.group);
          }
          return a.summary.localeCompare(b.summary);
        });

        setFilteredEvents(events);
      }
    } catch (error) {
      console.error('Failed to fetch filtered events:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventTypeColor = (type: EventSummary['type']) => {
    switch (type) {
      case 'cours': return 'bg-blue-100 text-blue-800';
      case 'td': return 'bg-green-100 text-green-800';
      case 'tme': return 'bg-purple-100 text-purple-800';
      case 'exam': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEventTypeLabel = (type: EventSummary['type']) => {
    switch (type) {
      case 'cours': return 'Cours';
      case 'td': return 'TD';
      case 'tme': return 'TME';
      case 'exam': return 'Exam';
      default: return 'Other';
    }
  };

  const eventsByType = filteredEvents.reduce((acc, event) => {
    if (!acc[event.type]) acc[event.type] = [];
    acc[event.type].push(event);
    return acc;
  }, {} as { [key: string]: EventSummary[] });

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Filtered Events Preview</h3>
        <div className="flex gap-2">
          <button
            onClick={() => {
              fetchFilteredEvents();
              setShowPreview(true);
            }}
            disabled={loading || selectedCourses.length === 0}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : 'Preview Events'}
          </button>
          {showPreview && (
            <button
              onClick={() => setShowPreview(false)}
              className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
            >
              Hide Preview
            </button>
          )}
        </div>
      </div>

      {showPreview && (
        <div className="space-y-4">
          {filteredEvents.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              No events found. Try selecting courses and groups first.
            </p>
          ) : (
            <>
              <div className="bg-green-50 border border-green-200 rounded-md p-3">
                <div className="text-sm font-medium text-green-800">
                  Total Events: {filteredEvents.length} (deduplicated)
                </div>
                <div className="text-sm text-green-700 mt-1">
                  {Object.entries(eventsByType).map(([type, events]) => (
                    <span key={type} className="mr-4">
                      {getEventTypeLabel(type as EventSummary['type'])}: {events.length}
                    </span>
                  ))}
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto space-y-2">
                {Object.entries(eventsByType).map(([type, events]) => (
                  <div key={type}>
                    <h4 className="font-medium text-gray-900 mb-2">
                      {getEventTypeLabel(type as EventSummary['type'])} ({events.length})
                    </h4>
                    <div className="space-y-1 ml-4">
                      {events.map((event, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEventTypeColor(event.type)}`}>
                            {getEventTypeLabel(event.type)}{event.group ? ` ${event.group}` : ''}
                          </span>
                          <span className="text-sm text-gray-700 truncate">{event.summary}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
