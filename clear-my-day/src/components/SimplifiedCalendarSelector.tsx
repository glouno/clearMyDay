'use client';

import React, { useState, useEffect } from 'react';
import { FilterConfig } from '@/lib/types';
// import { SORBONNE_CALENDARS } from '@/lib/constants'; // Not needed in simplified version
import { getConfirmedM1Masters, getConfirmedM2Masters } from '@/lib/sorbonne-masters';
import FilteredEventsPreview from './FilteredEventsPreview';
import MasterLevelSelector, { MasterLevel } from './MasterLevelSelector';

interface SimplifiedCalendarSelectorProps {
  onFilterChange: (filter: FilterConfig) => void;
  onPreview: () => void;
  loading?: boolean;
}

export default function SimplifiedCalendarSelector({ onFilterChange, loading = false }: SimplifiedCalendarSelectorProps) {
  const [masterLevel, setMasterLevel] = useState<MasterLevel>('M1');
  const [selectedMasters, setSelectedMasters] = useState<string[]>(['DAC']);
  const [selectedCourses, setSelectedCourses] = useState<string[]>(['MLBDA']);
  const [courseGroups, setCourseGroups] = useState<{[courseId: string]: string}>({});
  const [calendarName, setCalendarName] = useState<string>('My Sorbonne Calendar');
  const [availableGroups, setAvailableGroups] = useState<{[courseId: string]: string[]}>({});
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Get available masters based on selected level
  const availableMasters = masterLevel === 'M1' ? getConfirmedM1Masters() : getConfirmedM2Masters();
  
  // Get available courses based on selected masters
  const availableCourses = selectedMasters.flatMap(masterId => {
    const master = availableMasters[masterId];
    return master ? master.courses : [];
  });

  // Reset selections when master level changes
  useEffect(() => {
    const firstMaster = Object.keys(availableMasters)[0];
    if (firstMaster) {
      setSelectedMasters([firstMaster]);
      const firstMasterCourses = availableMasters[firstMaster].courses;
      setSelectedCourses(firstMasterCourses.length > 0 ? [firstMasterCourses[0]] : []);
      setCourseGroups({});
    }
  }, [masterLevel]);

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
          if (courseData && courseData.groups) {
            const allGroups = new Set<string>();
            
            // Add TD groups
            if (courseData.groups.td) {
              courseData.groups.td.forEach((group: string) => allGroups.add(group));
            }
            
            // Add TME groups
            if (courseData.groups.tme) {
              courseData.groups.tme.forEach((group: string) => allGroups.add(group));
            }
            
            groupsMap[courseId] = Array.from(allGroups).sort((a, b) => parseInt(a) - parseInt(b));
          }
        });
        
        setAvailableGroups(groupsMap);
      } else {
        console.warn('Group detection failed:', data.error || 'Unknown error');
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

  const handleMasterChange = (masterId: string, checked: boolean) => {
    if (checked) {
      setSelectedMasters(prev => [...prev, masterId]);
      // Auto-select default courses for this master
      const master = availableMasters[masterId];
      if (master) {
        const defaultCourses = master.courses;
        setSelectedCourses(prev => [...new Set([...prev, ...defaultCourses])]);
      }
    } else {
      setSelectedMasters(prev => prev.filter(m => m !== masterId));
      // Remove courses from this master
      const master = availableMasters[masterId];
      if (master) {
        const coursesToRemove = master.courses;
        setSelectedCourses(prev => prev.filter(course => !coursesToRemove.includes(course)));
      }
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
    <div className="max-w-4xl mx-auto p-2 sm:p-6 space-y-4 sm:space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-3 sm:p-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">ClearMyDay</h1>
        <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">Filter your Sorbonne calendar</p>
        
        {/* Calendar Name */}
        <div className="mb-4 sm:mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Calendar Name
          </label>
          <input
            type="text"
            value={calendarName}
            onChange={(e) => setCalendarName(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
            placeholder="My Calendar"
          />
        </div>

        {/* Master Level Selection */}
        <MasterLevelSelector
          selectedLevel={masterLevel}
          onLevelChange={setMasterLevel}
          className="mb-6"
        />

        {/* Master Programs Selection */}
        <div className="mb-4 sm:mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Programs ({masterLevel})
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
            {Object.entries(availableMasters).map(([masterId, master]) => (
              <label key={masterId} className="flex items-center p-2 border rounded-md hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={selectedMasters.includes(masterId)}
                  onChange={(e) => handleMasterChange(masterId, e.target.checked)}
                  className="mr-2 flex-shrink-0"
                />
                <span className="text-xs sm:text-sm text-gray-700 truncate" title={master.name}>
                  {masterId}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Course Selection */}
        <div className="mb-4 sm:mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Courses
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {availableCourses.map(course => (
              <label key={course} className="flex items-center p-2 border rounded-md hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={selectedCourses.includes(course)}
                  onChange={(e) => handleCourseChange(course, e.target.checked)}
                  className="mr-2 flex-shrink-0"
                />
                <span className="text-xs sm:text-sm text-gray-700 truncate">{course}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Group Selection */}
        {selectedCourses.length > 0 && (
          <div className="mb-4 sm:mb-6">
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Groups
              </label>
              {isLoadingGroups && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              )}
            </div>
            <div className="space-y-2 sm:space-y-3">
              {selectedCourses.map(courseId => (
                <div key={courseId} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-2 border rounded-md">
                  <span className="text-sm font-medium text-gray-700 sm:w-20">{courseId}:</span>
                  <select
                    value={courseGroups[courseId] || ''}
                    onChange={(e) => updateCourseGroup(courseId, e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white flex-1 sm:flex-none"
                  >
                    <option value="">Select Group</option>
                    {availableGroups[courseId]?.map(group => (
                      <option key={group} value={group}>Group {group}</option>
                    ))}
                  </select>
                  {courseGroups[courseId] && (
                    <span className="text-xs text-green-600">
                      ✓ TD{courseGroups[courseId]} + TME{courseGroups[courseId]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          <button
            onClick={() => {
              setShowPreview(true);
              setTimeout(() => {
                const previewSection = document.getElementById('filtered-events-preview');
                if (previewSection) {
                  previewSection.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                  });
                }
              }, 100);
            }}
            disabled={loading || selectedCourses.length === 0}
            className="w-full sm:w-auto bg-blue-600 text-white px-4 sm:px-6 py-3 sm:py-2 text-sm sm:text-base rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Loading...' : 'Preview'}
          </button>
          <button
            onClick={generateCalendar}
            disabled={selectedCourses.length === 0}
            className="w-full sm:w-auto bg-green-600 text-white px-4 sm:px-6 py-3 sm:py-2 text-sm sm:text-base rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Generate Calendar
          </button>
        </div>
      </div>

      {/* Filtered Events Preview */}
      {showPreview && (
        <div id="filtered-events-preview">
          <FilteredEventsPreview
            courseGroups={courseGroups}
            selectedCourses={selectedCourses}
            selectedMasters={selectedMasters as ('DAC' | 'IMA' | 'ANDROIDE')[]}
          />
        </div>
      )}
    </div>
  );
}
