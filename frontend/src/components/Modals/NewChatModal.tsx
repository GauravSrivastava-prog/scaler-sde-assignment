'use client';

import React, { useState, useEffect } from 'react';
import { useChat } from '@/context/ChatContext';
import { api } from '@/lib/api';
import { User } from '@/lib/types';
import { Avatar } from '@/components/UI/Avatar';
import { toast } from '@/components/UI/Toast';
import { X, Search, UserPlus } from 'lucide-react';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewChatModal({ isOpen, onClose }: NewChatModalProps) {
  const { startDirectChat } = useChat();
  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [newContactPhone, setNewContactPhone] = useState('');
  const [showAddContact, setShowAddContact] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api
        .getAllUsers()
        .then((data) => setUsers(data))
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredUsers = users.filter((u) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      u.display_name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.phone_number.includes(q)
    );
  });

  const handleSelectUser = async (targetUser: User) => {
    try {
      await startDirectChat(targetUser.id);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to start chat');
    }
  };

  const handleAddContact = async () => {
    if (!newContactPhone.trim()) return;
    try {
      await api.addContact({ phone_or_username: newContactPhone.trim() });
      toast.success('Contact added!');
      setNewContactPhone('');
      setShowAddContact(false);
      // Refresh user list
      const updated = await api.getAllUsers();
      setUsers(updated);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add contact');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-neutral-100 dark:bg-[#1f2023] border border-neutral-300 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
            New Message
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-neutral-400 hover:text-neutral-800 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-neutral-200 dark:border-neutral-800/80">
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by name, username, or phone"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-neutral-200/60 dark:bg-neutral-800/90 border border-transparent focus:border-blue-500 focus:outline-none"
              autoFocus
            />
          </div>
        </div>

        {/* Add Contact Accordion */}
        <div className="px-4 py-2 bg-neutral-200/30 dark:bg-neutral-900/30 border-b border-neutral-200 dark:border-neutral-800/80">
          {!showAddContact ? (
            <button
              onClick={() => setShowAddContact(true)}
              className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add contact by phone number or username</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 py-1">
              <input
                type="text"
                value={newContactPhone}
                onChange={(e) => setNewContactPhone(e.target.value)}
                placeholder="+1555... or username"
                className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-neutral-200 dark:bg-neutral-800 focus:outline-none"
              />
              <button
                onClick={handleAddContact}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
              >
                Add
              </button>
              <button
                onClick={() => setShowAddContact(false)}
                className="p-1 text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Contact / User List */}
        <div className="flex-1 overflow-y-auto divide-y divide-neutral-200/40 dark:divide-neutral-800/40 custom-scrollbar p-1">
          {loading ? (
            <div className="p-8 text-center text-neutral-400 text-xs">
              <div className="w-5 h-5 mx-auto mb-2 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              Loading directory...
            </div>
          ) : filteredUsers.length > 0 ? (
            filteredUsers.map((u) => (
              <div
                key={u.id}
                onClick={() => handleSelectUser(u)}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60 cursor-pointer transition-colors"
              >
                <Avatar
                  name={u.display_name}
                  src={u.avatar_url}
                  size="md"
                  isOnline={u.is_online}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate">
                    {u.display_name}
                  </div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                    @{u.username} • {u.phone_number}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-neutral-400 text-xs">
              No matching users found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
