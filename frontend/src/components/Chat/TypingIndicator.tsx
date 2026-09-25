'use client';

import React from 'react';

interface TypingIndicatorProps {
  typingUsers: { user_id: string; display_name: string }[];
}

export function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  if (!typingUsers || typingUsers.length === 0) return null;

  const names = typingUsers.map((u) => u.display_name.split(' ')[0]).join(', ');
  const label = typingUsers.length === 1 ? `${names} is typing` : `${names} are typing`;

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 animate-in fade-in duration-200">
      <div className="flex items-center gap-1 px-3 py-2 rounded-2xl bg-neutral-200/80 dark:bg-neutral-800/90 text-neutral-500 dark:text-neutral-400 text-xs shadow-sm">
        <span className="text-[11px] font-medium mr-1">{label}</span>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" />
        </div>
      </div>
    </div>
  );
}
