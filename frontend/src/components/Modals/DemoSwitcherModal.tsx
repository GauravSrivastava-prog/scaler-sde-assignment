'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { Avatar } from '@/components/UI/Avatar';
import { toast } from '@/components/UI/Toast';
import { X, Sparkles, Check } from 'lucide-react';

interface DemoSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EVALUATOR_ACCOUNTS = [
  { username: 'moxie', name: 'Moxie Marlinspike', role: 'Signal Founder', phone: '+15551234567', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Moxie&backgroundColor=2c6bed' },
  { username: 'edward', name: 'Edward Snowden', role: 'Privacy Advocate', phone: '+15559876543', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Edward&backgroundColor=0a84ff' },
  { username: 'alex', name: 'Alex Rivera', role: 'Scaler Lab AI Security Lead', phone: '+15553456789', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex&backgroundColor=30d158' },
  { username: 'sarah', name: 'Sarah Connor', role: 'Defense Engineer', phone: '+15552345678', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah&backgroundColor=5856d6' },
  { username: 'priya', name: 'Priya Sharma', role: 'Cryptographic Engineer', phone: '+15554567890', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Priya&backgroundColor=ff375f' },
  { username: 'ada', name: 'Ada Lovelace', role: 'Algorithm Pioneer', phone: '+15555678901', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ada&backgroundColor=bf5af2' },
];

export function DemoSwitcherModal({ isOpen, onClose }: DemoSwitcherModalProps) {
  const { user, switchDemoUser, isLoading } = useAuth();
  const { selectConversation } = useChat();

  if (!isOpen) return null;

  const handleSwitch = async (username: string) => {
    if (user?.username === username) {
      onClose();
      return;
    }
    try {
      selectConversation(null);
      await switchDemoUser(username);
      toast.success(`Switched identity to ${username}!`);
      onClose();
    } catch {
      toast.error('Failed to switch user');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-neutral-100 dark:bg-[#1f2023] border border-neutral-300 dark:border-neutral-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Evaluator Persona Switcher
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-neutral-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3 leading-relaxed">
            Click any seeded demo persona to instantaneously switch accounts. You can also open this URL in an Incognito window to test live bidirectional messaging between two users!
          </p>

          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto custom-scrollbar">
            {EVALUATOR_ACCOUNTS.map((acc) => {
              const isCurrent = user?.username === acc.username;
              return (
                <div
                  key={acc.username}
                  onClick={() => handleSwitch(acc.username)}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                    isCurrent
                      ? 'bg-blue-600/15 border border-blue-500/30'
                      : 'hover:bg-neutral-200 dark:hover:bg-neutral-800/80 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={acc.name} src={acc.avatar} size="md" />
                    <div className="truncate">
                      <div className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                        <span>{acc.name}</span>
                        {isCurrent && (
                          <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded-full font-bold">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-500 truncate">{acc.role}</div>
                      <div className="text-[10px] text-neutral-400 font-mono">{acc.phone}</div>
                    </div>
                  </div>

                  {isCurrent && <Check className="w-4 h-4 text-blue-500 stroke-[3]" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
