'use client';

import React, { useState } from 'react';
import { useChat } from '@/context/ChatContext';
import { toast } from '@/components/UI/Toast';
import { Timer, X, Check } from 'lucide-react';

interface DisappearingTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TIMER_OPTIONS = [
  { label: 'Off', seconds: 0 },
  { label: '30 seconds', seconds: 30 },
  { label: '5 minutes', seconds: 300 },
  { label: '1 hour', seconds: 3600 },
  { label: '8 hours', seconds: 28800 },
  { label: '1 day', seconds: 86400 },
  { label: '1 week', seconds: 604800 },
];

export function DisappearingTimerModal({ isOpen, onClose }: DisappearingTimerModalProps) {
  const { activeConversation, updateDisappearingTimer } = useChat();
  const [selectedTimer, setSelectedTimer] = useState<number>(
    activeConversation?.disappearing_messages_timer ?? 0
  );

  if (!isOpen || !activeConversation) return null;

  const handleSave = async () => {
    try {
      await updateDisappearingTimer(selectedTimer);
      toast.success('Disappearing messages timer updated');
      onClose();
    } catch {
      toast.error('Failed to update timer');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-sm rounded-2xl bg-neutral-100 dark:bg-[#1f2023] border border-neutral-300 dark:border-neutral-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <Timer className="w-5 h-5 text-blue-500" />
            <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Disappearing Messages
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-neutral-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3 leading-relaxed">
            When enabled, new messages sent and received in this chat will automatically disappear for both parties after they have been sent.
          </p>

          <div className="space-y-1">
            {TIMER_OPTIONS.map((opt) => {
              const isSelected = selectedTimer === opt.seconds;
              return (
                <div
                  key={opt.seconds}
                  onClick={() => setSelectedTimer(opt.seconds)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200'
                  }`}
                >
                  <span className="text-sm font-medium">{opt.label}</span>
                  {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-2 bg-neutral-200/30 dark:bg-neutral-900/30">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md transition-all"
          >
            Set Timer
          </button>
        </div>
      </div>
    </div>
  );
}
