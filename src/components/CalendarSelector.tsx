'use client';

import { useState, useEffect } from 'react';
import { FilterConfig, GroupDetectionResult } from '@/lib/types';
import { SORBONNE_CALENDARS } from '@/lib/constants';

interface CalendarSelectorProps {
  onFilterChange: (filter: FilterConfig) => void;
  onPreview: () => void;
  loading?: boolean;
}

export default function CalendarSelector({ onFilterChange, onPreview, loading = false }: CalendarSelectorProps) {
  const [selectedMasters, setSelectedMasters] = useState<('DAC' | 'IMA' | 'ANDROIDE')[]>(['DAC']);
  const [selectedCourses, setSelectedCourses] = useState<string[]>(['MLBDA']);
  const [courseGroups, setCourseGroups] = useState<{[courseId: string]: string}>({});
  const [calendarName, setCalendarName] = useState<string>('My Sorbonne Calendar');
  const [detectedCourseGroups, setDetectedCourseGroups] = useState<{[courseId: string]: GroupDetectionResult}>({});
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);

  // Get available courses based on selected masters
  const availableCourses = selectedMasters.flatMap(master => 
    SORBONNE_CALENDARS[master].courses
  );

  // Update filter when selections change
  useEffect(() => {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 30);
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 365);

    const filter: FilterConfig = {
      masters: selectedMasters,
      courses: selectedCourses,
      groups: {}, // No global groups
      courseGroups: courseGroups,
      dateRange: {
        start: startDate,
        end: endDate
      }
    };

    onFilterChange(filter);
  }, [selectedMasters, selectedCourses, courseGroups]);

  // Auto-detect groups when masters or courses change
  useEffect(() => {
    if (selectedMasters.length > 0 && selectedCourses.length > 0) {
      detectGroupsForCourses();
    }
  }, [selectedMasters, selectedCourses]);

  const extractCourseFromEventSummary = (summary: string): string | null => {
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

  const detectGroupsForCourses = async () => {
    setIsLoadingGroups(true);
    try {
      const response = await fetch(`/api/fetch-calendar?sources=${selectedMasters.join(',')}&includeGroups=true`);
      const data = await response.json();
      
      if (data.success && data.data?.events) {
        // Analyze events to detect groups per course
        const courseGroupsMap: {[courseId: string]: {td: Set<string>, tme: Set<string>}} = {};
        
        // Process all events to detect groups per course
        data.data.events.forEach((event: any) => {
          const summary = event.summary;
          
          // Extract course from event using same logic as calendar parser
          const courseId = extractCourseFromEventSummary(summary);
          
          if (courseId && selectedCourses.includes(courseId)) {
            // Initialize course groups if not exists
            if (!courseGroupsMap[courseId]) {
              courseGroupsMap[courseId] = {
                td: new Set<string>(),
                tme: new Set<string>()
              };
            }
            
            // Extract TD groups using robust patterns
            const tdPatterns = [
              /4I\d+-TD(\d+)-/i,                    // 4I806-TD1-IAMSI
              /4I\d+\s*-\s*TD(\d+)\s+/i,           // 4I802 - TD2 ARF
              /MU4IN\d+-\w+-TD(\d+)/i,             // Future format
              /-TD(\d+)-/i,                        // Generic -TD1-
              /\bTD(\d+)\b/i                       // Generic TD1
            ];
            
            for (const pattern of tdPatterns) {
              const match = summary.match(pattern);
              if (match) {
                courseGroupsMap[courseId].td.add(match[1]);
                break;
              }
            }
            
            // Extract TME groups using robust patterns
            const tmePatterns = [
              /4I\d+-TME(\d+)-/i,                  // 4I806-TME1-IAMSI
              /4I\d+\s*-\s*TME(\d+)\s+/i,         // 4I802 -TME1 ARF
              /MU4IN\d+-\w+-TME(\d+)/i,           // MU4IN806-IAMSI-TME1
              /-TME(\d+)-?/i,                     // Generic -TME1-
              /\bTME(\d+)\b/i                     // Generic TME1
            ];
            
            for (const pattern of tmePatterns) {
              const match = summary.match(pattern);
              if (match) {
                courseGroupsMap[courseId].tme.add(match[1]);
                break;
              }
            }
          }
        });
        
        // Convert Sets to GroupDetectionResult format
        const finalCourseGroupsMap: {[courseId: string]: GroupDetectionResult} = {};
        Object.keys(courseGroupsMap).forEach(courseId => {
          finalCourseGroupsMap[courseId] = {
            td: Array.from(courseGroupsMap[courseId].td).sort(),
            tme: Array.from(courseGroupsMap[courseId].tme).sort(),
            other: []
          };
        });
        
        setDetectedCourseGroups(finalCourseGroupsMap);
      }
    } catch (error) {
      console.error('Failed to detect groups:', error);
    } finally {
      setIsLoadingGroups(false);
    }
  };

  const updateCourseGroup = (courseId: string, value: string) => {
    setCourseGroups(prev => ({
      ...prev,
      [courseId]: value === '' ? undefined : value
    }));
  };

  const handleMasterChange = (master: 'DAC' | 'IMA' | 'ANDROIDE', checked: boolean) => {
    if (checked) {
      setSelectedMasters(prev => [...prev, master]);
      // Auto-select default courses for this master
      const defaultCourses = SORBONNE_CALENDARS[master].courses;
      setSelectedCourses(prev => [...new Set([...prev, ...defaultCourses])]);
    } else {
      setSelectedMasters(prev => prev.filter(m => m !== master));
      // Remove courses from this master
      const coursesToRemove = SORBONNE_CALENDARS[master].courses;
      setSelectedCourses(prev => prev.filter(course => !coursesToRemove.includes(course)));
    }
  };

  const handleCourseChange = (course: string, checked: boolean) => {
    if (checked) {
      setSelectedCourses(prev => [...prev, course]);
    } else {
      setSelectedCourses(prev => prev.filter(c => c !== course));
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          ClearMyDay - Sorbonne Calendar Filter
        </h1>
        <p className="text-gray-600">
          Create your personalized calendar with only the classes you want to attend
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
        {/* Calendar Name */}
        <div>
          <label htmlFor="calendar-name" className="block text-sm font-medium text-gray-700 mb-2">
            Calendar Name
          </label>
          <input
            id="calendar-name"
            type="text"
            value={calendarName}
            onChange={(e) => setCalendarName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
            placeholder="My Sorbonne Calendar"
          />
        </div>

        {/* Master Selection */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">Select Masters</h3>
          <div className="space-y-3">
            {Object.entries(SORBONNE_CALENDARS).map(([key, master]) => (
              <label key={key} className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedMasters.includes(master.id)}
                  onChange={(e) => handleMasterChange(master.id, e.target.checked)}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <div>
                  <div className="font-medium text-gray-900">{master.id}</div>
                  <div className="text-sm text-gray-600">{master.name}</div>
                  <div className="text-xs text-gray-500">
                    Courses: {master.courses.join(', ')}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Course Selection */}
        {availableCourses.length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Select Courses</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {availableCourses.map((course) => (
                <label key={course} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCourses.includes(course)}
                    onChange={(e) => handleCourseChange(course, e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">{course}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Per-Course Group Selection */}
        {selectedCourses.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-4">Groups per Course</h4>
            <div className="space-y-4">
              {selectedCourses.map((course) => (
                <div key={course} className="p-4 bg-gray-50 rounded-lg">
                  <h5 className="font-medium text-gray-900 mb-3">{course}</h5>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        TD Group for {course}
                      </label>
                      <select
                        value={courseGroups[course]?.td || ''}
                        onChange={(e) => updateCourseGroup(course, 'td', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                      >
                        <option value="">Any TD Group</option>
                        {detectedCourseGroups[course]?.td.map((group: string) => (
                          <option key={group} value={group}>TD {group}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        TME Group for {course}
                      </label>
                      <select
                        value={courseGroups[course]?.tme || ''}
                        onChange={(e) => updateCourseGroup(course, 'tme', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                      >
                        <option value="">Any TME Group</option>
                        {detectedCourseGroups[course]?.tme.map((group: string) => (
                          <option key={group} value={group}>TME {group}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Group Detection Status */}
        {isLoadingGroups && (
          <div className="text-sm text-gray-500 flex items-center mb-4">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            Detecting available groups for selected courses...
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-4 pt-4">
          <button
            onClick={onPreview}
            disabled={loading || selectedMasters.length === 0}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Loading Preview...
              </div>
            ) : (
              'Preview Calendar'
            )}
          </button>
        </div>

        {/* Selection Summary */}
        <div className="bg-gray-50 p-4 rounded-md text-sm">
          <h4 className="font-medium text-gray-900 mb-2">Current Selection:</h4>
          <div className="space-y-1 text-gray-600">
            <div><strong>Masters:</strong> {selectedMasters.join(', ') || 'None'}</div>
            <div><strong>Courses:</strong> {selectedCourses.join(', ') || 'None'}</div>
            <div><strong>Groups:</strong> 
              {selectedCourses.length > 0 ? (
                <div className="mt-1 space-y-1">
                  {selectedCourses.map(course => {
                    const groups = courseGroups[course];
                    const tdGroup = groups?.td || 'Any';
                    const tmeGroup = groups?.tme || 'Any';
                    return (
                      <div key={course} className="ml-2">
                        {course}: TD {tdGroup}, TME {tmeGroup}
                      </div>
                    );
                  })}
                </div>
              ) : (
                ' No courses selected'
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
