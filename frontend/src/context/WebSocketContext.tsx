'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { sounds } from '@/lib/sound';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

type EventHandler = (payload: any) => void;

interface WebSocketContextType {
  status: ConnectionStatus;
  sendMessage: (data: {
    conversation_id: string;
    content?: string;
    temp_id?: string;
    reply_to_id?: string;
    message_type?: string;
    attachment_url?: string;
    attachment_name?: string;
    attachment_size?: number;
    attachment_mime?: string;
  }) => void;
  sendTyping: (conversation_id: string, is_typing: boolean) => void;
  markRead: (conversation_id: string) => void;
  react: (message_id: string, emoji: string) => void;
  subscribe: (event: string, handler: EventHandler) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const listenersRef = useRef<Map<string, Set<EventHandler>>>(new Map());

  const subscribe = useCallback((event: string, handler: EventHandler) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(handler);

    return () => {
      listenersRef.current.get(event)?.delete(handler);
    };
  }, []);

  const dispatchEvent = useCallback((event: string, payload: any) => {
    const handlers = listenersRef.current.get(event);
    if (handlers) {
      handlers.forEach((h) => {
        try {
          h(payload);
        } catch (err) {
          console.error(`Error in WebSocket event listener for ${event}:`, err);
        }
      });
    }
  }, []);

  const connect = useCallback(() => {
    if (!token || !user) {
      return;
    }

    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setStatus(reconnectAttemptsRef.current === 0 ? 'connecting' : 'reconnecting');

    // Derive WS URL reliably
    const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
    const cleanUrl = rawApiUrl.trim().replace(/\/+$/, '').replace(/\/api$/, '');
    const isHttps = cleanUrl.startsWith('https://') || (typeof window !== 'undefined' && window.location.protocol === 'https:');
    const wsProtocol = isHttps ? 'wss://' : 'ws://';
    const wsHost = cleanUrl.replace(/^https?:\/\//, '');
    const wsUrl = `${wsProtocol}${wsHost}/ws?token=${token}`;

    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setStatus('connected');
        reconnectAttemptsRef.current = 0;

        // Start heartbeat ping
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ action: 'ping' }));
          }
        }, 25000);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const { event: eventName, payload } = data;

          if (eventName === 'pong') {
            return;
          }

          // Sound triggers
          if (eventName === 'new_message') {
            const msg = payload.message;
            if (msg.sender_id !== user.id) {
              sounds.playReceived();
            } else {
              sounds.playSent();
            }
          }

          dispatchEvent(eventName, payload);
        } catch (e) {
          console.error('Failed to parse WebSocket incoming frame:', e);
        }
      };

      socket.onclose = (event) => {
        setStatus('disconnected');
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);

        // Do not reconnect if closed cleanly by client or policy violation (auth failure)
        if (event.code === 1008) {
          console.warn('WebSocket closed due to auth failure.');
          return;
        }

        // Exponential backoff reconnection with jitter
        const baseDelay = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 15000);
        const jitter = Math.random() * 500;
        const delay = baseDelay + jitter;
        reconnectAttemptsRef.current += 1;

        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      socket.onerror = (err) => {
        console.error('WebSocket connection error:', err);
        socket.close();
      };
    } catch (err) {
      console.error('Failed to instantiate WebSocket:', err);
    }
  }, [token, user, dispatchEvent]);

  useEffect(() => {
    if (token && user) {
      connect();
    } else {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setStatus('disconnected');
    }

    return () => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [token, user, connect]);

  const sendRaw = useCallback((action: string, data: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action, data }));
    }
  }, []);

  const sendMessage = useCallback(
    (data: {
      conversation_id: string;
      content?: string;
      temp_id?: string;
      reply_to_id?: string;
      message_type?: string;
      attachment_url?: string;
      attachment_name?: string;
      attachment_size?: number;
      attachment_mime?: string;
    }) => {
      sendRaw('send_message', data);
    },
    [sendRaw]
  );

  const sendTyping = useCallback(
    (conversation_id: string, is_typing: boolean) => {
      sendRaw('typing', { conversation_id, is_typing });
    },
    [sendRaw]
  );

  const markRead = useCallback(
    (conversation_id: string) => {
      sendRaw('mark_read', { conversation_id });
    },
    [sendRaw]
  );

  const react = useCallback(
    (message_id: string, emoji: string) => {
      sendRaw('react', { message_id, emoji });
    },
    [sendRaw]
  );

  return (
    <WebSocketContext.Provider
      value={{
        status,
        sendMessage,
        sendTyping,
        markRead,
        react,
        subscribe,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}
