'use client';

import React, { useState, useEffect } from 'react';

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  text: string;
}

type ToastListener = (msg: ToastMessage) => void;
const listeners: ToastListener[] = [];

export const toast = {
  info: (text: string) => dispatch({ id: Math.random().toString(), type: 'info', text }),
  success: (text: string) => dispatch({ id: Math.random().toString(), type: 'success', text }),
  warning: (text: string) => dispatch({ id: Math.random().toString(), type: 'warning', text }),
  error: (text: string) => dispatch({ id: Math.random().toString(), type: 'error', text }),
};

function dispatch(msg: ToastMessage) {
  listeners.forEach((fn) => fn(msg));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handleToast: ToastListener = (msg) => {
      setToasts((prev) => [...prev, msg]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== msg.id));
      }, 3500);
    };

    listeners.push(handleToast);
    return () => {
      const idx = listeners.indexOf(handleToast);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl bg-neutral-900/90 dark:bg-neutral-800/95 text-white border border-neutral-700/60 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div className="flex-1 text-sm font-medium">{t.text}</div>
          <button
            onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
            className="text-neutral-400 hover:text-white text-xs"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
