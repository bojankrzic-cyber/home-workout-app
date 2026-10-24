/*
 * My shelf – every product in the routine with its pack and what to do next.
 *
 * Promotion as a service: the shelf only ever offers what protects the customer's own routine.
 *   - supply per pack ("6 days left · until 2 Nov") with one-tap reorder (market shop, reward code)
 *   - "never run out": subscription at the reorder moment (until the webshop takes subscriptions the app
 *     shows it and counts interest – Products.CONFIG.subscription.live)
 *   - one complementary product from order data (catalog field x) after day 21, at most once a month,
 *     offered as a FREE SAMPLE in the next package (?fm_sample=<sku>), "No thanks" remembered
 * Never during a workout, never as a notification, max one suggestion on screen.
 */
(function (global) {
  'use strict';
  if (!global.FS_MODULES) return;
  global.FS_MODULES.push(function (App) {
    var $ = App.$, $$ = App.$$, esc = App.esc, H = global.Health;
    function st() { return App.state(); }
    function cfg() { return (global.Products && Products.CONFIG) || {}; }
    function emit(name, props) { try { if (global.Cloud && Cloud.user && Cloud.user() && Cloud.event) Cloud.event(name, props || {}, st().id); } catch (e) {} }
    function entry(pid) { return global.FS_CATALOG && global.FS_CATALOG[pid] || null; }
    function pic(it) {
      var e = entry(it.pid), c = H.catalog(it.pid), src = (e && e.img) || (c && c.img);
      return src ? '<img class="shelf-img" src="' + esc(src) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<span class="shelf-img ico">🌿</span>';
    }
    function day(ds) { var p = ds.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString((global.I18N && I18N.locale) || 'en-GB', { day: 'numeric', month: 'short' }); }

    App.SCREENS.shelf = function () {
      var s = st(), items = H.items(s), now = new Date(), code = H.bestCode(s), sub = cfg().subscription || {};
      var rows = items.map(function (it) {
        var sup = H.supply(s, it, now), pct = sup ? Math.max(0, Math.min(100, Math.round(sup.left / sup.servings * 100))) : 0;
        var low = sup && sup.daysLeft <= 5, url = H.reorderUrl(it, code, 'shelf');
        return '<div class="shelf-item' + (low ? ' low' : '') + '">' + pic(it) + '<div class="shelf-body"><b translate="no">' + esc(it.name) + '</b>' +
          (sup ? '<div class="shelf-bar"><i style="width:' + pct + '%"></i></div><small>' + (sup.daysLeft > 0 ? '<span class="ph">' + sup.daysLeft + '</span> days left · until <span translate="no">' + esc(day(sup.runOut)) + '</span>' : 'Runs out today') + '</small>'
            : '<small>No pack yet – tell me when you open it</small>') +
          '<div class="shelf-acts">' + (url ? '<a class="btn sm' + (low ? ' primary' : '') + ' focusable" data-reorder="' + esc(it.id) + '" href="' + esc(url) + '" target="_blank" rel="noopener">🛒 Reorder</a>' : '') +
          '<button class="btn sm ghost focusable" data-newpack="' + esc(it.id) + '">📦 New pack opened</button></div>' +
          (url && low ? '<button class="shelf-sub focusable" data-sub="' + esc(it.id) + '">🔁 Never run out: delivered automatically every ' + (sup && sup.servings ? sup.servings : 30) + ' days' + (sub.discount ? ', −' + sub.discount + ' %' : '') + ' · skip or stop any time</button>' : '') +
          '</div></div>';
      }).join('');
      var cross = H.crossPick(s, now), ce = cross && entry(cross.id), owned = cross && items.filter(function (x) { var e = entry(x.pid); return e && e.x && e.x.indexOf(String(cross.id)) >= 0; })[0];
      var next = items.map(function (it) { return H.supply(s, it, now); }).filter(Boolean).sort(function (a, b) { return a.daysLeft - b.daysLeft; })[0];
      App.$('#app').innerHTML = '<div class="screen shelf-screen"><div class="topbar"><h1>My shelf</h1>' + (global.Scan ? Scan.hero(s, 'small') : '') + '</div>' +
        (items.length ? '<p class="hint">' + items.length + (items.length === 1 ? ' product' : ' products') + (next ? ' · the next one runs out in ' + next.daysLeft + ' days' : '') + '</p>' + '<div class="shelf-list">' + rows + '</div>'
          : '<div class="panel"><h3>Your shelf is empty</h3><p class="hint">Scan the QR code or the barcode on your Nature’s Finest pack – it lands here with how to use it and how long it lasts.</p></div>' + (global.Scan ? Scan.hero(s, 'home') : '')) +
        (cross ? '<div class="panel shelf-cross">' + (ce && ce.img ? '<img class="shelf-img" src="' + esc(ce.img) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '') +
          '<div><div class="kicker">Complete your routine</div><h3 translate="no">' + esc(cross.name) + '</h3>' +
          '<p class="hint">' + (owned ? 'People who take <span class="ph">' + esc(owned.name) + '</span> often add it next.' : 'Often added next by people with your routine.') + '</p>' +
          '<div class="shelf-acts">' + (cfg().sample !== false && owned ? '<a class="btn sm primary focusable" id="shSample" target="_blank" rel="noopener" href="' + esc((H.reorderUrl(owned, code, 'sample') || '') + '&fm_sample=' + encodeURIComponent(cross.id)) + '">🎁 Free sample in my next package</a>' : '') +
          '<button class="btn sm ghost focusable" data-go="product" data-p=\'{"id":"' + esc(cross.id) + '","src":"shelf"}\'>How to use it</button><button class="btn sm ghost focusable" id="shNo">No, thanks</button></div></div></div>' : '') +
        '</div>';
      if (cross) emit('complement_suggested', { product: cross.name, product_id: String(cross.id), where: 'shelf' });
      $$('[data-newpack]').forEach(function (b) { b.onclick = function () { H.openPack(b.getAttribute('data-newpack')); }; });
      $$('[data-reorder]').forEach(function (a) { a.addEventListener('click', function () { emit('reorder_clicked', { product_id: a.getAttribute('data-reorder'), where: 'shelf' }); }); });
      $$('[data-sub]').forEach(function (b) {
        b.onclick = function () {
          var it = items.filter(function (x) { return x.id === b.getAttribute('data-sub'); })[0];
          emit('subscription_interest', { product: it && it.name, product_id: it && it.pid });
          if (sub.live && sub.url) { global.open(sub.url, '_blank', 'noopener'); return; }
          var p = H.prog(st()); p.subInterest = p.subInterest || {}; p.subInterest[it.pid] = H.ymd(); App.save();
          App.toast('Noted – we’ll let you know as soon as automatic delivery is available 🔁');
        };
      });
      if ($('#shSample')) $('#shSample').addEventListener('click', function () { var p = H.prog(st()); p.cross.last = new Date().toISOString(); App.save(); emit('complement_sample', { product_id: String(cross.id) }); });
      if ($('#shNo')) $('#shNo').onclick = function () { var p = H.prog(st()); p.cross.last = new Date().toISOString(); p.cross.dismissed.push(cross.id); App.save(); App.toast('Got it – no more suggestions for a while'); App.refresh(); };
    };

    // Today: one card for the shelf and scanning – packs with days left, and the scan button for a new pack or product
    // (only with products in the routine; a first-time user keeps the big "Scan your product" card)
    var home = App.SCREENS.home;
    App.SCREENS.home = function (p) {
      home(p);
      var s = st(); if (!s || !H || !H.active(s) || document.querySelector('.shelf-card')) return;
      var now = new Date(), its = H.items(s).slice(0, 4);
      var html = '<div class="shelf-card"><button class="sc-head focusable" data-go="shelf"><b>📦 My shelf</b><span class="set-chev">›</span></button>' +
        '<button class="shelf-pills focusable" data-go="shelf">' + its.map(function (it) {
        var sup = H.supply(s, it, now), d = sup ? sup.daysLeft : null;
        return '<span class="shelf-pill' + (d != null && d <= 5 ? ' low' : '') + '"><span translate="no">' + esc(it.name.length > 16 ? it.name.slice(0, 15) + '…' : it.name) + '</span>' + (d != null ? ' · <span class="ph">' + d + '</span> d' : '') + '</span>';
      }).join('') + '</button>' +
        '<button class="btn primary focusable sc-scan" data-go="scan">📷 Scan a pack</button></div>';
      var hero = document.querySelector('.scan-hero:not(.first)');
      if (hero) { hero.insertAdjacentHTML('afterend', html); hero.remove(); return; }
      var anchor = document.querySelector('.scan-hero') || document.querySelector('.buddy');
      if (anchor) anchor.insertAdjacentHTML('afterend', html);
    };
    // My program: a way to the shelf next to the scan button
    var program = App.SCREENS.program;
    App.SCREENS.program = function (p) {
      program(p);
      var bar = document.querySelector('.screen .topbar'); if (!bar || bar.querySelector('.shelf-link') || !H.active(st())) return;
      bar.insertAdjacentHTML('beforeend', '<button class="btn focusable shelf-link" data-go="shelf">📦 My shelf</button>');
    };
  });
})(typeof window !== 'undefined' ? window : global);
