'use client';

import React from 'react';
import { Check, CheckCheck, Clock } from 'lucide-react';

interface StatusIconProps {
  status: 'sending' | 'sent' | 'delivered' | 'read';
  className?: string;
}

export function StatusIcon({ status, className = 'w-3.5 h-3.5' }: StatusIconProps) {
  switch (status) {
    case 'sending':
      return <Clock className={`${className} text-neutral-400 animate-pulse`} />;
    case 'sent':
      return <Check className={`${className} text-neutral-300 opacity-90`} />;
    case 'delivered':
      return <CheckCheck className={`${className} text-neutral-300 opacity-90`} />;
    case 'read':
      return <CheckCheck className={`${className} text-blue-400 stroke-[2.5]`} />;
    default:
      return null;
  }
}
