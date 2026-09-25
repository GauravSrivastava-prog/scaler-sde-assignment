'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useChat } from '@/context/ChatContext';
import { useWebSocket } from '@/context/WebSocketContext';
import { api } from '@/lib/api';
import { toast } from '@/components/UI/Toast';
import {
  Send,
  Paperclip,
  Smile,
  Mic,
  X,
  FileText,
  Image as ImageIcon
} from 'lucide-react';

const COMMON_EMOJIS = ['😊', '😂', '🔥', '❤️', '👍', '🙏', '🎉', '🚀', '💯', '🔒', '👀', '✨', '👏', '🤔', '🙌', '💡'];

export function MessageInput() {
  const { activeConversationId, replyingTo, setReplyingTo, sendMessage } = useChat();
  const { sendTyping } = useWebSocket();

  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-focus input when conversation changes
  useEffect(() => {
    textareaRef.current?.focus();
    setText('');
    setShowEmojiPicker(false);
  }, [activeConversationId]);

  // Adjust textarea height dynamically
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
    }
  }, []);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    adjustHeight();

    if (!activeConversationId) return;

    // Send typing indicator with debounce
    sendTyping(activeConversationId, true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      sendTyping(activeConversationId, false);
    }, 2000);
  };

  const handleSend = async () => {
    if ((!text.trim() && !isUploading) || !activeConversationId) return;

    const messageText = text;
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      await sendMessage(messageText);
    } catch (err) {
      console.error('Failed to send message:', err);
      toast.error('Failed to send message');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversationId) return;

    setIsUploading(true);
    try {
      toast.info(`Uploading ${file.name}...`);
      const uploadRes = await api.uploadFile(file);

      await sendMessage(undefined, {
        url: uploadRes.url,
        filename: uploadRes.filename,
        size: uploadRes.size,
        mime: uploadRes.content_type,
        type: uploadRes.message_type,
      });

      toast.success('Attachment sent');
    } catch (err: any) {
      console.error('Upload failed:', err);
      toast.error(err.message || 'File upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Simulated Voice Note recording for Signal experience
  const handleVoiceRecord = () => {
    if (isRecording) {
      setIsRecording(false);
      // Create a simulated voice note message
      sendMessage(undefined, {
        url: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg',
        filename: 'Voice_Note.ogg',
        size: 38400,
        mime: 'audio/ogg',
        type: 'audio',
      });
      toast.success('Voice message sent');
    } else {
      setIsRecording(true);
      toast.info('Recording voice note... Click mic again to send');
    }
  };

  return (
    <div className="relative border-t border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-100/90 dark:bg-[#1a1b1e] px-4 py-2 select-none">
      {/* Quoted Message Preview Banner */}
      {replyingTo && (
        <div className="flex items-center justify-between mb-2 px-3 py-1.5 rounded-xl bg-neutral-200/70 dark:bg-neutral-800/80 border-l-4 border-blue-600 text-xs">
          <div className="min-w-0 pr-2">
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              Replying to {replyingTo.sender?.display_name || 'User'}
            </span>
            <p className="truncate text-neutral-600 dark:text-neutral-400 text-[11px] mt-0.5">
              {replyingTo.content || (replyingTo.message_type === 'image' ? '📷 Photo' : 'Attachment')}
            </p>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 rounded-full text-neutral-400 hover:text-neutral-800 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Emoji Picker Popover */}
      {showEmojiPicker && (
        <div className="absolute bottom-16 right-6 p-2 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 shadow-2xl z-30 grid grid-cols-8 gap-1.5 animate-in zoom-in-95 duration-150">
          {COMMON_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                setText((prev) => prev + emoji);
                setShowEmojiPicker(false);
                textareaRef.current?.focus();
              }}
              className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg text-lg hover:scale-125 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Main Input Row */}
      <div className="flex items-end gap-2">
        {/* Attachment Button */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileUpload}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="p-2.5 rounded-full text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/80 dark:hover:bg-neutral-800 transition-colors flex-shrink-0 disabled:opacity-50"
          title="Attach file or photo"
        >
          {isUploading ? (
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Paperclip className="w-5 h-5" />
          )}
        </button>

        {/* Input Pill Container */}
        <div className="flex-1 flex items-end bg-neutral-200/70 dark:bg-[#25272a] rounded-2xl px-3.5 py-1.5 focus-within:ring-1 focus-within:ring-blue-500/50 transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="Signal message"
            className="flex-1 bg-transparent text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 focus:outline-none resize-none max-h-36 py-1 leading-relaxed custom-scrollbar"
          />

          {/* Emoji Button */}
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors ml-1"
            title="Insert emoji"
          >
            <Smile className="w-5 h-5" />
          </button>
        </div>

        {/* Action: Send or Mic */}
        {text.trim() ? (
          <button
            onClick={handleSend}
            className="p-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all hover:scale-105 active:scale-95 flex-shrink-0"
            title="Send message (Enter)"
          >
            <Send className="w-5 h-5 ml-0.5" />
          </button>
        ) : (
          <button
            onClick={handleVoiceRecord}
            className={`p-2.5 rounded-full transition-all flex-shrink-0 ${
              isRecording
                ? 'bg-red-500 text-white animate-pulse'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/80 dark:hover:bg-neutral-800'
            }`}
            title={isRecording ? 'Stop recording & send' : 'Record voice message'}
          >
            <Mic className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
