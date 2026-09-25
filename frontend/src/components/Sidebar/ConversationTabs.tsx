'use client';

import React from 'react';
import { useChat } from '@/context/ChatContext';

export function ConversationTabs() {
  const { conversations, activeFilter, setActiveFilter } = useChat();

  const unreadCount = conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);
  const groupsCount = conversations.filter((c) => c.is_group).length;

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 border-b border-neutral-200/60 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-900/40">
      <button
        onClick={() => setActiveFilter('all')}
        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
          activeFilter === 'all'
            ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-sm'
            : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60'
        }`}
      >
        All
      </button>

      <button
        onClick={() => setActiveFilter('unread')}
        className={`relative px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all ${
          activeFilter === 'unread'
            ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-sm'
            : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60'
        }`}
      >
        <span>Unread</span>
        {unreadCount > 0 && (
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeFilter === 'unread'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-600 text-white'
            }`}
          >
            {unreadCount}
          </span>
        )}
      </button>

      <button
        onClick={() => setActiveFilter('groups')}
        className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all ${
          activeFilter === 'groups'
            ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-sm'
            : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60'
        }`}
      >
        <span>Groups</span>
        {groupsCount > 0 && (
          <span className="text-[10px] opacity-75 font-semibold">({groupsCount})</span>
        )}
      </button>
    </div>
  );
}
