'use client';

import React, { useState, useEffect } from 'react';
import { FilterConfig } from '@/lib/types';
import { SORBONNE_CALENDARS } from '@/lib/constants';
import FilteredEventsPreview from './FilteredEventsPreview';

interface SimplifiedCalendarSelectorProps {
  onFilterChange: (filter: FilterConfig) => void;
  onPreview: () => void;
  loading?: boolean;
}

export default function SimplifiedCalendarSelector({ onFilterChange, onPreview, loading = false }: SimplifiedCalendarSelectorProps) {
  const [selectedMasters, setSelectedMasters] = useState<('DAC' | 'IMA' | 'ANDROIDE')[]>(['DAC']);
  const [selectedCourses, setSelectedCourses] = useState<string[]>(['MLBDA']);
  const [courseGroups, setCourseGroups] = useState<{[courseId: string]: string}>({});
  const [calendarName, setCalendarName] = useState<string>('My Sorbonne Calendar');
  const [availableGroups, setAvailableGroups] = useState<{[courseId: string]: string[]}>({});
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
      groups: { td: '', tme: '' }, // Empty legacy groups
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
      detectAvailableGroups();
    }
  }, [selectedMasters, selectedCourses]);

  const detectAvailableGroups = async () => {
    setIsLoadingGroups(true);
    try {
      const response = await fetch(`/api/analyze-events?sources=${selectedMasters.join(',')}`);
      const data = await response.json();
      
      if (data.success && data.data?.courseAnalysis) {
        const groupsMap: {[courseId: string]: string[]} = {};
        
        selectedCourses.forEach(courseId => {
          const courseData = data.data.courseAnalysis[courseId];
          if (courseData) {
            const groups = new Set<string>();
            
            Object.keys(courseData.eventTypes).forEach(eventType => {
              const match = eventType.match(/^(td|tme)_(\d+)$/);
              if (match) {
                groups.add(match[2]);
              }
            });
            
            groupsMap[courseId] = Array.from(groups).sort();
          }
        });
        
        setAvailableGroups(groupsMap);
      }
    } catch (error) {
      console.error('Failed to detect groups:', error);
    } finally {
      setIsLoadingGroups(false);
    }
  };

  const updateCourseGroup = (courseId: string, value: string) => {
    setCourseGroups(prev => {
      const newGroups = { ...prev };
      if (value === '') {
        delete newGroups[courseId];
      } else {
        newGroups[courseId] = value;
      }
      return newGroups;
    });
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
      // Remove group selection for this course
      setCourseGroups(prev => {
        const newGroups = { ...prev };
        delete newGroups[course];
        return newGroups;
      });
    }
  };

  const generateCalendar = async () => {
    try {
      const response = await fetch('/api/generate-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: calendarName,
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
        // Show success message with subscription URL
        alert(`Calendar generated successfully!\n\nSubscription URL:\n${data.data.subscriptionUrl}\n\nYou can add this URL to your calendar app.`);
      } else {
        alert('Failed to generate calendar: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to generate calendar:', error);
      alert('Failed to generate calendar. Please try again.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Sorbonne Calendar Filter</h2>
        
        {/* Calendar Name */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Calendar Name
          </label>
          <input
            type="text"
            value={calendarName}
            onChange={(e) => setCalendarName(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="My Sorbonne Calendar"
          />
        </div>

        {/* Master Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Master Programs
          </label>
          <div className="flex flex-wrap gap-4">
            {Object.keys(SORBONNE_CALENDARS).map(master => (
              <label key={master} className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedMasters.includes(master as any)}
                  onChange={(e) => handleMasterChange(master as any, e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">{master}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Course Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Courses
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {availableCourses.map(course => (
              <label key={course} className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedCourses.includes(course)}
                  onChange={(e) => handleCourseChange(course, e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">{course}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Group Selection */}
        {selectedCourses.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Group Selection
              </label>
              {isLoadingGroups && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              )}
            </div>
            <div className="space-y-3">
              {selectedCourses.map(courseId => (
                <div key={courseId} className="flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-700 w-20">{courseId}:</span>
                  <select
                    value={courseGroups[courseId] || ''}
                    onChange={(e) => updateCourseGroup(courseId, e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Group</option>
                    {availableGroups[courseId]?.map(group => (
                      <option key={group} value={group}>Group {group}</option>
                    ))}
                  </select>
                  {courseGroups[courseId] && (
                    <span className="text-xs text-green-600">
                      ✓ Will include TD{courseGroups[courseId]} and TME{courseGroups[courseId]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={onPreview}
            disabled={loading || selectedCourses.length === 0}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : 'Preview Calendar'}
          </button>
          <button
            onClick={generateCalendar}
            disabled={selectedCourses.length === 0}
            className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Generate Calendar
          </button>
        </div>
      </div>

      {/* Filtered Events Preview */}
      <FilteredEventsPreview
        courseGroups={courseGroups}
        selectedCourses={selectedCourses}
        selectedMasters={selectedMasters}
      />
    </div>
  );
}
