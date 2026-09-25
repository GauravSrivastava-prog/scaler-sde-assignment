'use client';

import React from 'react';
import { Conversation } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { Avatar } from '@/components/UI/Avatar';
import { StatusIcon } from '@/components/UI/StatusIcon';
import { formatConversationTime } from '@/lib/utils';
import { Timer, Image, Mic, FileText } from 'lucide-react';

interface ConversationItemProps {
  conversation: Conversation;
}

export function ConversationItem({ conversation }: ConversationItemProps) {
  const { user } = useAuth();
  const { activeConversationId, selectConversation, typingUsers } = useChat();

  const isSelected = activeConversationId === conversation.id;

  // Determine display name and avatar
  let title = conversation.title;
  let avatarUrl = conversation.avatar_url;
  let isOnline = false;

  if (!conversation.is_group) {
    if (conversation.recipient) {
      title = conversation.recipient.display_name;
      avatarUrl = conversation.recipient.avatar_url;
      isOnline = conversation.recipient.is_online;
    } else {
      title = 'Note to Self';
    }
  }

  // Format last message preview
  const lastMsg = conversation.last_message;
  const isMe = lastMsg?.sender_id === user?.id;

  // Check if someone in this chat is currently typing
  const isTyping = (conversation.id in typingUsers && (typingUsers as any).length > 0) || false;

  const renderSnippet = () => {
    if (isTyping) {
      return (
        <span className="text-blue-500 font-medium italic flex items-center gap-1 animate-pulse">
          typing...
        </span>
      );
    }

    if (!lastMsg) {
      return <span className="text-neutral-400 italic">No messages yet</span>;
    }

    if (lastMsg.is_deleted) {
      return <span className="italic text-neutral-400">This message was deleted</span>;
    }

    return (
      <div className="flex items-center gap-1 truncate">
        {isMe && lastMsg.message_type !== 'system' && (
          <StatusIcon status={lastMsg.status} className="w-3.5 h-3.5 flex-shrink-0" />
        )}
        {lastMsg.message_type === 'image' && (
          <span className="flex items-center gap-1 text-neutral-300">
            <Image className="w-3.5 h-3.5 flex-shrink-0" /> Photo
          </span>
        )}
        {lastMsg.message_type === 'audio' && (
          <span className="flex items-center gap-1 text-neutral-300">
            <Mic className="w-3.5 h-3.5 flex-shrink-0" /> Voice message
          </span>
        )}
        {lastMsg.message_type === 'file' && (
          <span className="flex items-center gap-1 text-neutral-300">
            <FileText className="w-3.5 h-3.5 flex-shrink-0" /> {lastMsg.attachment_name || 'File'}
          </span>
        )}
        {lastMsg.message_type === 'text' && (
          <span className="truncate">{lastMsg.content}</span>
        )}
        {lastMsg.message_type === 'system' && (
          <span className="italic truncate text-neutral-400">{lastMsg.content}</span>
        )}
      </div>
    );
  };

  return (
    <div
      onClick={() => selectConversation(conversation.id)}
      className={`group relative flex items-center gap-3 px-3.5 py-3 cursor-pointer select-none transition-colors border-l-3 ${
        isSelected
          ? 'bg-neutral-200/70 dark:bg-neutral-800/90 border-blue-600'
          : 'border-transparent hover:bg-neutral-100/70 dark:hover:bg-neutral-800/40'
      }`}
    >
      <Avatar
        name={title}
        src={avatarUrl}
        size="md"
        isOnline={isOnline}
        isGroup={conversation.is_group}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="font-semibold text-sm truncate text-neutral-900 dark:text-neutral-100">
            {title}
          </span>
          <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
            {conversation.disappearing_messages_timer > 0 && (
              <span title="Disappearing messages enabled">
                <Timer className="w-3 h-3 text-neutral-400" />
              </span>
            )}
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-normal">
              {formatConversationTime(conversation.updated_at)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          <div className="truncate flex-1">{renderSnippet()}</div>
          {conversation.unread_count > 0 && (
            <span className="px-1.5 py-0.5 min-w-[18px] text-center text-[10px] font-bold bg-blue-600 text-white rounded-full flex-shrink-0 shadow-sm animate-in zoom-in-50">
              {conversation.unread_count}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
