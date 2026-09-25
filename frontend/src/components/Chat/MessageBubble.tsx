'use client';

import React, { useState } from 'react';
import { Message, Reaction } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { StatusIcon } from '@/components/UI/StatusIcon';
import { formatMessageTime, formatBytes } from '@/lib/utils';
import {
  Reply,
  Trash2,
  FileText,
  Download,
  Play,
  Pause,
  Timer,
  Smile
} from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  isGroup: boolean;
  onPreviewImage: (url: string) => void;
}

const QUICK_EMOJIS = ['❤️', '👍', '🔥', '😂', '😮', '😢'];

export function MessageBubble({ message, isGroup, onPreviewImage }: MessageBubbleProps) {
  const { user } = useAuth();
  const { setReplyingTo, toggleReaction, deleteMessage } = useChat();
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const isMe = message.sender_id === user?.id;

  // Handle system messages
  if (message.message_type === 'system') {
    return (
      <div className="flex justify-center my-3 animate-in fade-in duration-200">
        <span className="px-3 py-1 rounded-full bg-neutral-200/60 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 text-xs font-medium tracking-wide shadow-xs border border-neutral-300/40 dark:border-neutral-700/40 text-center max-w-md">
          {message.content}
        </span>
      </div>
    );
  }

  // Group reactions by emoji: { [emoji]: { count: number, hasReacted: boolean } }
  const groupedReactions = (message.reactions || []).reduce(
    (acc, r) => {
      if (!acc[r.emoji]) {
        acc[r.emoji] = { count: 0, hasReacted: false };
      }
      acc[r.emoji].count += 1;
      if (r.user_id === user?.id) {
        acc[r.emoji].hasReacted = true;
      }
      return acc;
    },
    {} as Record<string, { count: number; hasReacted: boolean }>
  );

  const handleAudioToggle = () => {
    if (!message.attachment_url) return;

    if (!audioElement) {
      const audio = new Audio(message.attachment_url);
      audio.onended = () => setIsPlayingAudio(false);
      audio.play();
      setAudioElement(audio);
      setIsPlayingAudio(true);
    } else {
      if (isPlayingAudio) {
        audioElement.pause();
        setIsPlayingAudio(false);
      } else {
        audioElement.play();
        setIsPlayingAudio(true);
      }
    }
  };

  return (
    <div
      className={`group relative flex flex-col mb-1.5 px-4 ${
        isMe ? 'items-end' : 'items-start'
      }`}
    >
      {/* Floating Action Menu on Hover */}
      <div
        className={`absolute -top-4 ${
          isMe ? 'right-6' : 'left-6'
        } hidden group-hover:flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 shadow-md z-20 backdrop-blur-md animate-in fade-in duration-100`}
      >
        {/* Quick Emoji Reactions */}
        {QUICK_EMOJIS.slice(0, 4).map((emoji) => (
          <button
            key={emoji}
            onClick={() => toggleReaction(message.id, emoji)}
            className="p-1 hover:scale-125 transition-transform text-xs"
            title={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}

        <button
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="p-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
          title="More reactions"
        >
          <Smile className="w-3.5 h-3.5" />
        </button>

        {/* Reply */}
        <button
          onClick={() => setReplyingTo(message)}
          className="p-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
          title="Reply"
        >
          <Reply className="w-3.5 h-3.5" />
        </button>

        {/* Delete (Own messages only) */}
        {isMe && !message.is_deleted && (
          <button
            onClick={() => deleteMessage(message.id)}
            className="p-1 text-red-500 hover:text-red-600"
            title="Delete message"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Popover More Emojis */}
      {showEmojiPicker && (
        <div
          className={`absolute -top-12 ${
            isMe ? 'right-6' : 'left-6'
          } flex items-center gap-1 p-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 shadow-xl z-30`}
        >
          {['🎉', '👏', '🙏', '💯', '🤔', '👀'].map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                toggleReaction(message.id, emoji);
                setShowEmojiPicker(false);
              }}
              className="p-1 hover:scale-125 transition-transform text-sm"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Bubble Container */}
      <div
        className={`relative max-w-[85%] sm:max-w-[70%] rounded-2xl px-3.5 py-2 shadow-xs transition-colors ${
          isMe
            ? 'bg-blue-600 text-white rounded-tr-xs'
            : 'bg-neutral-200/90 dark:bg-[#282a2d] text-neutral-900 dark:text-neutral-100 rounded-tl-xs'
        } ${message.is_deleted ? 'italic opacity-70' : ''}`}
      >
        {/* Sender Name in Group Chat */}
        {isGroup && !isMe && message.sender && (
          <div className="text-[11px] font-bold text-blue-500 dark:text-blue-400 mb-1 select-none">
            {message.sender.display_name}
          </div>
        )}

        {/* Quoted Message Card */}
        {message.reply_to && !message.is_deleted && (
          <div
            className={`mb-2 pl-2.5 pr-2 py-1 rounded-lg border-l-3 text-xs overflow-hidden select-none ${
              isMe
                ? 'bg-blue-700/40 border-blue-300 text-blue-100'
                : 'bg-neutral-300/60 dark:bg-neutral-700/40 border-blue-500 text-neutral-600 dark:text-neutral-300'
            }`}
          >
            <div className="font-semibold text-[11px]">
              {message.reply_to.sender_name || 'User'}
            </div>
            <div className="truncate text-[11px] opacity-90">
              {message.reply_to.message_type === 'image'
                ? '📷 Photo'
                : message.reply_to.message_type === 'audio'
                ? '🎙️ Voice note'
                : message.reply_to.content}
            </div>
          </div>
        )}

        {/* Media: Image Attachment */}
        {message.attachment_url && message.message_type === 'image' && !message.is_deleted && (
          <div className="mb-1.5 overflow-hidden rounded-xl cursor-pointer">
            <img
              src={message.attachment_url}
              alt="attachment"
              className="max-h-64 w-auto object-cover rounded-xl hover:opacity-95 transition-opacity"
              onClick={() => onPreviewImage(message.attachment_url!)}
            />
          </div>
        )}

        {/* Media: Audio Note */}
        {message.attachment_url && message.message_type === 'audio' && !message.is_deleted && (
          <div className="flex items-center gap-3 py-1 min-w-[200px]">
            <button
              onClick={handleAudioToggle}
              className={`p-2 rounded-full ${
                isMe
                  ? 'bg-white text-blue-600 hover:bg-neutral-100'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } transition-colors`}
            >
              {isPlayingAudio ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-0.5 h-6">
                {[40, 70, 30, 90, 60, 40, 80, 50, 65, 35, 75, 45, 95, 50].map((h, i) => (
                  <span
                    key={i}
                    style={{ height: `${h}%` }}
                    className={`w-1 rounded-full ${
                      isMe ? 'bg-blue-200/80' : 'bg-neutral-400 dark:bg-neutral-500'
                    } ${isPlayingAudio ? 'animate-pulse' : ''}`}
                  />
                ))}
              </div>
              <span className="text-[10px] opacity-80">Voice message</span>
            </div>
          </div>
        )}

        {/* Media: Document File */}
        {message.attachment_url && message.message_type === 'file' && !message.is_deleted && (
          <a
            href={message.attachment_url}
            target="_blank"
            rel="noopener noreferrer"
            download={message.attachment_name || 'file'}
            className={`flex items-center gap-3 p-2.5 rounded-xl mb-1.5 transition-colors ${
              isMe
                ? 'bg-blue-700/50 hover:bg-blue-700/70 text-white'
                : 'bg-neutral-300/50 dark:bg-neutral-700/50 hover:bg-neutral-300/70 dark:hover:bg-neutral-700/70'
            }`}
          >
            <FileText className="w-6 h-6 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{message.attachment_name || 'Document'}</div>
              <div className="text-[10px] opacity-75">{formatBytes(message.attachment_size)}</div>
            </div>
            <Download className="w-4 h-4 flex-shrink-0 opacity-80" />
          </a>
        )}

        {/* Text Content */}
        {message.content && (
          <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
          </div>
        )}

        {/* Message Meta: Timestamp & Receipts */}
        <div
          className={`flex items-center justify-end gap-1.5 mt-1 select-none text-[10px] ${
            isMe ? 'text-blue-100/90' : 'text-neutral-500 dark:text-neutral-400'
          }`}
        >
          {message.expires_at && (
            <span title="Disappearing message">
              <Timer className="w-2.5 h-2.5 opacity-80" />
            </span>
          )}
          <span>{formatMessageTime(message.created_at)}</span>
          {isMe && <StatusIcon status={message.status} />}
        </div>
      </div>

      {/* Reaction Badges Row */}
      {Object.keys(groupedReactions).length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1 -mb-1 px-1">
          {Object.entries(groupedReactions).map(([emoji, data]) => (
            <button
              key={emoji}
              onClick={() => toggleReaction(message.id, emoji)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-all ${
                data.hasReacted
                  ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-400 text-blue-600 dark:text-blue-300 shadow-xs'
                  : 'bg-neutral-100 dark:bg-neutral-800/90 border-neutral-300/70 dark:border-neutral-700/70 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200'
              }`}
            >
              <span>{emoji}</span>
              {data.count > 1 && <span className="text-[10px] font-bold">{data.count}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
