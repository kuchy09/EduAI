import React from 'react';

interface AppleIconProps extends React.SVGProps<SVGSVGElement> {
  filled: boolean;
}

export function AppleBooksHome({ filled, ...props }: AppleIconProps) {
  const scaleTransform = "translate(12, 12) scale(0.96) translate(-12, -12)";

  if (filled) {
    return (
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        fill="currentColor"
        {...props}
      >
        <g transform={scaleTransform}>
          <path d="M3 10.182V20a2 2 0 0 0 2 2h5V15h4v7h5a2 2 0 0 0 2-2v-9.818a2 2 0 0 0-.64-1.47l-7-6.222a2 2 0 0 0-2.72 0l-7 6.222A2 2 0 0 0 3 10.182z" />
        </g>
      </svg>
    );
  }
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="1.6" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      {...props}
    >
      <g transform={scaleTransform}>
        <path d="M3 10.182V20a2 2 0 0 0 2 2h5V15h4v7h5a2 2 0 0 0 2-2v-9.818a2 2 0 0 0-.64-1.47l-7-6.222a2 2 0 0 0-2.72 0l-7 6.222A2 2 0 0 0 3 10.182z" />
      </g>
    </svg>
  );
}

export function AppleBooksLibrary({ filled, ...props }: AppleIconProps) {
  const scaleTransform = "translate(12, 12) scale(0.96) translate(-12, -12)";
  
  if (filled) {
    return (
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        fill="currentColor"
        {...props}
      >
        <g transform={scaleTransform}>
          {/* Left Book */}
          <rect x="4.5" y="4.5" width="4" height="15" rx="1" />
          {/* Middle Book */}
          <rect x="10" y="3" width="4" height="16.5" rx="1" />
          {/* Right Book - leaning */}
          <g transform="translate(15.5, 3.5) rotate(15 2 7.5)">
            <rect x="0" y="0" width="4" height="15" rx="1" />
          </g>
        </g>
      </svg>
    );
  }
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="1.6" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      {...props}
    >
      <g transform={scaleTransform}>
        {/* Left Book */}
        <rect x="4.5" y="4.5" width="4" height="15" rx="1" />
        {/* Middle Book */}
        <rect x="10" y="3" width="4" height="16.5" rx="1" />
        {/* Right Book - leaning */}
        <g transform="translate(15.5, 3.5) rotate(15 2 7.5)">
          <rect x="0" y="0" width="4" height="15" rx="1" />
        </g>
      </g>
    </svg>
  );
}

export function AppleBooksGeminiAI({ filled, ...props }: AppleIconProps) {
  const scaleTransform = "translate(12, 12) scale(0.96) translate(-12, -12)";
  
  if (filled) {
    return (
      <svg 
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24" 
        fill="currentColor" 
        {...props}
      >
        <g transform={scaleTransform}>
          {/* Centered Large Sparkle only */}
          <path d="M12 4c0 4.5-3.5 8-8 8 4.5 0 8 3.5 8 8 0-4.5 3.5-8 8-8-4.5 0-8-3.5-8-8z" />
        </g>
      </svg>
    );
  }
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="1.6" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      {...props}
    >
      <g transform={scaleTransform}>
        {/* Centered Large Sparkle only */}
        <path d="M12 4c0 4.5-3.5 8-8 8 4.5 0 8 3.5 8 8 0-4.5 3.5-8 8-8-4.5 0-8-3.5-8-8z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </g>
    </svg>
  );
}

export function AppleBooksAudiobooks({ filled, ...props }: AppleIconProps) {
  const scaleTransform = "translate(12, 12) scale(0.96) translate(-12, -12)";

  if (filled) {
    return (
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        fill="currentColor"
        {...props}
      >
        <g transform={scaleTransform}>
          {/* Headband arc (thick) */}
          <path d="M12 2C6.48 2 2 6.48 2 12v3c0 .8.7 1.5 1.5 1.5h2c.8 0 1.5-.7 1.5-1.5v-5c0-.8-.7-1.5-1.5-1.5H3.1C3.6 7 7.4 4 12 4s8.4 3 8.9 4.5H18.5c-.8 0-1.5.7-1.5 1.5v5c0 .8.7 1.5 1.5 1.5h2c.8 0 1.5-.7 1.5-1.5v-3c0-5.52-4.48-10-10-10z" />
          {/* Left Earcup */}
          <rect x="2.5" y="11" width="4" height="7" rx="1.8" />
          {/* Right Earcup */}
          <rect x="17.5" y="11" width="4" height="7" rx="1.8" />
        </g>
      </svg>
    );
  }
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="1.6" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      {...props}
    >
      <g transform={scaleTransform}>
        {/* Curved headband */}
        <path d="M3 13.5C3 8.25 7.03 4 12 4s9 4.25 9 9.5" />
        {/* Left Earcup */}
        <rect x="2" y="12" width="3.8" height="6.5" rx="1.5" />
        {/* Right Earcup */}
        <rect x="18.2" y="12" width="3.8" height="6.5" rx="1.5" />
        {/* Tiny hinges connecting headband to cups */}
        <path d="M3.9 12V10.5" />
        <path d="M20.1 12V10.5" />
      </g>
    </svg>
  );
}

export function AppleBooksBookStore({ filled, ...props }: AppleIconProps) {
  const scaleTransform = "translate(12, 12) scale(0.96) translate(-12, -12)";

  if (filled) {
    return (
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        fill="currentColor"
        {...props}
      >
        <g transform={scaleTransform}>
          {/* Handle */}
          <path d="M8.5 8.5V6a3.5 3.5 0 0 1 7 0v2.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
          {/* Main Body */}
          <rect x="5" y="8" width="14" height="11.5" rx="2" />
          {/* Inner subtle embossed emblem: A miniature open book on the bag */}
          <path d="M10 12h1.5v3.5H10zm2.5 0H14v3.5h-1.5z" fill="white" fillOpacity="0.4" />
        </g>
      </svg>
    );
  }
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="1.6" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      {...props}
    >
      <g transform={scaleTransform}>
        {/* Handle */}
        <path d="M8.5 8.5V6a3.5 3.5 0 0 1 7 0v2.5" />
        {/* Body */}
        <rect x="5" y="8.5" width="14" height="11" rx="2.2" />
        {/* Subtle line-art design: small horizontal accent line */}
        <line x1="9" y1="13" x2="15" y2="13" strokeWidth="1.2" />
        <line x1="9" y1="16" x2="15" y2="16" strokeWidth="1.2" />
      </g>
    </svg>
  );
}
