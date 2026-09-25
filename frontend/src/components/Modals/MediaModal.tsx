'use client';

import React from 'react';
import { X, Download } from 'lucide-react';

interface MediaModalProps {
  url: string | null;
  onClose: () => void;
}

export function MediaModal({ url, onClose }: MediaModalProps) {
  if (!url) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
      >
        <div className="absolute -top-12 right-0 flex items-center gap-2">
          <a
            href={url}
            download="signal_media"
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-full bg-neutral-800/80 text-white hover:bg-neutral-700 transition-colors"
            title="Download image"
          >
            <Download className="w-5 h-5" />
          </a>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-neutral-800/80 text-white hover:bg-neutral-700 transition-colors"
            title="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <img
          src={url}
          alt="Preview"
          className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl border border-neutral-800"
        />
      </div>
    </div>
  );
}
