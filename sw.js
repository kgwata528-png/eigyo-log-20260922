const CACHE = 'sales-pwa-v3';
// GitHub Pages（/eigyo-log-20260922/）配下でも動くよう相対パスで指定
const ASSETS = ['./', './index.html', './style.css', './app.js', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  // Google Maps API・外部CDN・GET以外はキャッシュしない
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // ネットワーク優先：オンラインなら常に最新を取得してキャッシュを更新、オフライン時のみキャッシュを使う
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then(cached => cached || caches.match('./index.html')))
  );
});
