'use client';

import React, { useState, useEffect } from 'react';

/**
 * Warning banner for students accessing from Sorbonne WiFi network
 * Shows instructions to use mobile data instead
 */
export default function SorbonneWifiWarning() {
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    // Show warning after a short delay to check if page loads slowly
    // (indicating potential network issues)
    const timer = setTimeout(() => {
      // Always show the warning as we can't reliably detect Sorbonne network
      // Users not affected can easily dismiss it
      setShowWarning(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  if (!showWarning) return null;

  return (
    <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border-l-4 border-amber-500 p-4 mb-6 rounded-r-lg shadow-sm relative">
      <button
        onClick={() => setShowWarning(false)}
        className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xl leading-none"
        aria-label="Close"
      >
        ×
      </button>
      
      <div className="flex items-start gap-3 pr-6">
        <span className="text-2xl flex-shrink-0">📱</span>
        <div className="flex-1">
          <h3 className="font-semibold text-amber-900 mb-1">
            Sur le WiFi Sorbonne ?
          </h3>
          <p className="text-sm text-amber-800 mb-2">
            Le pare-feu de l&apos;université peut bloquer l&apos;accès à ce site. 
            Pour générer votre calendrier, utilisez vos <strong>données mobiles</strong> ou 
            un autre réseau WiFi (chez vous, dans un café, etc.).
          </p>
          <p className="text-xs text-amber-700">
            ✓ Une fois configuré, votre calendrier se synchronisera normalement, même sur le WiFi Sorbonne.
          </p>
        </div>
      </div>
    </div>
  );
}
