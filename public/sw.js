/* Buloba Hotel CRS — Workbox service worker (local runtime, no CDN). */
importScripts(
  '/workbox/workbox-core.prod.js',
  '/workbox/workbox-precaching.prod.js',
  '/workbox/workbox-routing.prod.js',
  '/workbox/workbox-strategies.prod.js',
  '/workbox/workbox-expiration.prod.js',
  '/workbox/workbox-background-sync.prod.js'
);

self.skipWaiting();
self.clients.claim();

workbox.precaching.precacheAndRoute([
  { url: '/offline.html', revision: 'buloba-v2' },
  { url: '/manifest.webmanifest', revision: 'buloba-v2' },
  { url: '/icon.svg', revision: 'buloba-v2' }
]);
workbox.precaching.cleanupOutdatedCaches();

const { registerRoute } = workbox.routing;
const { NetworkFirst, CacheFirst, NetworkOnly } = workbox.strategies;
const { ExpirationPlugin } = workbox.expiration;
const { BackgroundSyncPlugin } = workbox.backgroundSync;

const pageStrategy = new NetworkFirst({
  cacheName: 'buloba-pages',
  networkTimeoutSeconds: 3,
  plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 7 * 24 * 60 * 60 })],
});

registerRoute(
  ({ request }) => request.mode === 'navigate',
  async (event) => {
    try {
      return await pageStrategy.handle(event);
    } catch (error) {
      const cached = await caches.match('/offline.html');
      return cached || new Response('Buloba Hotel CRS is offline. Please reconnect and retry.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  }
);

registerRoute(
  ({ url }) =>
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/workbox/') ||
    /\.(?:png|jpg|jpeg|svg|webp|woff2?|webmanifest)$/i.test(url.pathname),
  new CacheFirst({
    cacheName: 'buloba-static',
    plugins: [new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 30 * 24 * 60 * 60 })],
  })
);

registerRoute(
  ({ url, request }) => request.method === 'GET' && url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'buloba-api-read',
    networkTimeoutSeconds: 2,
    plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 24 * 60 * 60 })],
  })
);

const apiBackgroundSync = new BackgroundSyncPlugin('buloba-api-transactions', {
  maxRetentionTime: 24 * 60,
});

registerRoute(
  ({ url, request }) =>
    request.method !== 'GET' &&
    url.pathname.startsWith('/api/') &&
    !url.pathname.startsWith('/api/auth/'),
  new NetworkOnly({ plugins: [apiBackgroundSync] }),
  'POST'
);

self.addEventListener('sync', (event) => {
  if (event.tag === 'buloba-outbox-sync') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'BH_SYNC_NOW' }));
      })
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
