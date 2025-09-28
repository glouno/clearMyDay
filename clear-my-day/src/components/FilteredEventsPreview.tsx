'use client';

import React, { useState } from 'react';

interface EventSummary {
  summary: string;
  start: Date;
  end: Date;
  location: string;
  description: string;
}

interface FilteredEventsPreviewProps {
  courseGroups: { [courseId: string]: string };
  selectedCourses: string[];
  selectedMasters: string[];
}

export default function FilteredEventsPreview({ courseGroups, selectedCourses, selectedMasters }: FilteredEventsPreviewProps) {
  const [filteredEvents, setFilteredEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const fetchFilteredEvents = async () => {
    if (selectedCourses.length === 0 || selectedMasters.length === 0) return;

    setLoading(true);
    try {
      // Generate a preview calendar (no persistent storage)
      const response = await fetch('/api/preview-calendar', {
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
      
      if (data.success && data.preview && data.data.events) {
        // Use the events directly from the preview response
        const events = data.data.events.map((event: any) => ({
          summary: event.summary,
          start: new Date(event.start),
          end: new Date(event.end),
          location: event.location || '',
          description: event.description || ''
        }));
        setFilteredEvents(events.slice(0, 20)); // Show first 20 events
        console.log(`📊 Preview loaded: ${events.length} events`);
      } else {
        console.error('Failed to generate preview:', data.error);
      }
    } catch (error) {
      console.error('Error fetching filtered events:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Filtered Events Preview</h3>
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          {showPreview ? 'Hide Preview' : 'Show Preview'}
        </button>
      </div>

      {showPreview && (
        <>
          <div className="mb-4">
            <button
              onClick={fetchFilteredEvents}
              disabled={loading || selectedCourses.length === 0 || selectedMasters.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Loading...' : 'Fetch Events'}
            </button>
          </div>

          {/* Events List */}
          {filteredEvents.length > 0 && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              <div className="mb-2 text-sm text-gray-600">
                Showing {filteredEvents.length} events (preview)
              </div>
              {filteredEvents.map((event, index) => (
                <div key={index} className="p-3 border border-gray-200 rounded-md">
                  <div className="font-medium text-gray-900">{event.summary}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    {event.start.toLocaleDateString()} {event.start.toLocaleTimeString()} - {event.end.toLocaleTimeString()}
                  </div>
                  {event.location && (
                    <div className="text-sm text-gray-500 mt-1">📍 {event.location}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {filteredEvents.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500">
              No events found. Try selecting different courses or groups.
            </div>
          )}
        </>
      )}
    </div>
  );
}
