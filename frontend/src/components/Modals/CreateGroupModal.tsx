'use client';

import React, { useState, useEffect } from 'react';
import { useChat } from '@/context/ChatContext';
import { api } from '@/lib/api';
import { User } from '@/lib/types';
import { Avatar } from '@/components/UI/Avatar';
import { toast } from '@/components/UI/Toast';
import { X, Search, Check, Users } from 'lucide-react';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateGroupModal({ isOpen, onClose }: CreateGroupModalProps) {
  const { createGroupChat } = useChat();
  const [title, setTitle] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.getAllUsers().then(setUsers).catch(console.error);
      setTitle('');
      setSelectedIds(new Set());
      setQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleUser = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error('Please enter a group title');
      return;
    }
    if (selectedIds.size === 0) {
      toast.error('Please select at least one member');
      return;
    }

    setIsLoading(true);
    try {
      await createGroupChat(title.trim(), Array.from(selectedIds));
      toast.success(`Group "${title}" created!`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create group');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return u.display_name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-neutral-100 dark:bg-[#1f2023] border border-neutral-300 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              New Group
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-neutral-400 hover:text-neutral-800 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Group Title Input */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-200/40 dark:bg-neutral-900/40">
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
            Group Name
          </label>
          <input
            type="text"
            placeholder="e.g. Core Engineering, Weekend Plan"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 focus:border-blue-500 focus:outline-none"
            autoFocus
          />
        </div>

        {/* Member Search */}
        <div className="p-3 border-b border-neutral-200 dark:border-neutral-800">
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search members to add"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-neutral-200/60 dark:bg-neutral-800 border border-transparent focus:outline-none"
            />
          </div>
        </div>

        {/* User Selection List */}
        <div className="flex-1 overflow-y-auto divide-y divide-neutral-200/40 dark:divide-neutral-800/40 custom-scrollbar p-1">
          {filteredUsers.map((u) => {
            const isSelected = selectedIds.has(u.id);
            return (
              <div
                key={u.id}
                onClick={() => toggleUser(u.id)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-blue-500/10 dark:bg-blue-500/15'
                    : 'hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={u.display_name} src={u.avatar_url} size="sm" isOnline={u.is_online} />
                  <div className="truncate">
                    <div className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate">
                      {u.display_name}
                    </div>
                    <div className="text-[11px] text-neutral-500 truncate">@{u.username}</div>
                  </div>
                </div>

                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                    isSelected ? 'bg-blue-600 text-white' : 'border border-neutral-400 dark:border-neutral-600'
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-200/30 dark:bg-neutral-900/30">
          <span className="text-xs text-neutral-500">
            {selectedIds.size} member{selectedIds.size === 1 ? '' : 's'} selected
          </span>
          <button
            onClick={handleCreate}
            disabled={isLoading || !title.trim() || selectedIds.size === 0}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50"
          >
            {isLoading ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
}
