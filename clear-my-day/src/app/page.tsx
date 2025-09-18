'use client';

import SimplifiedCalendarSelector from '@/components/SimplifiedCalendarSelector';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <SimplifiedCalendarSelector
          onFilterChange={() => {}}
          onPreview={() => {}}
          loading={false}
        />
      </div>
    </div>
  );
}
