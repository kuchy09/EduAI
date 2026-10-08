// Edu AI - Immediate Service Worker Deregistration
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.registration.unregister().catch(() => {})
  );
});

