'use client';

import React, { useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { Avatar } from '@/components/UI/Avatar';
import {
  Search,
  MessageSquarePlus,
  Users,
  Settings as SettingsIcon,
  Sparkles,
  X,
  Lock
} from 'lucide-react';

interface SidebarHeaderProps {
  onOpenNewChat: () => void;
  onOpenCreateGroup: () => void;
  onOpenSettings: () => void;
  onOpenDemoSwitcher: () => void;
}

export function SidebarHeader({
  onOpenNewChat,
  onOpenCreateGroup,
  onOpenSettings,
  onOpenDemoSwitcher,
}: SidebarHeaderProps) {
  const { user } = useAuth();
  const { searchQuery, setSearchQuery } = useChat();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global '/' keyboard shortcut to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col border-b border-neutral-200/60 dark:border-neutral-800/80 bg-neutral-100/80 dark:bg-neutral-900/90 select-none">
      {/* Top Bar with Avatar, Branding & Action Icons */}
      <div className="flex items-center justify-between px-3.5 pt-3 pb-2">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenSettings}
            className="group relative focus:outline-none"
            title="Account & Settings"
          >
            <Avatar
              name={user?.display_name}
              src={user?.avatar_url}
              size="sm"
              isOnline={true}
              className="ring-2 ring-transparent group-hover:ring-blue-500 transition-all"
            />
          </button>
          <div>
            <div className="flex items-center gap-1.5 font-bold text-base tracking-tight text-neutral-900 dark:text-white">
              <span>Signal</span>
              <Lock className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 -mt-0.5 truncate max-w-[120px]">
              {user?.display_name || user?.username}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-0.5 text-neutral-600 dark:text-neutral-300">
          <button
            onClick={onOpenDemoSwitcher}
            title="Switch Demo Account (Scaler Evaluator)"
            className="p-1.5 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-amber-500 dark:text-amber-400 hover:text-amber-600 transition-colors flex items-center gap-1 text-xs font-medium"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline text-[11px]">Demo</span>
          </button>

          <button
            onClick={onOpenNewChat}
            title="New Chat"
            className="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
          >
            <MessageSquarePlus className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenCreateGroup}
            title="New Group"
            className="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
          >
            <Users className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenSettings}
            title="Settings"
            className="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-3 pb-2.5 pt-1">
        <div className="relative flex items-center">
          <Search className="absolute left-3 w-4 h-4 text-neutral-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl bg-neutral-200/70 dark:bg-neutral-800/80 text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500/80 transition-all border border-transparent focus:border-blue-500/30"
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 text-neutral-400 hover:text-neutral-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="absolute right-2.5 hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-neutral-400 bg-neutral-300/40 dark:bg-neutral-700/40 rounded border border-neutral-300 dark:border-neutral-700 pointer-events-none">
              /
            </kbd>
          )}
        </div>
      </div>
    </div>
  );
}
