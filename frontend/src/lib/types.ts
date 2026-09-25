/**
 * Frontend Type Definitions
 * Exact alignment with FastAPI backend Pydantic schemas and models.
 */

export interface User {
  id: string;
  phone_number: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  about?: string | null;
  is_online: boolean;
  last_seen?: string | null;
  created_at: string;
}

export interface QuotedMessage {
  id: string;
  sender_id: string;
  sender_name?: string | null;
  content?: string | null;
  message_type: 'text' | 'image' | 'file' | 'audio' | 'system';
  attachment_url?: string | null;
}

export interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  user?: User | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender?: User | null;
  reply_to_id?: string | null;
  reply_to?: QuotedMessage | null;
  content?: string | null;
  message_type: 'text' | 'image' | 'file' | 'audio' | 'system';
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_size?: number | null;
  attachment_mime?: string | null;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  expires_at?: string | null;
  is_deleted: boolean;
  created_at: string;
  reactions: Reaction[];
  temp_id?: string | null;
}

export interface ConversationParticipant {
  id: string;
  user_id: string;
  role: 'member' | 'admin';
  last_read_message_id?: string | null;
  last_read_at?: string | null;
  joined_at: string;
  user: User;
}

export interface Conversation {
  id: string;
  is_group: boolean;
  title?: string | null;
  avatar_url?: string | null;
  created_by?: string | null;
  disappearing_messages_timer: number; // in seconds, 0 = disabled
  created_at: string;
  updated_at: string;
  participants: ConversationParticipant[];
  last_message?: Message | null;
  unread_count: number;
  recipient?: User | null; // Populated for 1-on-1 chats
}

export interface Contact {
  id: string;
  user_id: string;
  contact_user_id: string;
  nickname?: string | null;
  created_at: string;
  contact_user: User;
}

export interface AuthSession {
  access_token: string;
  token_type: string;
  user: User;
}

export interface TypingEvent {
  conversation_id: string;
  user_id: string;
  display_name: string;
  is_typing: boolean;
}

export interface MessageStatusEvent {
  conversation_id: string;
  message_ids: string[];
  status: 'delivered' | 'read';
  reader_id: string;
}

export interface PresenceEvent {
  user_id: string;
  is_online: boolean;
  last_seen: string;
}
