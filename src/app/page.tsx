'use client';

import { useState, useCallback } from 'react';
import SimplifiedCalendarSelector from '@/components/SimplifiedCalendarSelector';
import CalendarPreview from '@/components/CalendarPreview';
import { FilterConfig } from '@/lib/types';
import { icsGenerator } from '@/lib/ics-generator';

export default function Home() {
  const [currentFilter, setCurrentFilter] = useState<FilterConfig | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatedCalendar, setGeneratedCalendar] = useState<{
    token: string;
    subscriptionUrl: string;
    name: string;
  } | null>(null);

  const handleFilterChange = useCallback((filter: FilterConfig) => {
    setCurrentFilter(filter);
    setShowPreview(false);
    setGeneratedCalendar(null);
  }, []);

  const handlePreview = useCallback(() => {
    if (currentFilter) {
      setShowPreview(true);
      // Smooth scroll to preview section after a short delay to allow render
      setTimeout(() => {
        const previewSection = document.getElementById('calendar-preview-section');
        if (previewSection) {
          previewSection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }
      }, 100);
    }
  }, [currentFilter]);

  const handleGenerateCalendar = async (name: string) => {
    if (!currentFilter) return;

    setLoading(true);
    try {
      const token = icsGenerator.generateToken();
      
      const response = await fetch(`/api/calendar/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          filter: currentFilter
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setGeneratedCalendar({
          token: data.token,
          subscriptionUrl: data.subscriptionUrl,
          name
        });
      } else {
        alert('Failed to generate calendar: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Calendar generation error:', error);
      alert('Failed to generate calendar. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {!generatedCalendar ? (
          <>
            <SimplifiedCalendarSelector
              onFilterChange={handleFilterChange}
              onPreview={handlePreview}
              loading={loading}
            />
            
            {showPreview && currentFilter && (
              <div id="calendar-preview-section" className="mt-8">
                <CalendarPreview
                  filter={currentFilter}
                  onGenerateCalendar={handleGenerateCalendar}
                  loading={loading}
                />
              </div>
            )}
          </>
        ) : (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-md p-6 text-center">
              <div className="mb-6">
                <svg className="h-16 w-16 text-green-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Calendar Generated Successfully!
                </h2>
                <p className="text-gray-600">
                  Your personalized Sorbonne calendar "{generatedCalendar.name}" is ready to use.
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-medium text-gray-900 mb-2">Subscription URL:</h3>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={generatedCalendar.subscriptionUrl}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-sm text-gray-900"
                  />
                  <button
                    onClick={() => copyToClipboard(generatedCalendar.subscriptionUrl)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className="space-y-4 text-left">
                <h3 className="font-medium text-gray-900">How to add to your calendar:</h3>
                
                <div className="space-y-3 text-sm text-gray-600">
                  <div>
                    <strong className="text-gray-900">Apple Calendar:</strong>
                    <ol className="list-decimal list-inside ml-4 mt-1 space-y-1">
                      <li>Open Calendar app</li>
                      <li>File → New Calendar Subscription</li>
                      <li>Paste the URL above and click Subscribe</li>
                    </ol>
                  </div>
                  
                  <div>
                    <strong className="text-gray-900">Google Calendar:</strong>
                    <ol className="list-decimal list-inside ml-4 mt-1 space-y-1">
                      <li>Open Google Calendar</li>
                      <li>Click "+" next to "Other calendars"</li>
                      <li>Select "From URL" and paste the URL above</li>
                    </ol>
                  </div>
                  
                  <div>
                    <strong className="text-gray-900">Outlook:</strong>
                    <ol className="list-decimal list-inside ml-4 mt-1 space-y-1">
                      <li>Open Outlook Calendar</li>
                      <li>Add Calendar → From Internet</li>
                      <li>Paste the URL above and click OK</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setGeneratedCalendar(null);
                    setShowPreview(false);
                  }}
                  className="bg-gray-600 text-white px-6 py-2 rounded-md hover:bg-gray-700"
                >
                  Create Another Calendar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
