'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Avatar } from '@/components/UI/Avatar';
import { toast } from '@/components/UI/Toast';
import { sounds } from '@/lib/sound';
import {
  X,
  User,
  Moon,
  Sun,
  Shield,
  Bell,
  Info,
  LogOut,
  Check,
  Lock
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { user, theme, setTheme, updateUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'privacy' | 'sound' | 'about'>('profile');

  // Profile Form
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [about, setAbout] = useState(user?.about || '');
  const [isSaving, setIsSaving] = useState(false);

  // Settings Toggles
  const [readReceipts, setReadReceipts] = useState(true);
  const [typingIndicators, setTypingIndicators] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(sounds.enabled);

  if (!isOpen || !user) return null;

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const updated = await api.updateProfile({
        display_name: displayName.trim(),
        about: about.trim(),
      });
      updateUser(updated);
      toast.success('Profile updated successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleSound = (enabled: boolean) => {
    setSoundEnabled(enabled);
    sounds.enabled = enabled;
    if (enabled) {
      sounds.playSent();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-neutral-100 dark:bg-[#1f2023] border border-neutral-300 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[85vh]">
        {/* Left Tabs Sidebar */}
        <div className="w-full md:w-48 bg-neutral-200/50 dark:bg-neutral-900/60 p-3 border-b md:border-b-0 md:border-r border-neutral-200 dark:border-neutral-800 space-y-1">
          <div className="px-3 py-2 font-bold text-xs uppercase tracking-wider text-neutral-500">
            Settings
          </div>

          <button
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
              activeTab === 'profile'
                ? 'bg-blue-600 text-white'
                : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300/50 dark:hover:bg-neutral-800'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Profile</span>
          </button>

          <button
            onClick={() => setActiveTab('appearance')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
              activeTab === 'appearance'
                ? 'bg-blue-600 text-white'
                : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300/50 dark:hover:bg-neutral-800'
            }`}
          >
            {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            <span>Appearance</span>
          </button>

          <button
            onClick={() => setActiveTab('privacy')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
              activeTab === 'privacy'
                ? 'bg-blue-600 text-white'
                : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300/50 dark:hover:bg-neutral-800'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Privacy</span>
          </button>

          <button
            onClick={() => setActiveTab('sound')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
              activeTab === 'sound'
                ? 'bg-blue-600 text-white'
                : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300/50 dark:hover:bg-neutral-800'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Notifications</span>
          </button>

          <button
            onClick={() => setActiveTab('about')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
              activeTab === 'about'
                ? 'bg-blue-600 text-white'
                : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300/50 dark:hover:bg-neutral-800'
            }`}
          >
            <Info className="w-4 h-4" />
            <span>About</span>
          </button>

          <div className="pt-4 border-t border-neutral-300 dark:border-neutral-800 mt-2">
            <button
              onClick={() => {
                logout();
                onClose();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>
          </div>
        </div>

        {/* Right Content Panel */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
            <h3 className="text-base font-bold capitalize text-neutral-900 dark:text-neutral-100">
              {activeTab} Settings
            </h3>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-neutral-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-4">
            {/* PROFILE TAB */}
            {activeTab === 'profile' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar name={user.display_name} src={user.avatar_url} size="xl" />
                  <div>
                    <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                      {user.display_name}
                    </h4>
                    <p className="text-xs text-neutral-500">@{user.username}</p>
                    <p className="text-xs text-neutral-500 font-mono mt-0.5">{user.phone_number}</p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl bg-neutral-200/60 dark:bg-neutral-800 border border-transparent focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                      About
                    </label>
                    <textarea
                      rows={3}
                      value={about}
                      onChange={(e) => setAbout(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl bg-neutral-200/60 dark:bg-neutral-800 border border-transparent focus:border-blue-500 focus:outline-none resize-none"
                    />
                  </div>

                  <button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </div>
            )}

            {/* APPEARANCE TAB */}
            {activeTab === 'appearance' && (
              <div className="space-y-4">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Choose the color theme for Signal Desktop interface.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setTheme('dark')}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      theme === 'dark'
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-neutral-300 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <Moon className="w-5 h-5 text-blue-400" />
                      {theme === 'dark' && <Check className="w-4 h-4 text-blue-500 stroke-[3]" />}
                    </div>
                    <div className="font-bold text-sm">Dark Theme</div>
                    <div className="text-xs text-neutral-500 mt-0.5">Signal signature sleek dark mode</div>
                  </div>

                  <div
                    onClick={() => setTheme('light')}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      theme === 'light'
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-neutral-300 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <Sun className="w-5 h-5 text-amber-500" />
                      {theme === 'light' && <Check className="w-4 h-4 text-blue-500 stroke-[3]" />}
                    </div>
                    <div className="font-bold text-sm">Light Theme</div>
                    <div className="text-xs text-neutral-500 mt-0.5">High-contrast clean light mode</div>
                  </div>
                </div>
              </div>
            )}

            {/* PRIVACY TAB */}
            {activeTab === 'privacy' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-xs text-blue-400 flex items-start gap-2.5">
                  <Lock className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
                  <p>
                    All messages in Signal are end-to-end encrypted with simulated cryptographic ratchets and sealed sender architecture.
                  </p>
                </div>

                <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <div className="text-xs font-semibold">Read Receipts</div>
                      <div className="text-[11px] text-neutral-500">
                        Let people see when you have read their messages
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={readReceipts}
                      onChange={(e) => setReadReceipts(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 accent-blue-600"
                    />
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <div className="text-xs font-semibold">Typing Indicators</div>
                      <div className="text-[11px] text-neutral-500">
                        Show when you are typing a message
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={typingIndicators}
                      onChange={(e) => setTypingIndicators(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 accent-blue-600"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* NOTIFICATIONS TAB */}
            {activeTab === 'sound' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-neutral-200/50 dark:bg-neutral-800/60 border border-neutral-300 dark:border-neutral-700">
                  <div>
                    <div className="text-xs font-semibold">Sound Notifications</div>
                    <div className="text-[11px] text-neutral-500">
                      Play pleasant audio chime on message sent and received
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleSound(!soundEnabled)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                      soundEnabled ? 'bg-blue-600 text-white' : 'bg-neutral-300 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    {soundEnabled ? 'Enabled' : 'Muted'}
                  </button>
                </div>
              </div>
            )}

            {/* ABOUT TAB */}
            {activeTab === 'about' && (
              <div className="space-y-3 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                <div className="p-4 rounded-2xl bg-neutral-200/50 dark:bg-neutral-800/60 border border-neutral-300 dark:border-neutral-700">
                  <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 mb-1">
                    Signal Clone v1.0.0
                  </h4>
                  <p className="text-neutral-500 text-[11px]">
                    Built for Scaler Lab AI — Fullstack Software Engineer Evaluation
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <div><span className="font-semibold">Frontend:</span> Next.js 16 + React 19 + TypeScript</div>
                    <div><span className="font-semibold">Backend:</span> FastAPI + Python 3.9</div>
                    <div><span className="font-semibold">Database:</span> SQLite with Foreign Key PRAGMA</div>
                    <div><span className="font-semibold">Real-Time:</span> Native WebSockets Gateway</div>
                  </div>
                </div>

                <p className="text-[11px] text-neutral-500">
                  Designed to replicate Signal Desktop with extreme fidelity: 1-on-1 chats, group messaging, disappearing messages, reactions, quoted replies, file attachments, and delivery receipts.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
