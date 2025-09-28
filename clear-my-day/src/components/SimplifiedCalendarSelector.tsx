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

  const detectAvailableGroups = async (retryCount = 0) => {
    setIsLoadingGroups(true);
    try {
      const response = await fetch(`/api/analyze-events?sources=${selectedMasters.join(',')}`, {
        // Increase timeout for frontend requests
        signal: AbortSignal.timeout(60000) // 60 seconds
      });
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
        setIsLoadingGroups(false);
      } else if (!data.success && retryCount < 2) {
        // Retry up to 2 times with exponential backoff
        console.log(`Group detection failed, retrying in ${(retryCount + 1) * 2} seconds...`);
        setTimeout(() => {
          detectAvailableGroups(retryCount + 1);
        }, (retryCount + 1) * 2000);
        return; // Don't set loading to false yet
      } else {
        console.warn('Group detection failed after retries:', data.error || 'Unknown error');
        setIsLoadingGroups(false);
      }
    } catch (error) {
      console.error('Failed to detect groups:', error);
      if (retryCount < 2) {
        // Retry on network errors too
        console.log(`Network error, retrying in ${(retryCount + 1) * 3} seconds...`);
        setTimeout(() => {
          detectAvailableGroups(retryCount + 1);
        }, (retryCount + 1) * 3000);
        return; // Don't set loading to false yet
      } else {
        setIsLoadingGroups(false);
      }
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
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
            placeholder="My Sorbonne Calendar"
          />
        </div>

        {/* Master Level Selection */}
        <MasterLevelSelector
          selectedLevel={masterLevel}
          onLevelChange={setMasterLevel}
          className="mb-6"
        />

        {/* Master Programs Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Master Programs ({masterLevel})
          </label>
          <div className="flex flex-wrap gap-4">
            {Object.entries(availableMasters).map(([masterId, master]) => (
              <label key={masterId} className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedMasters.includes(masterId)}
                  onChange={(e) => handleMasterChange(masterId, e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700 max-w-xs truncate" title={master.name}>
                  {master.name}
                </span>
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
                    className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
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
