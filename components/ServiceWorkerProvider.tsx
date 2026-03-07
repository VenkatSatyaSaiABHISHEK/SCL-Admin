'use client';

import { useEffect, useState, useCallback } from 'react';

export default function ServiceWorkerProvider() {
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  const applyUpdate = useCallback(() => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    // Clear caches and reload
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }
    // Listen for controller change then reload
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
    // Fallback reload after 2 seconds if controllerchange doesn't fire
    setTimeout(() => window.location.reload(), 2000);
  }, [registration]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('SW registered');
        setRegistration(reg);

        // Check for updates every 3 minutes
        const interval = setInterval(() => {
          reg.update().catch(() => {});
        }, 180000);

        // If there's already a waiting worker (update was detected before page load)
        if (reg.waiting) {
          console.log('SW: Found waiting worker on load');
          setShowUpdateBanner(true);
        }

        // Listen for new updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              // New SW is installed - show update banner whether or not controller exists
              // (controller is null on first visit, but update still applies)
              console.log('SW: New version installed, showing update banner');
              setShowUpdateBanner(true);
            }
          });
        });

        return () => clearInterval(interval);
      })
      .catch((error) => console.log('SW registration failed', error));
  }, []);

  if (!showUpdateBanner) return null;

  return (
    <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-[9999] animate-slide-up">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 flex items-center gap-4 max-w-md mx-4">
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
            onClick={applyUpdate}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Update Now
          </button>
        </div>
      </div>
    </div>
  );
}