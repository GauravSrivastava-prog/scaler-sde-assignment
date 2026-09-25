'use client';

import React, { useMemo } from 'react';
import { useChat } from '@/context/ChatContext';
import { SidebarHeader } from './SidebarHeader';
import { ConversationTabs } from './ConversationTabs';
import { ConversationItem } from './ConversationItem';
import { MessageSquarePlus, Search } from 'lucide-react';

interface SidebarProps {
  onOpenNewChat: () => void;
  onOpenCreateGroup: () => void;
  onOpenSettings: () => void;
  onOpenDemoSwitcher: () => void;
}

export function Sidebar({
  onOpenNewChat,
  onOpenCreateGroup,
  onOpenSettings,
  onOpenDemoSwitcher,
}: SidebarProps) {
  const {
    conversations,
    activeFilter,
    searchQuery,
    isLoadingConversations,
  } = useChat();

  // Filter conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      // 1. Tab filter
      if (activeFilter === 'unread' && (!c.unread_count || c.unread_count === 0)) {
        return false;
      }
      if (activeFilter === 'groups' && !c.is_group) {
        return false;
      }

      // 2. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = c.title?.toLowerCase().includes(q);
        const recipientMatch = c.recipient?.display_name.toLowerCase().includes(q) || c.recipient?.username.toLowerCase().includes(q);
        const lastMsgMatch = c.last_message?.content?.toLowerCase().includes(q);
        return titleMatch || recipientMatch || lastMsgMatch;
      }

      return true;
    });
  }, [conversations, activeFilter, searchQuery]);

  return (
    <div className="flex flex-col h-full w-full sm:w-[340px] md:w-[380px] flex-shrink-0 bg-neutral-100/50 dark:bg-[#1b1c1e] border-r border-neutral-200/80 dark:border-neutral-800/80">
      {/* Header */}
      <SidebarHeader
        onOpenNewChat={onOpenNewChat}
        onOpenCreateGroup={onOpenCreateGroup}
        onOpenSettings={onOpenSettings}
        onOpenDemoSwitcher={onOpenDemoSwitcher}
      />

      {/* Tabs */}
      <ConversationTabs />

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto divide-y divide-neutral-200/40 dark:divide-neutral-800/40 custom-scrollbar">
        {isLoadingConversations && conversations.length === 0 ? (
          <div className="p-8 text-center text-neutral-400 text-xs flex flex-col items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span>Loading conversations...</span>
          </div>
        ) : filteredConversations.length > 0 ? (
          filteredConversations.map((c) => (
            <ConversationItem key={c.id} conversation={c} />
          ))
        ) : (
          <div className="p-8 text-center text-neutral-500 dark:text-neutral-400 text-xs flex flex-col items-center justify-center gap-3">
            {searchQuery ? (
              <>
                <Search className="w-8 h-8 text-neutral-400 stroke-[1.5]" />
                <p>No conversations match &ldquo;{searchQuery}&rdquo;</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center">
                  <MessageSquarePlus className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="font-semibold text-neutral-800 dark:text-neutral-200 text-sm">No chats here yet</p>
                  <p className="text-neutral-500 text-[11px] mt-0.5">Start a secure conversation with contacts</p>
                </div>
                <button
                  onClick={onOpenNewChat}
                  className="mt-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-sm transition-colors"
                >
                  Start New Chat
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
