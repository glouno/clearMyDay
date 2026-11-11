'use client';

import React, { useState } from 'react';
import SimplifiedCalendarSelector from '@/components/SimplifiedCalendarSelector';
import SimpleCalendarPreview from '@/components/SimpleCalendarPreview';
import { FilterConfig } from '@/lib/types';

export default function Home() {
  const [courseGroups, setCourseGroups] = useState<{[courseId: string]: string}>({});
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [selectedMasters, setSelectedMasters] = useState<('DAC' | 'IMA' | 'ANDROIDE')[]>([]);
  const [showCalendarPreview, setShowCalendarPreview] = useState(false);

  const handleFilterChange = (filter: FilterConfig) => {
    setSelectedMasters(filter.masters as ('DAC' | 'IMA' | 'ANDROIDE')[]);
    setSelectedCourses(filter.courses);
    setCourseGroups(filter.courseGroups || {});
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <SimplifiedCalendarSelector
          onFilterChange={handleFilterChange}
          onPreview={() => setShowCalendarPreview(true)}
          loading={false}
        />

        {/* Simple Calendar Preview Section */}
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Calendar Preview</h2>
            <button
              onClick={() => setShowCalendarPreview(!showCalendarPreview)}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
            >
              {showCalendarPreview ? 'Hide' : 'Show'} Calendar Preview
            </button>
          </div>

          {showCalendarPreview && (
            <SimpleCalendarPreview
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
