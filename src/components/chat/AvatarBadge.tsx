import React, { useState, useEffect } from 'react';
import { UserRole } from './types';
import { getPublicAvatarUrl, markAvatarUrlFailed } from '../../lib/userAvatarService';

interface AvatarBadgeProps {
  name?: string;
  avatarUrl?: string;
  role?: UserRole | string;
  isOnline?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'rounded';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<AvatarBadgeProps['size']>, string> = {
  xs: 'w-7 h-7 text-[11px]',
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
};

const DOT_CLASSES: Record<NonNullable<AvatarBadgeProps['size']>, string> = {
  xs: 'w-2 h-2 right-0 bottom-0 ring-1',
  sm: 'w-2.5 h-2.5 right-0 bottom-0 ring-2',
  md: 'w-3 h-3 right-0 bottom-0 ring-2',
  lg: 'w-3.5 h-3.5 right-0.5 bottom-0.5 ring-2',
  xl: 'w-4 h-4 right-1 bottom-1 ring-2',
};

const PALETTES = [
  'bg-indigo-600 text-white',
  'bg-emerald-700 text-white',
  'bg-sky-700 text-white',
  'bg-amber-700 text-white',
  'bg-teal-700 text-white',
  'bg-slate-700 text-white',
];

function getInitials(name?: string): string {
  const clean = String(name || 'EA').trim();
  if (!clean) return 'EA';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

function getPaletteIndex(name?: string, role?: string): number {
  const seed = `${name || ''}:${role || ''}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % PALETTES.length;
}

export const AvatarBadge: React.FC<AvatarBadgeProps> = ({
  name,
  avatarUrl,
  role,
  isOnline = false,
  size = 'md',
  shape = 'circle',
  className = '',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [avatarUrl]);

  const resolvedUrl = getPublicAvatarUrl(avatarUrl);
  const validUrl =
    typeof resolvedUrl === 'string' &&
    resolvedUrl.trim().length > 0 &&
    !resolvedUrl.includes('unsplash.com');

  const radiusClass = shape === 'circle' ? 'rounded-full' : 'rounded-2xl';
  const paletteClass = PALETTES[getPaletteIndex(name, role)];

  return (
    <div className={`relative inline-flex shrink-0 select-none ${SIZE_CLASSES[size]} ${className}`}>
      <div
        className={`w-full h-full ${radiusClass} overflow-hidden flex items-center justify-center font-semibold tracking-tight ${
          validUrl && !imgFailed ? 'bg-slate-200 dark:bg-slate-800' : paletteClass
        }`}
      >
        {validUrl && !imgFailed ? (
          <img
            src={resolvedUrl!}
            alt={name || 'Member avatar'}
            referrerPolicy="no-referrer"
            onError={() => {
              markAvatarUrlFailed(resolvedUrl);
              setImgFailed(true);
            }}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{getInitials(name)}</span>
        )}
      </div>
      {isOnline && (
        <span
          aria-label="Active now"
          className={`absolute ${DOT_CLASSES[size]} bg-emerald-500 rounded-full ring-white dark:ring-slate-900`}
        />
      )}
    </div>
  );
};
