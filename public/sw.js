// Service Worker for SmartCity Lab PWA
// Handles background sync, push notifications, and caching

const CACHE_NAME = 'scl-pwa-v5'; // Increment version to force cache refresh
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon-144x144.svg'
];

// Install event - only cache static assets, NOT HTML pages
self.addEventListener('install', (event) => {
  console.log('SW: Installing new version');
  self.skipWaiting(); // Activate immediately without waiting
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(STATIC_ASSETS);
      })
  );
});

// Activate event - cleanup old caches and take control
self.addEventListener('activate', (event) => {
  console.log('SW: Activating new version');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control immediately
  );
});

// Fetch event - smart caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (Firebase, external APIs, etc.)
  if (url.origin !== self.location.origin) return;

  // NETWORK-FIRST for HTML navigation requests (pages)
  // This prevents stale cached pages from causing login loops and errors
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the fresh page for offline fallback
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Offline fallback - serve cached version
          return caches.match(request).then((cached) => {
            return cached || new Response('You are offline. Please check your internet connection.', {
              status: 503,
              headers: { 'Content-Type': 'text/html' }
            });
          });
        })
    );
    return;
  }

  // NETWORK-FIRST for Next.js chunks to prevent ChunkLoadError
  if (url.pathname.includes('/_next/static/chunks/') || 
      url.pathname.includes('/_next/static/css/') ||
      url.pathname.includes('/_next/static/media/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  // CACHE-FIRST for truly static assets (icons, manifest, images)
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|gif|ico|webp|woff|woff2|ttf)$/) || 
      url.pathname === '/manifest.json') {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) return response;
          return fetch(request).then((response) => {
            if (response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return response;
          });
        })
    );
    return;
  }

  // Default: network-first for everything else
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Push event - handle push notifications
self.addEventListener('push', (event) => {
  console.log('Push event received:', event);
  
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (err) {
    console.error('Error parsing push payload:', err);
  }

  const options = {
    title: payload.title || 'SCL Notification',
    body: payload.body || 'You have a new notification',
    icon: payload.icon || '/icon-144x144.svg',
    badge: payload.badge || '/icon-144x144.svg',
    data: payload.data || {},
    actions: payload.actions || [],
    requireInteraction: payload.type === 'attendance-session', // Keep attendance notifications visible
    silent: false,
    vibrate: payload.type === 'attendance-session' ? [200, 100, 200] : [100]
  };

  event.waitUntil(
    self.registration.showNotification(options.title, options)
  );
});

// Notification click event - handle user interactions
self.addEventListener('notificationclick', (event) => {
  console.log('Notification click received:', event);
  
  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};

  let url = '/pwa';
  
  // Handle different notification types
  if (data.type === 'attendance-session' || action === 'mark-attendance') {
    url = '/pwa/attendance';
  } else if (data.url) {
    url = data.url;
  }

  // Open the app or focus existing window
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(url) && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Open new window if app not open
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// Background sync event - handle offline actions
self.addEventListener('sync', (event) => {
  console.log('Background sync event:', event.tag);
  
  if (event.tag === 'attendance-submission') {
    event.waitUntil(
      // Handle offline attendance submissions when connection is restored
      handleOfflineAttendance()
    );
  }
});

// Handle offline attendance submissions
async function handleOfflineAttendance() {
  try {
    // This would retrieve queued attendance submissions from IndexedDB
    // and sync them when connection is restored
    console.log('Processing offline attendance submissions...');
    
    // TODO: Implement IndexedDB retrieval and Firebase sync
    // const pendingSubmissions = await getOfflineSubmissions();
    // for (const submission of pendingSubmissions) {
    //   await submitAttendanceToFirebase(submission);
    //   await removeOfflineSubmission(submission.id);
    // }
    
  } catch (error) {
    console.error('Error processing offline attendance:', error);
  }
}

// Message event - handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('Skipping waiting and activating new service worker');
    self.skipWaiting();
  }
});

console.log('SCL Service Worker loaded and ready for PWA features');