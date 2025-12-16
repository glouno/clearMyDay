'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Image from 'next/image';
import { FilterConfig } from '@/lib/types';
import { getConfirmedM1Masters, getConfirmedM2Masters } from '@/lib/sorbonne-masters';
import MasterLevelSelector, { MasterLevel } from './MasterLevelSelector';

interface SimplifiedCalendarSelectorProps {
  onFilterChange: (filter: FilterConfig) => void;
  onPreview: () => void;
  loading?: boolean;
}

export default function SimplifiedCalendarSelector({ onFilterChange }: SimplifiedCalendarSelectorProps) {
  type SemesterPreset = 'ALL' | 'S1' | 'S2';

  const [masterLevel, setMasterLevel] = useState<MasterLevel>('M1');
  const [semesterPreset, setSemesterPreset] = useState<SemesterPreset>('ALL');
  const [selectedMasters, setSelectedMasters] = useState<string[]>(['DAC']);
  const [selectedCourses, setSelectedCourses] = useState<string[]>(['MLBDA']);
  const [courseGroups, setCourseGroups] = useState<{[courseId: string]: string}>({});
  const [calendarName, setCalendarName] = useState<string>('My Sorbonne Calendar');
  const [availableGroups, setAvailableGroups] = useState<{[courseId: string]: string[]}>({});
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [dynamicCoursesByMaster, setDynamicCoursesByMaster] = useState<{[masterId: string]: string[]}>({});
  const [isLoadingCourseCatalog, setIsLoadingCourseCatalog] = useState(false);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState('');

  // Get available masters based on selected level
  // Memoized because getConfirmed*M*Masters() returns a new object each call.
  // Without memoization, effects depending on availableMasters would run every render
  // and reset checkbox state.
  const availableMasters = useMemo(
    () => (masterLevel === 'M1' ? getConfirmedM1Masters() : getConfirmedM2Masters()),
    [masterLevel]
  );

  const getDateRange = useCallback(() => {
    const now = new Date();
    if (semesterPreset === 'ALL') {
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + 365);
      return { start: startDate, end: endDate };
    }

    const month = now.getMonth();
    const academicYearStart = month >= 7 ? now.getFullYear() : now.getFullYear() - 1;

    if (semesterPreset === 'S1') {
      return {
        start: new Date(academicYearStart, 8, 1),
        end: new Date(academicYearStart + 1, 1, 1)
      };
    }

    return {
      start: new Date(academicYearStart + 1, 1, 1),
      end: new Date(academicYearStart + 1, 6, 1)
    };
  }, [semesterPreset]);

  useEffect(() => {
    let cancelled = false;

    const fetchCourseCatalog = async () => {
      if (selectedMasters.length === 0) {
        setDynamicCoursesByMaster({});
        return;
      }

      setIsLoadingCourseCatalog(true);
      try {
        const range = getDateRange();
        const rangeQuery = semesterPreset === 'ALL'
          ? ''
          : `&start=${encodeURIComponent(range.start.toISOString())}&end=${encodeURIComponent(range.end.toISOString())}`;
        const response = await fetch(`/api/course-catalog?sources=${selectedMasters.join(',')}&minEvents=3${rangeQuery}`);
        const data = await response.json();

        if (!cancelled && data?.success && data?.data?.sources) {
          const next: {[masterId: string]: string[]} = {};

          Object.entries(data.data.sources).forEach(([source, sourceResult]) => {
            const result = sourceResult as { success?: boolean; discoveredCourses?: unknown };
            if (result?.success && Array.isArray(result?.discoveredCourses)) {
              next[source] = result.discoveredCourses;
            }
          });

          setDynamicCoursesByMaster(next);
        }
      } catch (error) {
        console.error('Failed to fetch course catalog:', error);
      } finally {
        if (!cancelled) {
          setIsLoadingCourseCatalog(false);
        }
      }
    };

    fetchCourseCatalog();

    return () => {
      cancelled = true;
    };
  }, [getDateRange, selectedMasters, semesterPreset]);
  
  // Get available courses based on selected masters with master context
  // For courses like OIP that appear in multiple masters, we need to show which master it belongs to
  const availableCoursesWithContext = useMemo(
    () => selectedMasters.flatMap(masterId => {
      const master = availableMasters[masterId];
      if (!master) return [];

      const discovered = dynamicCoursesByMaster[masterId] || [];
      const courseSet = new Set<string>([...discovered, ...master.courses]);
      const courses = Array.from(courseSet);

      // Extract short name from master ID (e.g., "DAC_M2" -> "DAC", "IMA_M2" -> "IMA")
      const shortName = masterId.replace('_M2', '').replace('_M1', '');

      return courses.map(course => ({
        // For OIP, make courseId unique per master so each OIP is independent
        courseId: course === 'OIP' ? `OIP-${masterId}` : course,
        masterId: masterId,
        displayName: course === 'OIP' ? `${course} (${shortName})` : course,
        // Unique key for courses that appear in multiple masters
        key: course === 'OIP' ? `${course}-${masterId}` : course,
        // Store original course name for backend filtering
        originalCourse: course
      }));
    }),
    [availableMasters, dynamicCoursesByMaster, selectedMasters]
  );
  
  // Remove duplicate non-OIP courses (keep all OIP variants)
  const availableCourses = availableCoursesWithContext.filter((courseObj, index, self) => {
    // For OIP courses, keep all variants (one per master)
    if (courseObj.courseId.startsWith('OIP-')) return true;
    // For other courses, keep only first occurrence
    return index === self.findIndex(c => c.courseId === courseObj.courseId);
  });

  // Reset selections when master level changes
  useEffect(() => {
    const firstMaster = Object.keys(availableMasters)[0];
    if (firstMaster) {
      const firstMasterCourses = availableMasters[firstMaster].courses;
      // Map OIP to OIP-masterId for first course
      const mappedCourses = firstMasterCourses.length > 0 
        ? [firstMasterCourses[0] === 'OIP' ? `OIP-${firstMaster}` : firstMasterCourses[0]]
        : [];

      const arraysEqual = (a: string[], b: string[]) => a.length === b.length && a.every((value, index) => value === b[index]);

      setSelectedMasters(prev => (arraysEqual(prev, [firstMaster]) ? prev : [firstMaster]));
      setSelectedCourses(prev => (arraysEqual(prev, mappedCourses) ? prev : mappedCourses));
      setCourseGroups(prev => (Object.keys(prev).length === 0 ? prev : {}));
    }
  }, [availableMasters, masterLevel]);

  // Update filter when selections change
  useEffect(() => {
    const range = getDateRange();

    // Map OIP-specific courseIds back to "OIP" for backend
    const backendCourses = selectedCourses.map(courseId => 
      courseId.startsWith('OIP-') ? 'OIP' : courseId
    );

    const oipGroups = Object.entries(courseGroups)
      .filter(([courseId]) => courseId.startsWith('OIP-'))
      .map(([, group]) => group);
    const uniqueOipGroups = new Set(oipGroups);

    const backendCourseGroups: {[courseId: string]: string} = {};
    Object.entries(courseGroups).forEach(([courseId, group]) => {
      if (courseId.startsWith('OIP-')) {
        return;
      }
      backendCourseGroups[courseId] = group;
    });
    if (uniqueOipGroups.size === 1) {
      backendCourseGroups['OIP'] = oipGroups[0];
    }

    const filter: FilterConfig = {
      masters: selectedMasters,
      courses: backendCourses,
      groups: { td: '', tme: '' }, // Empty legacy groups
      courseGroups: backendCourseGroups,
      dateRange: {
        start: range.start,
        end: range.end
      }
    };

    onFilterChange(filter);
  }, [courseGroups, getDateRange, onFilterChange, selectedCourses, selectedMasters]);

  // Debounced group detection
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const detectAvailableGroups = useCallback(async () => {
    setIsLoadingGroups(true);
    try {
      const response = await fetch(`/api/analyze-events?sources=${selectedMasters.join(',')}`);
      const data = await response.json();
      
      if (data.success && data.data?.courseAnalysis) {
        const groupsMap: {[courseId: string]: string[]} = {};
        
        selectedCourses.forEach(courseId => {
          const analysisCourseId = courseId.startsWith('OIP-') ? 'OIP' : courseId;
          const courseData = data.data.courseAnalysis[analysisCourseId];
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
  }, [selectedMasters, selectedCourses]);

  // Auto-detect groups in background when masters or courses change (with debounce)
  // This runs in the background without blocking page rendering
  useEffect(() => {
    if (selectedMasters.length > 0 && selectedCourses.length > 0) {
      // Clear existing timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Set new timeout for debounced group detection
      // 300ms is fast enough for UX while preventing spam requests
      debounceTimeoutRef.current = setTimeout(() => {
        // Run in background - won't block rendering
        detectAvailableGroups();
      }, 300); // Wait 300ms after last change
    }

    // Cleanup on unmount
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [selectedMasters, selectedCourses, detectAvailableGroups]);

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

  // Display name mapping for masters (cosmetic only, backend uses original IDs)
  const getMasterDisplayName = (masterId: string): string => {
    if (masterLevel === 'M1') {
      const displayNames: {[key: string]: string} = {
        'DAC': 'MIND',
        'ANDROIDE': 'AI2D',
        'SFPN': 'CCA'
      };
      return displayNames[masterId] || masterId;
    }
    if (masterLevel === 'M2') {
      const displayNames: {[key: string]: string} = {
        'SFPN_M2': 'CCA'
      };
      return displayNames[masterId] || masterId;
    }
    return masterId;
  };

  const handleMasterChange = (masterId: string, checked: boolean) => {
    if (checked) {
      setSelectedMasters(prev => [...prev, masterId]);
      // Auto-select default courses for this master (map OIP to OIP-masterId)
      const master = availableMasters[masterId];
      if (master) {
        const mappedCourses = master.courses.map(c => 
          c === 'OIP' ? `OIP-${masterId}` : c
        );
        setSelectedCourses(prev => [...new Set([...prev, ...mappedCourses])]);
      }
    } else {
      setSelectedMasters(prev => prev.filter(m => m !== masterId));
      // Remove courses from this master (including OIP-masterId)
      const master = availableMasters[masterId];
      if (master) {
        const coursesToRemove = master.courses.map(c => 
          c === 'OIP' ? `OIP-${masterId}` : c
        );
        setSelectedCourses(prev => prev.filter(course => !coursesToRemove.includes(course)));
      }
    }
  };

  const handleCourseChange = (courseId: string, checked: boolean) => {
    if (checked) {
      setSelectedCourses(prev => [...prev, courseId]);
    } else {
      setSelectedCourses(prev => prev.filter(c => c !== courseId));
      // Remove group selection for this course
      setCourseGroups(prev => {
        const newGroups = { ...prev };
        delete newGroups[courseId];
        return newGroups;
      });
    }
  };

  const generateCalendar = async () => {
    try {
      const range = getDateRange();

      const backendCourses = selectedCourses.map(courseId => 
        courseId.startsWith('OIP-') ? 'OIP' : courseId
      );

      const oipGroups = Object.entries(courseGroups)
        .filter(([courseId]) => courseId.startsWith('OIP-'))
        .map(([, group]) => group);
      const uniqueOipGroups = new Set(oipGroups);

      const backendCourseGroups: {[courseId: string]: string} = {};
      Object.entries(courseGroups).forEach(([courseId, group]) => {
        if (courseId.startsWith('OIP-')) {
          return;
        }
        backendCourseGroups[courseId] = group;
      });
      if (uniqueOipGroups.size === 1) {
        backendCourseGroups['OIP'] = oipGroups[0];
      }

      const response = await fetch('/api/generate-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: calendarName,
          filter: {
            masters: selectedMasters,
            courses: backendCourses,
            groups: { td: '', tme: '' }, // Required by FilterConfig interface
            courseGroups: backendCourseGroups,
            dateRange: {
              start: range.start,
              end: range.end
            }
          }
        })
      });

      const data = await response.json();
      if (data.success) {
        // Show modal with subscription URL and copy button
        setGeneratedUrl(data.data.subscriptionUrl);
        setShowUrlModal(true);
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
        {/* Header with logo */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">ClearMyDay</h1>
          <Image
            src="/logo.webp"
            alt="ClearMyDay Logo"
            width={64}
            height={64}
            className="w-12 h-12 sm:w-16 sm:h-16"
            priority
          />
        </div>
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

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Semester
          </label>
          <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
            <button
              type="button"
              onClick={() => setSemesterPreset('ALL')}
              className={`px-3 py-2 text-sm font-medium ${semesterPreset === 'ALL' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setSemesterPreset('S1')}
              className={`px-3 py-2 text-sm font-medium border-l border-gray-300 ${semesterPreset === 'S1' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              S1
            </button>
            <button
              type="button"
              onClick={() => setSemesterPreset('S2')}
              className={`px-3 py-2 text-sm font-medium border-l border-gray-300 ${semesterPreset === 'S2' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              S2
            </button>
          </div>
        </div>

        {/* Master Programs Selection */}
        <div className="mb-6 sm:mb-8">
          <label className="block text-base sm:text-lg font-semibold text-gray-900 mb-3">
            Master Programs ({masterLevel})
          </label>
          <div className="flex flex-wrap gap-3">
            {Object.entries(availableMasters).map(([masterId, master]) => (
              <label key={masterId} className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedMasters.includes(masterId)}
                  onChange={(e) => handleMasterChange(masterId, e.target.checked)}
                  className="mr-2 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm sm:text-base text-gray-700 font-medium" title={master.name}>
                  {getMasterDisplayName(masterId)}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Course Selection */}
        <div className="mb-6 sm:mb-8 pb-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-600">
              Courses
            </label>
            {isLoadingCourseCatalog && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            )}
            {selectedCourses.length > 0 && (
              <button
                onClick={() => {
                  setSelectedCourses([]);
                  setCourseGroups({});
                }}
                className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
              >
                Unselect All
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {availableCourses.map(courseObj => (
              <label key={courseObj.key} className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedCourses.includes(courseObj.courseId)}
                  onChange={(e) => handleCourseChange(courseObj.courseId, e.target.checked)}
                  className="mr-2 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{courseObj.displayName}</span>
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
            <div className="space-y-3">
              {selectedCourses.map(courseId => (
                <div key={courseId} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 bg-gray-50 p-3 rounded-md">
                  <span className="text-sm font-medium text-gray-700 sm:w-20">{courseId}:</span>
                  <select
                    value={courseGroups[courseId] || ''}
                    onChange={(e) => updateCourseGroup(courseId, e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white flex-1 sm:flex-none"
                  >
                    <option value="">All Groups</option>
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
            onClick={generateCalendar}
            disabled={selectedCourses.length === 0}
            className="w-full sm:w-auto bg-green-600 text-white px-4 sm:px-6 py-3 sm:py-2 text-sm sm:text-base rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Generate Calendar
          </button>
        </div>
      </div>

      {/* URL Modal */}
      {showUrlModal && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-xl flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white/80 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/20 max-w-2xl w-full p-6 sm:p-8 animate-scale-up">
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Calendar Generated Successfully! 🎉</h3>
            <p className="text-sm text-gray-600 mb-4">Copy the URL below and add it to your calendar app:</p>
            
            <div className="bg-white/60 backdrop-blur-md border border-gray-200/50 rounded-xl p-4 mb-5 shadow-inner">
              <p className="text-sm text-gray-800 break-all font-mono leading-relaxed">{generatedUrl}</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedUrl);
                  alert('URL copied to clipboard!');
                }}
                className="flex-1 bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 font-medium shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95"
              >
                📋 Copy URL
              </button>
              <button
                onClick={() => setShowUrlModal(false)}
                className="flex-1 bg-white/50 backdrop-blur-sm text-gray-700 px-5 py-2.5 rounded-xl hover:bg-white/70 font-medium border border-gray-200/50 transition-all duration-200 active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
