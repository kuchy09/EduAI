// Edu AI - Intelligent Service Worker for Offline Reading & Content Sync
const CACHE_VERSION = 'edu-ai-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PDF_CACHE = `${CACHE_VERSION}-pdfs`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;
const API_CACHE = `${CACHE_VERSION}-api`;

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/src/index.css'
];

// Install Event - Precache critical shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-caching non-fatal warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up stale cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('edu-ai-') && !name.startsWith(CACHE_VERSION))
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Dynamic caching strategies for reading & offline access
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-GET requests and browser extension requests
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // 1. PDF Downloads & Book Content (/api/download or .pdf)
  if (url.pathname.startsWith('/api/download') || url.pathname.endsWith('.pdf')) {
    event.respondWith(
      caches.open(PDF_CACHE).then(async (cache) => {
        // Try network first to get fresh document, fallback to cached copy
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          const cachedResponse = await cache.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          throw error;
        }
      })
    );
    return;
  }

  // 2. Book Cover Images & Assets
  if (
    url.hostname.includes('unsplash.com') || 
    url.pathname.match(/\.(jpg|jpeg|png|webp|svg|gif)$/i) ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          // Revalidate in background
          fetch(request).then((res) => {
            if (res && res.status === 200) cache.put(request, res);
          }).catch(() => {});
          return cached;
        }

        try {
          const response = await fetch(request);
          if (response && response.status === 200) {
            cache.put(request, response.clone());
          }
          return response;
        } catch (err) {
          // If offline and image not found, return empty placeholder or cached
          return cached || new Response('', { status: 408, headers: { 'Content-Type': 'image/svg+xml' } });
        }
      })
    );
    return;
  }

  // 3. Application Shell & Scripts (Stale-While-Revalidate)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback
          return cachedResponse || new Response('Offline: Content is available in downloaded books.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        });

      return cachedResponse || fetchPromise;
    })
  );
});

// Message Event - Support client communication for manual caching
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_BOOK_PDF') {
    const { url, bookId } = event.data;
    if (url) {
      caches.open(PDF_CACHE).then((cache) => {
        fetch(url).then((res) => {
          if (res.ok) cache.put(url, res);
        }).catch((err) => console.warn('[SW] Manual book cache failed:', err));
      });
    }
  } else if (event.data && event.data.type === 'CLEAR_OFFLINE_CACHE') {
    caches.keys().then((keys) => {
      keys.forEach((key) => {
        if (key.startsWith('edu-ai-')) caches.delete(key);
      });
    });
  }
});
