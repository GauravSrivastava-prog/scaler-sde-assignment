'use client';

import React from 'react';
import { useChat } from '@/context/ChatContext';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { Lock, Shield, MessageSquare } from 'lucide-react';

interface ChatWindowProps {
  onOpenTimerModal: () => void;
  onOpenInfoModal: () => void;
  onOpenNewChat: () => void;
  onPreviewImage: (url: string) => void;
}

export function ChatWindow({
  onOpenTimerModal,
  onOpenInfoModal,
  onOpenNewChat,
  onPreviewImage,
}: ChatWindowProps) {
  const { activeConversation, isMobileChatOpen } = useChat();

  // If no conversation is active, render Signal Empty State
  if (!activeConversation) {
    return (
      <div className="hidden sm:flex flex-1 flex-col items-center justify-center p-8 bg-neutral-50 dark:bg-[#161719] text-center select-none">
        <div className="max-w-md flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-20 h-20 rounded-3xl bg-blue-600/10 dark:bg-blue-600/15 text-blue-600 flex items-center justify-center shadow-inner">
            <Lock className="w-10 h-10 stroke-[2]" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-100">
              Signal Messenger
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1.5 leading-relaxed">
              Select a conversation from the sidebar or start a new chat to begin messaging with end-to-end encryption.
            </p>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={onOpenNewChat}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-md transition-all hover:scale-105 active:scale-95"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Start New Chat</span>
            </button>
          </div>

          <div className="mt-8 flex items-center gap-2 text-xs text-neutral-400 dark:text-neutral-500">
            <Shield className="w-4 h-4 text-emerald-500" />
            <span>State-of-the-art security & privacy</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex-1 flex flex-col h-full bg-neutral-50 dark:bg-[#161719] ${
        !isMobileChatOpen ? 'hidden sm:flex' : 'flex'
      }`}
    >
      <ChatHeader
        onOpenTimerModal={onOpenTimerModal}
        onOpenInfoModal={onOpenInfoModal}
      />
      <MessageList onPreviewImage={onPreviewImage} />
      <MessageInput />
    </div>
  );
}
