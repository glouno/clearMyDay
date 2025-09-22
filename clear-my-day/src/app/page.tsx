'use client';

import React, { useState } from 'react';
import SimplifiedCalendarSelector from '@/components/SimplifiedCalendarSelector';
import WeeklyCalendarPreview from '@/components/WeeklyCalendarPreview';

export default function Home() {
  const [courseGroups, setCourseGroups] = useState<{[courseId: string]: string}>({});
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [selectedMasters, setSelectedMasters] = useState<('DAC' | 'IMA' | 'ANDROIDE')[]>([]);
  const [showWeeklyCalendar, setShowWeeklyCalendar] = useState(false);

  const handleFilterChange = (filter: any) => {
    setSelectedMasters(filter.masters);
    setSelectedCourses(filter.courses);
    setCourseGroups(filter.courseGroups || {});
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <SimplifiedCalendarSelector
          onFilterChange={handleFilterChange}
          onPreview={() => {}}
          loading={false}
        />

        {/* Weekly Calendar Preview Section */}
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Calendar Preview</h2>
            <button
              onClick={() => setShowWeeklyCalendar(!showWeeklyCalendar)}
              className="bg-purple-600 text-white px-6 py-2 rounded-md hover:bg-purple-700"
            >
              {showWeeklyCalendar ? 'Hide' : 'Show'} Weekly Calendar
            </button>
          </div>

          {showWeeklyCalendar && (
            <WeeklyCalendarPreview
              courseGroups={courseGroups}
              selectedCourses={selectedCourses}
              selectedMasters={selectedMasters}
            />
          )}
        </div>
      </div>
    </div>
  );
}
