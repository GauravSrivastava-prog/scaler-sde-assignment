'use client';

import React, { useEffect, useRef } from 'react';
import { useChat } from '@/context/ChatContext';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { Lock } from 'lucide-react';

interface MessageListProps {
  onPreviewImage: (url: string) => void;
}

export function MessageList({ onPreviewImage }: MessageListProps) {
  const { activeConversation, activeMessages, typingUsers, isLoadingMessages } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages or typing changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length, typingUsers.length]);

  if (!activeConversation) return null;

  // Group messages with date separators
  const renderedItems: React.ReactNode[] = [];
  let lastDateStr = '';

  activeMessages.forEach((msg, idx) => {
    const msgDate = new Date(msg.created_at);
    const dateStr = msgDate.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });

    if (dateStr !== lastDateStr) {
      lastDateStr = dateStr;
      renderedItems.push(
        <div key={`date_${dateStr}_${idx}`} className="flex justify-center my-4 select-none">
          <span className="px-3 py-1 rounded-full bg-neutral-200/50 dark:bg-neutral-800/60 text-neutral-500 dark:text-neutral-400 text-[11px] font-medium tracking-wide">
            {dateStr}
          </span>
        </div>
      );
    }

    renderedItems.push(
      <MessageBubble
        key={msg.id || msg.temp_id || idx}
        message={msg}
        isGroup={activeConversation.is_group}
        onPreviewImage={onPreviewImage}
      />
    );
  });

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-2 py-4 custom-scrollbar flex flex-col justify-between"
    >
      <div>
        {/* End-to-End Encryption Security Banner */}
        <div className="flex justify-center my-4 px-6 animate-in fade-in duration-300">
          <div className="flex items-center gap-2 max-w-md px-4 py-2.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs text-center shadow-xs">
            <Lock className="w-4 h-4 flex-shrink-0" />
            <p className="leading-snug">
              Messages and calls are end-to-end encrypted. No one outside of this chat, not even Signal, can read or listen to them.
            </p>
          </div>
        </div>

        {/* Loading messages indicator */}
        {isLoadingMessages && activeMessages.length === 0 && (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Rendered messages & date dividers */}
        {renderedItems}
      </div>

      {/* Live Typing Indicator */}
      <div>
        <TypingIndicator typingUsers={typingUsers} />
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
