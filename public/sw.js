// Service Worker for SmartCity Lab PWA
// Handles background sync, push notifications, and caching

const CACHE_NAME = 'scl-pwa-v4'; // Increment version to force cache refresh
const urlsToCache = [
  '/',
  '/pwa/login',
  '/pwa/attendance',
  '/pwa/home',
  '/pwa/profile',
  '/manifest.json',
  '/icon-144x144.svg'
];

// Install event - cache important resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
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

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Network-first strategy for Next.js chunks to prevent ChunkLoadError
  if (url.pathname.includes('/_next/static/chunks/') || 
      url.pathname.includes('/_next/static/css/') ||
      url.pathname.includes('/_next/static/media/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone and cache the fresh response
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Fallback to cache if offline
          return caches.match(request);
        })
    );
    return;
  }

  // Cache-first strategy for static assets and pages
  event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(request).then((response) => {
          // Cache new requests
          if (request.method === 'GET' && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
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