// Aaromach Arcade: offline mode is retired. This worker only removes the old one and its caches.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k))))
    .then(() => self.registration.unregister())
    .then(() => self.clients.matchAll({ type: 'window' }))
    .then(cs => cs.forEach(c => c.navigate(c.url))));
});
