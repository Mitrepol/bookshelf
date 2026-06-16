// Service Worker for Kelly's Fandom Bookshelf v4

self.addEventListener('push', event => {
  event.waitUntil(
    self.registration.showNotification("Kelly's Bookshelf 🦝", {
      body: event.data ? event.data.text() : 'New notification'
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  clients.openWindow('https://mitrepol.github.io/bookshelf');
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(clients.claim()));
self.addEventListener('fetch', event => event.respondWith(fetch(event.request)));
