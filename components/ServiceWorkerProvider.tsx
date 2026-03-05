'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/context/ToastContext';

export default function ServiceWorkerProvider() {
  const { showToast } = useToast();
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('SW registered');
          
          // Check for updates periodically (every 5 minutes)
          setInterval(() => {
            registration.update();
          }, 300000);

          // Handle updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New version available
                  console.log('New version available!');
                  setWaitingWorker(newWorker);
                  setShowUpdateBanner(true);
                  showToast('New version available! Click to update.', 'success', 10000);
                }
              });
            }
          });

          // Check if there's already a waiting worker
          if (registration.waiting) {
            setWaitingWorker(registration.waiting);
            setShowUpdateBanner(true);
          }
        })
        .catch(error => console.log('SW registration failed', error));
    }
  }, [showToast]);

  const updateServiceWorker = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      
      // Listen for controller change
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }
  };

  if (!showUpdateBanner) return null;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[9999] animate-slide-up">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 flex items-center gap-4 max-w-md">
        <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 mb-1">Update Available</h4>
          <p className="text-sm text-gray-600">A new version of the app is ready.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowUpdateBanner(false)}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 font-medium"
          >
            Later
          </button>
          <button
            onClick={updateServiceWorker}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Update Now
          </button>
        </div>
      </div>
    </div>
  );
}