/* Offline cache: app works without internet once loaded (TV / gym corner with weak Wi-Fi). */
var CACHE = 'finestme-v65';
var FILES = ['./', 'index.html', 'css/app.css', 'js/theme.js', 'js/native.js', 'js/i18n.js', 'js/config.js', 'js/photos.js', 'js/products.js', 'js/voiceclips.js', 'js/figure.js', 'js/exercises.js', 'js/program.js', 'js/store.js', 'js/cloud.js', 'js/track.js', 'js/imports.js', 'js/sport.js', 'js/today.js', 'js/complements.js', 'js/catalog.js', 'js/health.js', 'js/qr.js', 'js/scan.js', 'js/reminders.js', 'js/shelf.js', 'js/devices.js', 'js/share.js', 'js/account.js', 'js/app.js', 'manifest.webmanifest', 'icons/icon.svg'];
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
// Reminders (supabase/functions/reminders): { title, body, url, tag, done } – "✅ Done" checks in straight from the notification
self.addEventListener('push', function (e) {
  var d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'Rutina', body: e.data ? e.data.text() : '' }; }
  var opts = { body: d.body || '', icon: 'icons/icon.svg', badge: 'icons/icon.svg', tag: d.tag || 'finestme', renotify: false, data: { url: d.url || './' } };
  if (d.done) opts.actions = [{ action: 'done', title: d.done }];
  e.waitUntil(self.registration.showNotification(d.title || 'Rutina', opts));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var base = self.registration.scope, url = e.action === 'done' ? base + '?a=checkin' : new URL((e.notification.data && e.notification.data.url) || './', base).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) if (list[i].url.indexOf(base) === 0 && 'navigate' in list[i]) return list[i].navigate(url).then(function (c) { return c && c.focus(); });
    return self.clients.openWindow(url);
  }));
});
