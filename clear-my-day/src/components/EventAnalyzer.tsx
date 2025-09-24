'use client';

import React, { useState, useEffect } from 'react';

interface EventTypeAnalysis {
  [type: string]: {
    count: number;
    examples: string[];
    groups?: string[];
  };
}

interface CourseAnalysis {
  [courseId: string]: {
    totalEvents: number;
    eventTypes: EventTypeAnalysis;
  };
}

interface AnalysisData {
  totalEvents: number;
  courseAnalysis: CourseAnalysis;
  topPatterns: { pattern: string; count: number }[];
  eventTypes: {
    cours: number;
    td: number;
    tme: number;
    exam: number;
    soutenance: number;
    rattrapage: number;
    other: number;
  };
  fieldUsage?: { [field: string]: number };
  timezoneAnalysis?: {
    dstTransitionEvents: any[];
    october2024EventCount: number;
    october2024Events: any[];
    timezoneUsage: { [timezone: string]: number };
  };
}

interface FilterTestResult {
  originalCount: number;
  filteredCount: number;
  excludedEvents: string[];
  includedEventTypes: { [type: string]: number };
}

export default function EventAnalyzer() {
  const [selectedCourse, setSelectedCourse] = useState('MLBDA');
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [filterTest, setFilterTest] = useState<FilterTestResult | null>(null);
  const [selectedGroups, setSelectedGroups] = useState({ td: '3', tme: '3' });
  const [loading, setLoading] = useState(false);
  const [analyzeTimezones, setAnalyzeTimezones] = useState(false);
  const [analyzeFields, setAnalyzeFields] = useState(false);

  const fetchAnalysis = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sources: 'DAC',
        course: selectedCourse,
        ...(analyzeTimezones && { timezones: 'true' })
      });
      
      const response = await fetch(`/api/analyze-events?${params}`);
      const data = await response.json();
      if (data.success) {
        setAnalysisData(data.data);
        console.log('Analysis Data:', data.data);
      }
    } catch (error) {
      console.error('Failed to fetch analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const testFiltering = async () => {
    if (!selectedCourse) return;
    
    setLoading(true);
    try {
      // Generate a test calendar with the selected groups
      const generateResponse = await fetch('/api/generate-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Test Filter ${selectedCourse}`,
          filter: {
            masters: ['DAC'],
            courses: [selectedCourse],
            groups: { td: '', tme: '' }, // Required by FilterConfig interface
            courseGroups: {
              [selectedCourse]: selectedGroups
            },
            dateRange: {
              start: new Date('2024-01-01'),
              end: new Date('2025-12-31')
            }
          }
        })
      });

      const generateData = await generateResponse.json();
      if (generateData.success) {
        // Fetch the filtered calendar using relative URL to avoid CORS issues
        const token = generateData.data.token;
        const calendarResponse = await fetch(`/api/calendar/${token}`);
        const icsContent = await calendarResponse.text();
        
        // Parse the ICS content to count events
        const eventSummaries = icsContent.match(/SUMMARY:([^\r\n]+)/g) || [];
        const summaries = eventSummaries.map(line => line.replace('SUMMARY:', ''));
        
        // Analyze what was included/excluded
        const includedEventTypes: { [type: string]: number } = {};
        const excludedEvents: string[] = [];
        
        summaries.forEach(summary => {
          if (summary.toLowerCase().includes('cours')) {
            includedEventTypes.cours = (includedEventTypes.cours || 0) + 1;
          } else if (summary.toLowerCase().includes('exam')) {
            includedEventTypes.exam = (includedEventTypes.exam || 0) + 1;
          } else if (summary.match(/td\s*3/i)) {
            includedEventTypes.td3 = (includedEventTypes.td3 || 0) + 1;
          } else if (summary.match(/tme\s*3/i)) {
            includedEventTypes.tme3 = (includedEventTypes.tme3 || 0) + 1;
          } else if (summary.toLowerCase().includes('td') || summary.toLowerCase().includes('tme')) {
            excludedEvents.push(summary);
          } else {
            includedEventTypes.other = (includedEventTypes.other || 0) + 1;
          }
        });

        setFilterTest({
          originalCount: analysisData?.courseAnalysis[selectedCourse]?.totalEvents || 0,
          filteredCount: summaries.length,
          excludedEvents,
          includedEventTypes
        });
      }
    } catch (error) {
      console.error('Failed to test filtering:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, [selectedCourse]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Analyzing events...</span>
      </div>
    );
  }

  const courseData = analysisData?.courseAnalysis[selectedCourse];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Calendar Event Analyzer</h2>
        
        <div className="flex gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="MLBDA">MLBDA</option>
              <option value="IAMSI">IAMSI</option>
              <option value="ARF">ARF</option>
              <option value="TAL">TAL</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">TD Group</label>
            <select
              value={selectedGroups.td}
              onChange={(e) => setSelectedGroups(prev => ({ ...prev, td: e.target.value }))}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">TME Group</label>
            <select
              value={selectedGroups.tme}
              onChange={(e) => setSelectedGroups(prev => ({ ...prev, tme: e.target.value }))}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                checked={analyzeTimezones}
                onChange={(e) => setAnalyzeTimezones(e.target.checked)}
                className="mr-2"
              />
              Analyze DST Issues
            </label>
            <button
              onClick={testFiltering}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Test Filtering
            </button>
          </div>
        </div>
      </div>

      {courseData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {selectedCourse} Event Types ({courseData.totalEvents} total)
            </h3>
            
            <div className="space-y-3">
              {Object.entries(courseData.eventTypes).map(([type, data]) => (
                <div key={type} className="border-l-4 border-blue-500 pl-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900">{type}</span>
                    <span className="text-sm text-gray-600">{data.count} events</span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Examples: {data.examples.slice(0, 2).join(', ')}
                  </div>
                  {data.groups && (
                    <div className="text-sm text-blue-600 mt-1">
                      Groups: {data.groups.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {filterTest && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Filter Test Results
              </h3>
              
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                  <div className="text-sm font-medium text-green-800">Included Events</div>
                  <div className="text-lg font-bold text-green-900">
                    {filterTest.filteredCount} / {filterTest.originalCount}
                  </div>
                  <div className="text-sm text-green-700 mt-2">
                    {Object.entries(filterTest.includedEventTypes).map(([type, count]) => (
                      <div key={type}>{type}: {count}</div>
                    ))}
                  </div>
                </div>
                
                {filterTest.excludedEvents.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <div className="text-sm font-medium text-red-800">
                      Excluded Events ({filterTest.excludedEvents.length})
                    </div>
                    <div className="text-sm text-red-700 mt-2 max-h-32 overflow-y-auto">
                      {filterTest.excludedEvents.slice(0, 10).map((event, i) => (
                        <div key={i} className="truncate">{event}</div>
                      ))}
                      {filterTest.excludedEvents.length > 10 && (
                        <div className="text-xs text-red-600">
                          ... and {filterTest.excludedEvents.length - 10} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Field Usage Analysis */}
      {analysisData?.fieldUsage && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">ICS Field Usage Analysis</h3>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="text-sm text-gray-700 mb-3">
              <strong>Field Optimization Recommendations:</strong>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              {Object.entries(analysisData.fieldUsage)
                .sort((a, b) => b[1] - a[1])
                .map(([field, count]) => {
                  const isEssential = ['summary', 'start', 'end', 'uid', 'location', 'rrule', 'created', 'lastModified', 'dtstamp', 'status', 'recurrenceId', 'exdates', 'description'].includes(field);
                  return (
                    <div key={field} className={`flex justify-between p-2 rounded ${isEssential ? 'bg-green-100 border border-green-300' : 'bg-red-100 border border-red-300'}`}>
                      <span className="truncate">
                        {isEssential ? '✅ Keep' : '❌ Remove'} {field}
                      </span>
                      <span className="font-medium ml-2">{count}</span>
                    </div>
                  );
                })}
            </div>
            <div className="text-xs text-gray-600 mt-3">
              ✅ Essential fields for Apple Calendar compatibility | ❌ Unnecessary fields that can be removed
            </div>
          </div>
        </div>
      )}

      {/* Timezone Analysis */}
      {analysisData?.timezoneAnalysis && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">DST Transition Analysis (October 2024)</h3>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {analysisData.timezoneAnalysis.october2024EventCount}
                </div>
                <div className="text-sm text-gray-600">October 2024 Events</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {analysisData.timezoneAnalysis.dstTransitionEvents.length}
                </div>
                <div className="text-sm text-gray-600">DST Transition Events</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {Object.keys(analysisData.timezoneAnalysis.timezoneUsage).length}
                </div>
                <div className="text-sm text-gray-600">Timezones Used</div>
              </div>
            </div>
            
            {analysisData.timezoneAnalysis.dstTransitionEvents.length > 0 && (
              <div className="mt-4">
                <h5 className="font-medium text-gray-800 mb-2">
                  Events Around DST Change (Oct 20 - Nov 3, 2024):
                </h5>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {analysisData.timezoneAnalysis.dstTransitionEvents.slice(0, 15).map((event, index) => (
                    <div key={index} className="text-xs bg-white p-3 rounded border">
                      <div className="font-medium text-gray-900">{event.summary}</div>
                      <div className="text-gray-600 mt-1">
                        📅 {new Date(event.date).toLocaleString()} | 
                        🕐 {event.beforeDST ? 'Before DST (CEST)' : 'After DST (CET)'} | 
                        🌍 {event.timezone}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                  <div className="text-sm font-medium text-blue-800">
                    🔍 DST Analysis Results:
                  </div>
                  <div className="text-sm text-blue-700 mt-1">
                    • Events before Oct 27 2AM should be in CEST (UTC+2)
                    <br />
                    • Events after Oct 27 2AM should be in CET (UTC+1)
                    <br />
                    • Apple Calendar should automatically handle this transition
                    <br />
                    • If events appear to "shift" by 1 hour, it indicates proper DST handling
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {analysisData && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Common Event Patterns</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analysisData.topPatterns.slice(0, 10).map((pattern, i) => (
              <div key={i} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span className="font-mono text-sm">{pattern.pattern}</span>
                <span className="text-sm text-gray-600">{pattern.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
