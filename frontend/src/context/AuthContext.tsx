'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '@/lib/types';
import { api } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  login: (phone_or_username: string, password?: string) => Promise<void>;
  register: (phone_number: string, username: string, display_name: string, password?: string) => Promise<void>;
  sendOtp: (phone: string) => Promise<{ success: boolean; message: string; mock_otp: string }>;
  verifyOtp: (phone: string, otp: string, username?: string, display_name?: string) => Promise<void>;
  switchDemoUser: (username: string) => Promise<void>;
  updateUser: (updated: Partial<User>) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [theme, setThemeState] = useState<'dark' | 'light'>('dark');

  // Initialize theme and auth from storage
  useEffect(() => {
    // Theme initialization
    const savedTheme = (localStorage.getItem('signal_theme') as 'dark' | 'light') || 'dark';
    setThemeState(savedTheme);
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Check existing session
    const storedToken = api.getToken();
    const isLoggedOut = localStorage.getItem('signal_explicit_logout') === 'true';

    if (storedToken && !isLoggedOut) {
      setToken(storedToken);
      api
        .getMe()
        .then((fetchedUser) => {
          setUser(fetchedUser);
        })
        .catch(() => {
          // Fallback to demo login if expired
          api.login('moxie', 'password123')
            .then((session) => {
              setToken(session.access_token);
              setUser(session.user);
            })
            .catch(() => {
              api.setToken(null);
              setToken(null);
              setUser(null);
            });
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else if (!isLoggedOut) {
      // First-time visit: auto-log in as demo user Moxie for instant evaluation
      api
        .login('moxie', 'password123')
        .then((session) => {
          setToken(session.access_token);
          setUser(session.user);
        })
        .catch((err) => {
          console.warn('Auto demo login skipped:', err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, []);

  const setTheme = useCallback((newTheme: 'dark' | 'light') => {
    setThemeState(newTheme);
    localStorage.setItem('signal_theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const login = async (phone_or_username: string, password?: string) => {
    setIsLoading(true);
    try {
      localStorage.removeItem('signal_explicit_logout');
      const session = await api.login(phone_or_username, password);
      setToken(session.access_token);
      setUser(session.user);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (phone_number: string, username: string, display_name: string, password?: string) => {
    setIsLoading(true);
    try {
      localStorage.removeItem('signal_explicit_logout');
      const session = await api.register(phone_number, username, display_name, password);
      setToken(session.access_token);
      setUser(session.user);
    } finally {
      setIsLoading(false);
    }
  };

  const sendOtp = async (phone: string) => {
    return api.sendOtp(phone);
  };

  const verifyOtp = async (phone: string, otp: string, username?: string, display_name?: string) => {
    setIsLoading(true);
    try {
      localStorage.removeItem('signal_explicit_logout');
      const session = await api.verifyOtp(phone, otp, username, display_name);
      setToken(session.access_token);
      setUser(session.user);
    } finally {
      setIsLoading(false);
    }
  };

  const switchDemoUser = async (username: string) => {
    setIsLoading(true);
    try {
      localStorage.removeItem('signal_explicit_logout');
      const session = await api.login(username, 'password123');
      setToken(session.access_token);
      setUser(session.user);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = (updated: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...updated });
    }
  };

  const logout = async () => {
    try {
      localStorage.setItem('signal_explicit_logout', 'true');
      await api.logout();
    } catch {
      // Ignore
    } finally {
      setUser(null);
      setToken(null);
      api.setToken(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        theme,
        setTheme,
        login,
        register,
        sendOtp,
        verifyOtp,
        switchDemoUser,
        updateUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
