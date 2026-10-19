/* Offline cache: app works without internet once loaded (TV / gym corner with weak Wi-Fi). */
var CACHE = 'finestme-v29';
var FILES = ['./', 'index.html', 'css/app.css', 'js/config.js', 'js/photos.js', 'js/products.js', 'js/voiceclips.js', 'js/figure.js', 'js/exercises.js', 'js/program.js', 'js/store.js', 'js/cloud.js', 'js/track.js', 'js/imports.js', 'js/sport.js', 'js/today.js', 'js/devices.js', 'js/account.js', 'js/app.js', 'manifest.webmanifest', 'icons/icon.svg'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// network-first so updates arrive immediately, cache as fallback
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  // same-origin files are always revalidated, so an HTTP-cached old copy never masks an update
  var url = new URL(e.request.url), same = url.origin === self.location.origin;
  // map tiles stream straight from the network (caching them would grow without limit);
  // the map library itself (cdnjs) and fonts are cached for offline use
  if (!same && !/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/.test(url.host)) return;   // never the Supabase API
  var req = same ? new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }) : e.request;
  e.respondWith(fetch(req).then(function (r) {
    var copy = r.clone();
    caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
    return r;
  }).catch(function () { return caches.match(e.request); }));
});
