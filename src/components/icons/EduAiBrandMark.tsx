import React from 'react';

interface EduAiBrandMarkProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

/**
 * Custom EduAI geometric scholarly emblem:
 * Combines an open folio book spine with an astrolabe horizon arc and ochre focal point.
 */
export function EduAiBrandMark({ className = 'w-6 h-6', ...props }: EduAiBrandMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Outer calibrated meridian arc */}
      <path
        d="M5.5 14.5C5.5 8.70101 10.201 4 16 4C21.799 4 26.5 8.70101 26.5 14.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeOpacity="0.9"
      />
      {/* Left open folio page */}
      <path
        d="M5 12.5C8.5 11.4 12.6 12.1 16 14.4V26C12.5 23.9 8.5 23.3 5 24.4V12.5Z"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinejoin="round"
      />
      {/* Right open folio page */}
      <path
        d="M27 12.5C23.5 11.4 19.4 12.1 16 14.4V26C19.5 23.9 23.5 23.3 27 24.4V12.5Z"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinejoin="round"
      />
      {/* Astrolabe compass needle / zenith star point */}
      <circle cx="16" cy="8.5" r="2" fill="#D97706" />
      <path
        d="M16 14.4V26"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
