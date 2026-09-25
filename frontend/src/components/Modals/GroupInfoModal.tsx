'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { api } from '@/lib/api';
import { Avatar } from '@/components/UI/Avatar';
import { toast } from '@/components/UI/Toast';
import {
  X,
  Shield,
  UserPlus,
  Trash2,
  LogOut,
  Users
} from 'lucide-react';

interface GroupInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GroupInfoModal({ isOpen, onClose }: GroupInfoModalProps) {
  const { user } = useAuth();
  const { activeConversation, selectConversation, fetchConversations } = useChat();
  const [showAddMember, setShowAddMember] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);

  if (!isOpen || !activeConversation) return null;

  const isGroup = activeConversation.is_group;
  const myPart = activeConversation.participants.find((p) => p.user_id === user?.id);
  const isAdmin = myPart?.role === 'admin';

  const handleOpenAddMember = async () => {
    try {
      const users = await api.getAllUsers();
      const existingIds = new Set(activeConversation.participants.map((p) => p.user_id));
      setAllUsers(users.filter((u) => !existingIds.has(u.id)));
      setShowAddMember(true);
    } catch {
      toast.error('Failed to load users');
    }
  };

  const handleAddMember = async (targetUserId: string) => {
    try {
      await api.addGroupMember(activeConversation.id, targetUserId);
      toast.success('Member added!');
      setShowAddMember(false);
      fetchConversations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    try {
      await api.removeGroupMember(activeConversation.id, targetUserId);
      toast.success('Member removed');
      fetchConversations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove member');
    }
  };

  const handleLeaveGroup = async () => {
    if (!user) return;
    try {
      await api.removeGroupMember(activeConversation.id, user.id);
      toast.info('You left the group');
      onClose();
      selectConversation(null);
      fetchConversations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to leave group');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-neutral-100 dark:bg-[#1f2023] border border-neutral-300 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
            {isGroup ? 'Group Info' : 'Chat Info'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-neutral-400 hover:text-neutral-800 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hero Card */}
        <div className="p-6 flex flex-col items-center text-center border-b border-neutral-200 dark:border-neutral-800 bg-neutral-200/40 dark:bg-neutral-900/40">
          <Avatar
            name={activeConversation.title || activeConversation.recipient?.display_name}
            src={activeConversation.avatar_url || activeConversation.recipient?.avatar_url}
            size="xl"
            isGroup={isGroup}
            isOnline={activeConversation.recipient?.is_online}
          />
          <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mt-3">
            {activeConversation.title || activeConversation.recipient?.display_name}
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            {isGroup
              ? `${activeConversation.participants.length} members`
              : activeConversation.recipient?.about || activeConversation.recipient?.phone_number}
          </p>
        </div>

        {/* Group Participants Section */}
        {isGroup && (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                {activeConversation.participants.length} Members
              </span>
              {isAdmin && !showAddMember && (
                <button
                  onClick={handleOpenAddMember}
                  className="flex items-center gap-1 text-xs text-blue-500 font-semibold hover:underline"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Member</span>
                </button>
              )}
            </div>

            {/* Add Member Dropdown */}
            {showAddMember && (
              <div className="p-3 rounded-xl bg-neutral-200/80 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>Add user to group</span>
                  <button onClick={() => setShowAddMember(false)} className="text-neutral-400">
                    ✕
                  </button>
                </div>
                {allUsers.length === 0 ? (
                  <p className="text-xs text-neutral-400">All available users are already in the group.</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {allUsers.map((u) => (
                      <div
                        key={u.id}
                        onClick={() => handleAddMember(u.id)}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-700 cursor-pointer text-xs"
                      >
                        <span className="font-medium">{u.display_name}</span>
                        <span className="text-[10px] text-blue-500 font-bold">+ Add</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Member List */}
            <div className="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
              {activeConversation.participants.map((p) => {
                const isTargetMe = p.user_id === user?.id;
                return (
                  <div key={p.id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        name={p.user.display_name}
                        src={p.user.avatar_url}
                        size="sm"
                        isOnline={p.user.is_online}
                      />
                      <div className="truncate">
                        <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate flex items-center gap-1.5">
                          <span>{p.user.display_name}</span>
                          {isTargetMe && <span className="text-[10px] text-neutral-400">(You)</span>}
                        </div>
                        <div className="text-[10px] text-neutral-500 truncate">@{p.user.username}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {p.role === 'admin' ? (
                        <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-bold border border-blue-500/20">
                          Admin
                        </span>
                      ) : null}

                      {/* Remove Button for Admin */}
                      {isAdmin && !isTargetMe && (
                        <button
                          onClick={() => handleRemoveMember(p.user_id)}
                          className="p-1 text-neutral-400 hover:text-red-500"
                          title="Remove from group"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Leave Group Action */}
            <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <button
                onClick={handleLeaveGroup}
                className="w-full py-2.5 rounded-xl border border-red-500/40 text-red-500 hover:bg-red-500/10 font-semibold text-xs transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Leave Group</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
