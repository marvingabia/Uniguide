const CACHE_NAME = 'uniguide-v1';
const OFFLINE_URL = '/offline.html';

const ASSETS_TO_CACHE = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/uploads/minsulogo.png',
  '/uploads/MINSU.png'
];

/* ================================================================
   INSTALL EVENT - Cache app shell
================================================================ */

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching assets...');
        return cache.addAll(ASSETS_TO_CACHE)
          .catch((err) => {
            console.warn('[Service Worker] Some assets failed to cache:', err);
            // Continue even if some assets fail
          });
      })
      .then(() => {
        console.log('[Service Worker] Installed successfully');
        return self.skipWaiting();
      })
  );
});

/* ================================================================
   ACTIVATE EVENT - Clean up old caches
================================================================ */

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[Service Worker] Activated successfully');
        return self.clients.claim();
      })
  );
});

/* ================================================================
   FETCH EVENT - Network-first strategy
   Try network first, fall back to cache for offline
================================================================ */

self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Network-first strategy: try network, fall back to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        // Clone the response before caching
        const clonedResponse = response.clone();

        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(event.request, clonedResponse);
          });

        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }

            // Return offline page if no cache match
            if (event.request.destination === 'document') {
              return caches.match(OFFLINE_URL)
                .catch(() => {
                  // Return a simple offline response
                  return new Response(
                    'You are offline. Please try again when you have a connection.',
                    { status: 503, statusText: 'Service Unavailable' }
                  );
                });
            }

            return new Response(
              'Resource not available offline',
              { status: 503 }
            );
          });
      })
  );
});

/* ================================================================
   MESSAGE EVENT - Handle messages from clients
================================================================ */

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[Service Worker] Skipping waiting, claiming clients...');
    self.skipWaiting();
  }
});
