'use client';

import React, { useState } from 'react';
import SimplifiedCalendarSelector from '@/components/SimplifiedCalendarSelector';
import FilteredEventsPreview from '@/components/FilteredEventsPreview';
import { FilterConfig } from '@/lib/types';

export default function Home() {
  const [courseGroups, setCourseGroups] = useState<{[courseId: string]: string}>({});
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [selectedMasters, setSelectedMasters] = useState<('DAC' | 'IMA' | 'ANDROIDE')[]>([]);

  const handleFilterChange = (filter: FilterConfig) => {
    setSelectedMasters(filter.masters as ('DAC' | 'IMA' | 'ANDROIDE')[]);
    setSelectedCourses(filter.courses);
    setCourseGroups(filter.courseGroups || {});
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <SimplifiedCalendarSelector
          onFilterChange={handleFilterChange}
          onPreview={() => {}}
          loading={false}
        />

        {/* Events Preview Section */}
        <div className="mt-4 sm:mt-8">
          <FilteredEventsPreview
            courseGroups={courseGroups}
            selectedCourses={selectedCourses}
            selectedMasters={selectedMasters}
          />
        </div>
      </div>
    </div>
  );
}
