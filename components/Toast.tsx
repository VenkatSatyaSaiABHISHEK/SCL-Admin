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
    <div className="fixed top-4 left-4 right-4 z-[9999] animate-in fade-in slide-in-from-top-4 duration-300 flex justify-center">
      <div className={`backdrop-blur-xl rounded-xl border-2 px-4 py-3 flex items-start gap-3 shadow-lg max-w-md w-full ${
        type === 'success'
          ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/50'
          : 'bg-gradient-to-r from-red-500/20 to-rose-500/20 border-red-500/50'
      }`}>
        {type === 'success' ? (
          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
        ) : (
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        )}
        
        <p className={`font-medium text-sm flex-1 break-words ${
          type === 'success' ? 'text-green-300' : 'text-red-300'
        }`}>
          {message}
        </p>

        <button
          onClick={() => setIsVisible(false)}
          className="text-white/60 hover:text-white transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
