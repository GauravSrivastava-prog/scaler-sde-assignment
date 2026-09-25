'use client';

import React from 'react';
import { getInitials } from '@/lib/utils';

interface AvatarProps {
  name?: string | null;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  isGroup?: boolean;
  className?: string;
}

const sizeClasses = {
  xs: 'w-7 h-7 text-xs',
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
};

const badgeSizeClasses = {
  xs: 'w-2 h-2 right-0 bottom-0',
  sm: 'w-2.5 h-2.5 right-0 bottom-0',
  md: 'w-3 h-3 right-0.5 bottom-0.5 ring-2',
  lg: 'w-3.5 h-3.5 right-0.5 bottom-0.5 ring-2',
  xl: 'w-4 h-4 right-1 bottom-1 ring-3',
};

// Distinct background color palette for fallback avatars (Signal palette)
const bgColors = [
  'bg-blue-600',
  'bg-emerald-600',
  'bg-violet-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-cyan-600',
  'bg-indigo-600',
];

function getBgColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return bgColors[Math.abs(hash) % bgColors.length];
}

export function Avatar({
  name,
  src,
  size = 'md',
  isOnline,
  isGroup = false,
  className = '',
}: AvatarProps) {
  const initials = getInitials(name);
  const bgColor = getBgColor(name || 'signal');

  return (
    <div className={`relative inline-flex flex-shrink-0 ${className}`}>
      {src ? (
        <img
          src={src}
          alt={name || 'Avatar'}
          className={`${sizeClasses[size]} rounded-full object-cover bg-neutral-800 shadow-sm`}
          onError={(e) => {
            // Fallback to initials if image fails to load
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <div
          className={`${sizeClasses[size]} ${bgColor} rounded-full flex items-center justify-center font-semibold text-white tracking-wider shadow-sm`}
        >
          {initials}
        </div>
      )}

      {/* Online presence badge */}
      {isOnline !== undefined && !isGroup && (
        <span
          className={`absolute rounded-full ring-neutral-900 ${badgeSizeClasses[size]} ${
            isOnline ? 'bg-emerald-500' : 'bg-neutral-500'
          }`}
          title={isOnline ? 'Online' : 'Offline'}
        />
      )}

      {/* Group indicator badge */}
      {isGroup && (
        <span
          className={`absolute rounded-full ring-neutral-900 bg-neutral-700 text-white flex items-center justify-center ${badgeSizeClasses[size]}`}
          title="Group Conversation"
        >
          <span className="text-[8px] font-bold">#</span>
        </span>
      )}
    </div>
  );
}
