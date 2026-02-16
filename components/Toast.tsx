'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  duration?: number;
  onClose?: () => void;
}

export default function Toast({ message, type, duration = 4000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-6 right-6 z-[9999] animate-in fade-in slide-in-from-top-4 duration-300">
      <div className={`backdrop-blur-xl rounded-2xl border-2 px-6 py-4 flex items-center gap-4 shadow-2xl ${
        type === 'success'
          ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/50'
          : 'bg-gradient-to-r from-red-500/20 to-rose-500/20 border-red-500/50'
      }`}>
        {type === 'success' ? (
          <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 animate-bounce" />
        ) : (
          <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
        )}
        
        <p className={`font-semibold text-lg ${
          type === 'success' ? 'text-green-300' : 'text-red-300'
        }`}>
          {message}
        </p>

        <button
          onClick={() => setIsVisible(false)}
          className="ml-2 text-white/60 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
