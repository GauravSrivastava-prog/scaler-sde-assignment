/**
 * API Client Utility
 * Provides typed HTTP methods, automatic JWT Bearer token injection,
 * and robust error handling.
 */
import { AuthSession, User, Conversation, Message, Contact, Reaction } from './types';

function getApiBaseUrl(): string {
  let url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
  url = url.trim().replace(/\/+$/, '');
  if (!url.endsWith('/api')) {
    url = `${url}/api`;
  }
  return url;
}

const API_BASE = getApiBaseUrl();

class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('signal_token');
    }
  }

  public setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('signal_token', token);
      } else {
        localStorage.removeItem('signal_token');
      }
    }
  }

  public getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('signal_token');
    }
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    const currentToken = this.getToken();
    if (currentToken && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 204) {
      return {} as T;
    }

    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const errorMessage = data?.detail || data?.message || `Request failed with status ${response.status}`;
      throw new Error(errorMessage);
    }

    return data as T;
  }

  // --- Auth Endpoints ---
  async login(phone_or_username: string, password?: string): Promise<AuthSession> {
    const res = await this.request<AuthSession>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone_or_username, password }),
    });
    this.setToken(res.access_token);
    return res;
  }

  async register(phone_number: string, username: string, display_name: string, password?: string): Promise<AuthSession> {
    const res = await this.request<AuthSession>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ phone_number, username, display_name, password }),
    });
    this.setToken(res.access_token);
    return res;
  }

  async sendOtp(phone_number: string): Promise<{ success: boolean; message: string; mock_otp: string }> {
    return this.request('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone_number }),
    });
  }

  async verifyOtp(phone_number: string, otp: string, username?: string, display_name?: string): Promise<AuthSession> {
    const res = await this.request<AuthSession>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone_number, otp, username, display_name }),
    });
    this.setToken(res.access_token);
    return res;
  }

  async getMe(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  // --- Users Endpoints ---
  async searchUsers(query: string): Promise<User[]> {
    return this.request<User[]>(`/users/search?q=${encodeURIComponent(query)}`);
  }

  async getAllUsers(): Promise<User[]> {
    return this.request<User[]>('/users/all');
  }

  async updateProfile(updates: { display_name?: string; about?: string; avatar_url?: string }): Promise<User> {
    return this.request<User>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  // --- Contacts Endpoints ---
  async getContacts(): Promise<Contact[]> {
    return this.request<Contact[]>('/contacts');
  }

  async addContact(data: { contact_user_id?: string; phone_or_username?: string; nickname?: string }): Promise<Contact> {
    return this.request<Contact>('/contacts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async removeContact(contactId: string): Promise<void> {
    return this.request<void>(`/contacts/${contactId}`, { method: 'DELETE' });
  }

  // --- Conversations Endpoints ---
  async getConversations(): Promise<Conversation[]> {
    return this.request<Conversation[]>('/conversations');
  }

  async getConversation(id: string): Promise<Conversation> {
    return this.request<Conversation>(`/conversations/${id}`);
  }

  async getOrCreateDirectConversation(recipient_user_id: string): Promise<Conversation> {
    return this.request<Conversation>('/conversations/direct', {
      method: 'POST',
      body: JSON.stringify({ recipient_user_id }),
    });
  }

  async updateDisappearingTimer(conversation_id: string, timer_seconds: number): Promise<Conversation> {
    return this.request<Conversation>(`/conversations/${conversation_id}/disappearing`, {
      method: 'PATCH',
      body: JSON.stringify({ timer_seconds }),
    });
  }

  // --- Groups Endpoints ---
  async createGroup(title: string, member_user_ids: string[], avatar_url?: string): Promise<Conversation> {
    return this.request<Conversation>('/groups', {
      method: 'POST',
      body: JSON.stringify({ title, member_user_ids, avatar_url }),
    });
  }

  async addGroupMember(conversation_id: string, user_id: string, role: string = 'member'): Promise<void> {
    return this.request<void>(`/groups/${conversation_id}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id, role }),
    });
  }

  async removeGroupMember(conversation_id: string, user_id: string): Promise<void> {
    return this.request<void>(`/groups/${conversation_id}/members/${user_id}`, {
      method: 'DELETE',
    });
  }

  // --- Messages Endpoints ---
  async getMessages(conversation_id: string, limit: number = 100, before?: string): Promise<Message[]> {
    let url = `/conversations/${conversation_id}/messages?limit=${limit}`;
    if (before) url += `&before=${before}`;
    return this.request<Message[]>(url);
  }

  async sendMessage(
    conversation_id: string,
    message: {
      content?: string;
      message_type?: string;
      attachment_url?: string;
      attachment_name?: string;
      attachment_size?: number;
      attachment_mime?: string;
      reply_to_id?: string;
      temp_id?: string;
    }
  ): Promise<Message> {
    return this.request<Message>(`/conversations/${conversation_id}/messages`, {
      method: 'POST',
      body: JSON.stringify(message),
    });
  }

  async markConversationAsRead(conversation_id: string): Promise<{ success: boolean; read_count: number }> {
    return this.request(`/conversations/${conversation_id}/read`, {
      method: 'POST',
    });
  }

  async toggleReaction(message_id: string, emoji: string): Promise<Reaction[]> {
    return this.request<Reaction[]>(`/messages/${message_id}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    });
  }

  async deleteMessage(message_id: string): Promise<void> {
    return this.request<void>(`/messages/${message_id}`, {
      method: 'DELETE',
    });
  }

  // --- Uploads ---
  async uploadFile(file: File): Promise<{
    url: string;
    filename: string;
    content_type: string;
    size: number;
    message_type: 'image' | 'audio' | 'file';
  }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.request('/uploads', {
      method: 'POST',
      body: formData,
    });
  }
}

export const api = new ApiClient();
