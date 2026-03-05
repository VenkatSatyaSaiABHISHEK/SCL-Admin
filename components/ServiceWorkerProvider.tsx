'use client';

import { useEffect } from 'react';

export default function ServiceWorkerProvider() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('SW registered');
          
          // Check for updates periodically
          setInterval(() => {
            registration.update();
          }, 60000); // Check every minute

          // Handle updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
                  // New service worker activated, reload to get fresh chunks
                  console.log('New service worker activated, reloading...');
                  window.location.reload();
                }
              });
            }
          });
        })
        .catch(error => console.log('SW registration failed', error));

      // Listen for controller change (new SW took control)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('Service worker controller changed');
        window.location.reload();
      });
    }
  }, []);

  return null;
}