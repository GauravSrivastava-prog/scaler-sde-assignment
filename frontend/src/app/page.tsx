'use client';

import React, { useState } from 'react';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { ChatWindow } from '@/components/Chat/ChatWindow';
import { AuthModal } from '@/components/Modals/AuthModal';
import { NewChatModal } from '@/components/Modals/NewChatModal';
import { CreateGroupModal } from '@/components/Modals/CreateGroupModal';
import { GroupInfoModal } from '@/components/Modals/GroupInfoModal';
import { DisappearingTimerModal } from '@/components/Modals/DisappearingTimerModal';
import { SettingsModal } from '@/components/Modals/SettingsModal';
import { DemoSwitcherModal } from '@/components/Modals/DemoSwitcherModal';
import { MediaModal } from '@/components/Modals/MediaModal';

export default function SignalApp() {
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
  const [isTimerModalOpen, setIsTimerModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDemoSwitcherOpen, setIsDemoSwitcherOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-white dark:bg-[#121315]">
      {/* Sidebar (Chat List & Search) */}
      <Sidebar
        onOpenNewChat={() => setIsNewChatOpen(true)}
        onOpenCreateGroup={() => setIsCreateGroupOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenDemoSwitcher={() => setIsDemoSwitcherOpen(true)}
      />

      {/* Main Chat Conversation View */}
      <ChatWindow
        onOpenTimerModal={() => setIsTimerModalOpen(true)}
        onOpenInfoModal={() => setIsGroupInfoOpen(true)}
        onOpenNewChat={() => setIsNewChatOpen(true)}
        onPreviewImage={(url) => setPreviewImageUrl(url)}
      />

      {/* Modals & Dialogs */}
      <AuthModal />

      <NewChatModal
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
      />

      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
      />

      <GroupInfoModal
        isOpen={isGroupInfoOpen}
        onClose={() => setIsGroupInfoOpen(false)}
      />

      <DisappearingTimerModal
        isOpen={isTimerModalOpen}
        onClose={() => setIsTimerModalOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <DemoSwitcherModal
        isOpen={isDemoSwitcherOpen}
        onClose={() => setIsDemoSwitcherOpen(false)}
      />

      <MediaModal
        url={previewImageUrl}
        onClose={() => setPreviewImageUrl(null)}
      />
    </main>
  );
}
