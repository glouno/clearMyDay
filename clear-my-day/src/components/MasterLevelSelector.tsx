'use client';

import React from 'react';

export type MasterLevel = 'M1' | 'M2';

interface MasterLevelSelectorProps {
  selectedLevel: MasterLevel;
  onLevelChange: (level: MasterLevel) => void;
  className?: string;
}

export default function MasterLevelSelector({ 
  selectedLevel, 
  onLevelChange, 
  className = '' 
}: MasterLevelSelectorProps) {
  return (
    <div className={`flex flex-col space-y-3 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-800">
        Select Your Level
      </h3>
      
      <div className="flex space-x-3">
        <button
          onClick={() => onLevelChange('M1')}
          className={`
            px-6 py-3 rounded-lg font-medium transition-all duration-200 flex-1
            ${selectedLevel === 'M1'
              ? 'bg-blue-600 text-white shadow-lg transform scale-105'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-md'
            }
          `}
        >
          <div className="flex flex-col items-center space-y-1">
            <span className="text-lg font-bold">Master 1</span>
            <span className="text-sm opacity-90">First Year</span>
          </div>
        </button>
        
        <button
          onClick={() => onLevelChange('M2')}
          className={`
            px-6 py-3 rounded-lg font-medium transition-all duration-200 flex-1
            ${selectedLevel === 'M2'
              ? 'bg-blue-600 text-white shadow-lg transform scale-105'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-md'
            }
          `}
        >
          <div className="flex flex-col items-center space-y-1">
            <span className="text-lg font-bold">Master 2</span>
            <span className="text-sm opacity-90">Second Year</span>
          </div>
        </button>
      </div>
      
      <div className="text-sm text-gray-600 text-center">
        {selectedLevel === 'M1' 
          ? 'Choose your first year master program and courses'
          : 'Choose your second year master program and courses'
        }
      </div>
    </div>
  );
}
