// Service Worker for Kelly's Fandom Bookshelf v3
// Handles push notifications

self.addEventListener('push', event => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch(e) {
    data = { title: "Kelly's Bookshelf 🦝", body: event.data.text() };
  }

  const options = {
    body: data.body || '',
    vibrate: [100, 50, 100],
    data: {
      url: data.data?.url || 'https://mitrepol.github.io/bookshelf'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Kelly's Bookshelf 🦝", options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const url = event.notification.data?.url || 'https://mitrepol.github.io/bookshelf';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('bookshelf') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(clients.claim()));

self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request));
});
