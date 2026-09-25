'use client';

import React from 'react';
import { useChat } from '@/context/ChatContext';
import { Avatar } from '@/components/UI/Avatar';
import { formatTimerText } from '@/lib/utils';
import { toast } from '@/components/UI/Toast';
import {
  ChevronLeft,
  Phone,
  Video,
  Timer,
  MoreVertical,
  ShieldCheck,
  Users
} from 'lucide-react';

interface ChatHeaderProps {
  onOpenTimerModal: () => void;
  onOpenInfoModal: () => void;
}

export function ChatHeader({ onOpenTimerModal, onOpenInfoModal }: ChatHeaderProps) {
  const { activeConversation, setIsMobileChatOpen } = useChat();

  if (!activeConversation) return null;

  let title = activeConversation.title;
  let avatarUrl = activeConversation.avatar_url;
  let subtitle = '';
  let isOnline = false;

  if (activeConversation.is_group) {
    const memberCount = activeConversation.participants.length;
    const names = activeConversation.participants
      .map((p) => p.user.display_name.split(' ')[0])
      .slice(0, 3)
      .join(', ');
    subtitle = `${memberCount} members: ${names}${memberCount > 3 ? '...' : ''}`;
  } else {
    if (activeConversation.recipient) {
      title = activeConversation.recipient.display_name;
      avatarUrl = activeConversation.recipient.avatar_url;
      isOnline = activeConversation.recipient.is_online;
      subtitle = isOnline ? 'Online' : 'Offline';
    } else {
      title = 'Note to Self';
      subtitle = 'Personal encrypted notes & reminders';
    }
  }

  const timerText = formatTimerText(activeConversation.disappearing_messages_timer);

  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-100/90 dark:bg-[#1f2023] border-b border-neutral-200/80 dark:border-neutral-800/80 select-none shadow-xs z-10">
      {/* Left: Mobile back button + Avatar & Name */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => setIsMobileChatOpen(false)}
          className="sm:hidden p-1 -ml-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
          title="Back to chats"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <button
          onClick={onOpenInfoModal}
          className="flex items-center gap-3 text-left group focus:outline-none min-w-0"
        >
          <Avatar
            name={title}
            src={avatarUrl}
            size="md"
            isOnline={isOnline}
            isGroup={activeConversation.is_group}
          />

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-semibold text-sm text-neutral-900 dark:text-neutral-100 group-hover:text-blue-500 transition-colors">
              <span className="truncate">{title}</span>
              <span title="Signal E2EE Verified">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
              </span>
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
              {subtitle}
            </div>
          </div>
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1 text-neutral-600 dark:text-neutral-300">
        {/* Disappearing Messages Quick Action */}
        <button
          onClick={onOpenTimerModal}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeConversation.disappearing_messages_timer > 0
              ? 'bg-blue-600/15 text-blue-500 dark:text-blue-400'
              : 'hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500'
          }`}
          title="Disappearing Messages Setting"
        >
          <Timer className="w-4 h-4" />
          <span className="text-[11px]">{timerText}</span>
        </button>

        {/* Video Call (Placeholder) */}
        <button
          onClick={() => toast.info('Video calling is a simulated placeholder for this Signal demo.')}
          className="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
          title="Video Call"
        >
          <Video className="w-4 h-4" />
        </button>

        {/* Voice Call (Placeholder) */}
        <button
          onClick={() => toast.info('Voice calling is a simulated placeholder for this Signal demo.')}
          className="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
          title="Voice Call"
        >
          <Phone className="w-4 h-4" />
        </button>

        {/* Group / Contact Info */}
        <button
          onClick={onOpenInfoModal}
          className="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
          title={activeConversation.is_group ? 'Group Details' : 'Contact Details'}
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
