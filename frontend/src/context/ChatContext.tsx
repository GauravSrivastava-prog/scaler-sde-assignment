'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Conversation, Message, Reaction } from '@/lib/types';
import { api } from '@/lib/api';
import { useAuth } from './AuthContext';
import { useWebSocket } from './WebSocketContext';

interface ChatContextType {
  conversations: Conversation[];
  activeConversationId: string | null;
  activeConversation: Conversation | null;
  activeMessages: Message[];
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  activeFilter: 'all' | 'unread' | 'groups';
  searchQuery: string;
  typingUsers: { user_id: string; display_name: string }[];
  isMobileChatOpen: boolean;
  replyingTo: Message | null;
  setReplyingTo: (msg: Message | null) => void;
  setActiveFilter: (filter: 'all' | 'unread' | 'groups') => void;
  setSearchQuery: (q: string) => void;
  setIsMobileChatOpen: (open: boolean) => void;
  selectConversation: (id: string | null) => void;
  fetchConversations: () => Promise<void>;
  fetchMessages: (convId: string) => Promise<void>;
  sendMessage: (content?: string, attachmentData?: {
    url: string;
    filename: string;
    size: number;
    mime: string;
    type: string;
  }) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  updateDisappearingTimer: (seconds: number) => Promise<void>;
  startDirectChat: (recipientUserId: string) => Promise<Conversation>;
  createGroupChat: (title: string, memberIds: string[], avatarUrl?: string) => Promise<Conversation>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { sendMessage: wsSendMessage, sendTyping, markRead, react: wsReact, subscribe } = useWebSocket();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>({});
  const [isLoadingConversations, setIsLoadingConversations] = useState<boolean>(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'groups'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typingMap, setTypingMap] = useState<Record<string, { user_id: string; display_name: string }[]>>({});
  const [isMobileChatOpen, setIsMobileChatOpen] = useState<boolean>(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  const typingTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Active conversation object
  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === activeConversationId) || null;
  }, [conversations, activeConversationId]);

  // Messages for active conversation
  const activeMessages = useMemo(() => {
    return activeConversationId ? messagesMap[activeConversationId] || [] : [];
  }, [activeConversationId, messagesMap]);

  // Typing users for active conversation
  const typingUsers = useMemo(() => {
    return activeConversationId ? typingMap[activeConversationId] || [] : [];
  }, [activeConversationId, typingMap]);

  // Fetch all conversations
  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setIsLoadingConversations(true);
    try {
      const data = await api.getConversations();
      setConversations(data);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [user]);

  // Fetch messages for a specific conversation
  const fetchMessages = useCallback(async (convId: string) => {
    setIsLoadingMessages(true);
    try {
      const msgs = await api.getMessages(convId);
      setMessagesMap((prev) => ({
        ...prev,
        [convId]: msgs,
      }));
    } catch (err) {
      console.error(`Failed to fetch messages for ${convId}:`, err);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (user) {
      fetchConversations();
    } else {
      setConversations([]);
      setActiveConversationId(null);
      setMessagesMap({});
    }
  }, [user, fetchConversations]);

  // Select conversation and mark as read
  const selectConversation = useCallback(
    (id: string | null) => {
      setActiveConversationId(id);
      setIsMobileChatOpen(Boolean(id));
      setReplyingTo(null);

      if (id) {
        // Mark conversation as read in state
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c))
        );
        fetchMessages(id);
        markRead(id);
      }
    },
    [fetchMessages, markRead]
  );

  // Auto-select first conversation if none active on desktop
  useEffect(() => {
    if (conversations.length > 0 && !activeConversationId && typeof window !== 'undefined' && window.innerWidth >= 640) {
      selectConversation(conversations[0].id);
    }
  }, [conversations, activeConversationId, selectConversation]);

  // Subscribe to WebSocket events
  useEffect(() => {
    const unsubNewMessage = subscribe('new_message', (payload: { message: Message; temp_id?: string }) => {
      const { message, temp_id } = payload;
      const convId = message.conversation_id;

      // 1. Update messages map
      setMessagesMap((prev) => {
        const existing = prev[convId] || [];
        // Check if optimistic message matches temp_id
        if (temp_id) {
          const index = existing.findIndex((m) => m.temp_id === temp_id || m.id === message.id);
          if (index !== -1) {
            const next = [...existing];
            next[index] = message;
            return { ...prev, [convId]: next };
          }
        }
        // Avoid duplicate message IDs
        if (existing.some((m) => m.id === message.id)) {
          return prev;
        }
        return {
          ...prev,
          [convId]: [...existing, message],
        };
      });

      // 2. Update conversation list preview & unread counts
      setConversations((prev) => {
        const index = prev.findIndex((c) => c.id === convId);
        if (index === -1) {
          // If conversation not in list, re-fetch
          fetchConversations();
          return prev;
        }

        const conv = prev[index];
        const isCurrentActive = convId === activeConversationId;
        const unreadCount = isCurrentActive || message.sender_id === user?.id ? 0 : conv.unread_count + 1;

        const updatedConv: Conversation = {
          ...conv,
          last_message: message,
          updated_at: message.created_at,
          unread_count: unreadCount,
        };

        const next = [...prev];
        next.splice(index, 1);
        next.unshift(updatedConv); // Move to top
        return next;
      });

      // If incoming message is in active conversation, automatically send markRead
      if (convId === activeConversationId && message.sender_id !== user?.id) {
        markRead(convId);
      }
    });

    const unsubStatusUpdate = subscribe('message_status_updated', (payload: {
      conversation_id: string;
      message_ids: string[];
      status: 'delivered' | 'read';
    }) => {
      const { conversation_id, message_ids, status } = payload;
      setMessagesMap((prev) => {
        const existing = prev[conversation_id];
        if (!existing) return prev;
        const updated = existing.map((m) => {
          if (message_ids.includes(m.id)) {
            return { ...m, status };
          }
          return m;
        });
        return { ...prev, [conversation_id]: updated };
      });
    });

    const unsubReaction = subscribe('reaction_updated', (payload: {
      message_id: string;
      conversation_id: string;
      reactions: Reaction[];
    }) => {
      const { message_id, conversation_id, reactions } = payload;
      setMessagesMap((prev) => {
        const existing = prev[conversation_id];
        if (!existing) return prev;
        const updated = existing.map((m) => (m.id === message_id ? { ...m, reactions } : m));
        return { ...prev, [conversation_id]: updated };
      });
    });

    const unsubTyping = subscribe('typing_indicator', (payload: {
      conversation_id: string;
      user_id: string;
      display_name: string;
      is_typing: boolean;
    }) => {
      const { conversation_id, user_id, display_name, is_typing } = payload;
      setTypingMap((prev) => {
        const current = prev[conversation_id] || [];
        const key = `${conversation_id}_${user_id}`;

        if (typingTimeoutsRef.current[key]) {
          clearTimeout(typingTimeoutsRef.current[key]);
          delete typingTimeoutsRef.current[key];
        }

        if (is_typing) {
          // Auto-remove after 3.5 seconds in case disconnect occurs
          typingTimeoutsRef.current[key] = setTimeout(() => {
            setTypingMap((p) => ({
              ...p,
              [conversation_id]: (p[conversation_id] || []).filter((u) => u.user_id !== user_id),
            }));
          }, 3500);

          if (!current.some((u) => u.user_id === user_id)) {
            return {
              ...prev,
              [conversation_id]: [...current, { user_id, display_name }],
            };
          }
        } else {
          return {
            ...prev,
            [conversation_id]: current.filter((u) => u.user_id !== user_id),
          };
        }
        return prev;
      });
    });

    const unsubPresence = subscribe('presence_changed', (payload: {
      user_id: string;
      is_online: boolean;
      last_seen: string;
    }) => {
      const { user_id, is_online, last_seen } = payload;
      setConversations((prev) =>
        prev.map((c) => {
          if (c.recipient?.id === user_id) {
            return {
              ...c,
              recipient: {
                ...c.recipient,
                is_online,
                last_seen,
              },
            };
          }
          return c;
        })
      );
    });

    const unsubConvCreated = subscribe('conversation_created', (payload: { conversation: Conversation }) => {
      setConversations((prev) => {
        if (prev.some((c) => c.id === payload.conversation.id)) return prev;
        return [payload.conversation, ...prev];
      });
    });

    return () => {
      unsubNewMessage();
      unsubStatusUpdate();
      unsubReaction();
      unsubTyping();
      unsubPresence();
      unsubConvCreated();
    };
  }, [subscribe, activeConversationId, user, markRead, fetchConversations]);

  // Send message with optimistic update
  const sendMessage = async (
    content?: string,
    attachmentData?: {
      url: string;
      filename: string;
      size: number;
      mime: string;
      type: string;
    }
  ) => {
    if (!activeConversationId || !user) return;
    if (!content?.trim() && !attachmentData) return;

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Build optimistic message
    const optimisticMessage: Message = {
      id: tempId,
      temp_id: tempId,
      conversation_id: activeConversationId,
      sender_id: user.id,
      sender: user,
      content: content?.trim() || null,
      message_type: (attachmentData?.type as any) || 'text',
      attachment_url: attachmentData?.url || null,
      attachment_name: attachmentData?.filename || null,
      attachment_size: attachmentData?.size || null,
      attachment_mime: attachmentData?.mime || null,
      reply_to_id: replyingTo?.id || null,
      reply_to: replyingTo
        ? {
            id: replyingTo.id,
            sender_id: replyingTo.sender_id,
            sender_name: replyingTo.sender?.display_name || 'User',
            content: replyingTo.content,
            message_type: replyingTo.message_type,
            attachment_url: replyingTo.attachment_url,
          }
        : null,
      status: 'sending',
      is_deleted: false,
      created_at: new Date().toISOString(),
      reactions: [],
    };

    // Optimistically insert into state
    setMessagesMap((prev) => ({
      ...prev,
      [activeConversationId]: [...(prev[activeConversationId] || []), optimisticMessage],
    }));

    // Update conversation preview optimistically
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === activeConversationId);
      if (idx === -1) return prev;
      const updated = {
        ...prev[idx],
        last_message: optimisticMessage,
        updated_at: optimisticMessage.created_at,
      };
      const next = [...prev];
      next.splice(idx, 1);
      next.unshift(updated);
      return next;
    });

    // Clear reply state
    setReplyingTo(null);

    // Stop typing indicator
    sendTyping(activeConversationId, false);

    // Dispatch over WebSocket
    wsSendMessage({
      conversation_id: activeConversationId,
      content: content?.trim(),
      temp_id: tempId,
      reply_to_id: replyingTo?.id || undefined,
      message_type: attachmentData?.type || 'text',
      attachment_url: attachmentData?.url,
      attachment_name: attachmentData?.filename,
      attachment_size: attachmentData?.size,
      attachment_mime: attachmentData?.mime,
    });
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    wsReact(messageId, emoji);
  };

  const deleteMessage = async (messageId: string) => {
    try {
      await api.deleteMessage(messageId);
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  const updateDisappearingTimer = async (seconds: number) => {
    if (!activeConversationId) return;
    try {
      const updated = await api.updateDisappearingTimer(activeConversationId, seconds);
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConversationId ? { ...c, disappearing_messages_timer: seconds } : c))
      );
    } catch (err) {
      console.error('Failed to update disappearing timer:', err);
    }
  };

  const startDirectChat = async (recipientUserId: string): Promise<Conversation> => {
    const conv = await api.getOrCreateDirectConversation(recipientUserId);
    setConversations((prev) => {
      if (prev.some((c) => c.id === conv.id)) {
        return prev.map((c) => (c.id === conv.id ? conv : c));
      }
      return [conv, ...prev];
    });
    selectConversation(conv.id);
    return conv;
  };

  const createGroupChat = async (title: string, memberIds: string[], avatarUrl?: string): Promise<Conversation> => {
    const conv = await api.createGroup(title, memberIds, avatarUrl);
    setConversations((prev) => [conv, ...prev]);
    selectConversation(conv.id);
    return conv;
  };

  return (
    <ChatContext.Provider
      value={{
        conversations,
        activeConversationId,
        activeConversation,
        activeMessages,
        isLoadingConversations,
        isLoadingMessages,
        activeFilter,
        searchQuery,
        typingUsers,
        isMobileChatOpen,
        replyingTo,
        setReplyingTo,
        setActiveFilter,
        setSearchQuery,
        setIsMobileChatOpen,
        selectConversation,
        fetchConversations,
        fetchMessages,
        sendMessage,
        toggleReaction,
        deleteMessage,
        updateDisappearingTimer,
        startDirectChat,
        createGroupChat,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
