/* Bump VERSION with APP_BUILD when publishing a new game version. */
const VERSION = '2026.11.27.1';
const SCOPE = self.registration.scope;
const CACHE_PREFIX = 'pocket-aquarium:' + encodeURIComponent(SCOPE) + ':';
const CACHE = CACHE_PREFIX + VERSION;
const CORE = ['./', './index.html', './pwa-updates.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './favicon-32.png'];
const inScope = url => url.origin === self.location.origin && url.href.startsWith(SCOPE);

self.addEventListener('install', event => {
  // Keep the previous worker running until a client has safely saved its game.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE.map(path => new Request(new URL(path, SCOPE), {cache:'reload'})))));
});
self.addEventListener('activate', event => {
  // GitHub Pages shares an origin with other projects: never remove their caches.
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('message', event => {
  if (!event.data || !event.source || !inScope(new URL(event.source.url))) return;
  if (event.data.type === 'AQUARIUM_VERSION_REQUEST') {
    const port = event.ports && event.ports[0];
    if (port) port.postMessage({type:'AQUARIUM_VERSION', version:VERSION});
  } else if (event.data.type === 'AQUARIUM_ACTIVATE' && event.data.version === VERSION) {
    event.waitUntil(self.skipWaiting());
  }
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || !inScope(url)) return;
  const navigation = request.mode === 'navigate';
  const navigationURL = new URL(url.href);
  navigationURL.search = ''; navigationURL.hash = '';
  const shell = navigationURL.href === SCOPE || navigationURL.href === new URL('./index.html', SCOPE).href;
  const cacheKey = navigation ? (shell ? new URL('./index.html', SCOPE).href : navigationURL.href) : request;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(new Request(request, {cache:'no-cache'}));
      if (response.ok) {
        // Lab pages share this scope but own separate saves and HTML. Never let
        // their navigation overwrite the main game shell or retain invite URLs.
        event.waitUntil(cache.put(cacheKey, response.clone()).catch(() => {}));
      }
      return response;
    } catch (_) {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
      if (navigation) {
        return new Response(shell ? '魚缸目前離線，請連上網路後再試。' : '這個頁面尚未下載，請連上網路後再開啟。', {status:503, headers:{'Content-Type':'text/plain; charset=utf-8'}});
      }
      // Never return HTML for a missing JavaScript/image.
      return Response.error();
    }
  })());
});
