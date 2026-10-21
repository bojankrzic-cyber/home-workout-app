/*
 * Share to social – one image, every network.
 *
 * App.share(card) opens a sheet that renders the moment (activity, workout, record, week) into an image:
 *   Story 9:16 · Post 1:1 · Sticker (transparent – lay it over your own photo in Instagram/TikTok stories),
 * optionally over a photo the user picks. "Share…" hands the PNG + caption to the phone's own share sheet
 * (Web Share API) – Instagram, TikTok, Facebook, WhatsApp, X, Threads, Messenger, Snapchat… whatever is
 * installed. Without it (most desktops): save the image, copy the caption, or open a network's share link.
 *
 * Privacy: routes hide the first and last 200 m by default (where you live).
 * Attribution: the link carries utm_source=share&utm_medium=social&utm_content=<kind>.
 *
 * card = { kind, eyebrow, title, subtitle, stats: [[value, label]…], pts?, badge?, caption, tags? }
 */
(window.FS_MODULES = window.FS_MODULES || []).push(function (App) {
  'use strict';
  var $ = App.$, $$ = App.$$, esc = App.esc;
  var FORMATS = { story: { w: 1080, h: 1920, name: 'Story' }, post: { w: 1080, h: 1080, name: 'Post' }, sticker: { w: 1080, h: 1350, name: 'Sticker' } };
  var GREEN = '#3ec46d', MINT = '#5ad1b8', INK = '#eef4ef', MUTED = '#9fb5a6';

  function link(kind) {
    var base = (window.FS_CONFIG && FS_CONFIG.shareUrl) || location.href.split('#')[0].split('?')[0];
    return base + '?utm_source=share&utm_medium=social&utm_campaign=finestme&utm_content=' + encodeURIComponent(kind || 'moment');
  }
  // routes: drop the first/last 200 m so a shared map doesn't point to your front door
  function trim(pts, m) {
    if (!pts || pts.length < 4) return pts || [];
    var T = window.Track, d = 0, a = 0, b = pts.length - 1;
    for (a = 1; a < pts.length && d < m; a++) d += T.dist(pts[a - 1], pts[a]);
    d = 0;
    for (b = pts.length - 2; b > a && d < m; b--) d += T.dist(pts[b], pts[b + 1]);
    return b - a > 3 ? pts.slice(a, b + 1) : [];
  }

  // ---------------------------------------------------------------- image
  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all(['italic 600 120px "Barlow Condensed"', '600 40px "Rethink Sans"', '500 30px "Rethink Sans"']
      .map(function (f) { return document.fonts.load(f).catch(function () {}); }));
  }
  function render(card, opt) {
    var F = FORMATS[opt.format], W = F.w, H = F.h;
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d'), sticker = opt.format === 'sticker';
    // background
    if (!sticker) {
      if (opt.photo) {
        var img = opt.photo, r = Math.max(W / img.width, H / img.height);
        g.drawImage(img, (W - img.width * r) / 2, (H - img.height * r) / 2, img.width * r, img.height * r);
        var sh = g.createLinearGradient(0, 0, 0, H); sh.addColorStop(0, 'rgba(3,8,5,.35)'); sh.addColorStop(.45, 'rgba(3,8,5,.15)'); sh.addColorStop(1, 'rgba(3,8,5,.88)');
        g.fillStyle = sh; g.fillRect(0, 0, W, H);
      } else {
        var bg = g.createRadialGradient(W * .2, H * .1, 50, W * .5, H * .5, H);
        bg.addColorStop(0, '#0f3b22'); bg.addColorStop(.55, '#08130c'); bg.addColorStop(1, '#040805');
        g.fillStyle = bg; g.fillRect(0, 0, W, H);
      }
    }
    var pad = 84, y = sticker ? 120 : opt.format === 'story' ? 210 : 110;
    // route
    var pts = opt.hideEnds ? trim(card.pts, 200) : (card.pts || []);
    var routeH = pts.length > 1 ? (opt.format === 'story' ? 820 : opt.format === 'sticker' ? 520 : 380) : 0;
    if (routeH) {
      var lat0 = pts[0][0], k = Math.cos(lat0 * Math.PI / 180);
      var xs = pts.map(function (p) { return p[1] * k; }), ys = pts.map(function (p) { return -p[0]; });
      var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
      var bw = W - 2 * pad, s = Math.min(bw / Math.max(x1 - x0, 1e-9), routeH / Math.max(y1 - y0, 1e-9));
      var ox = pad + (bw - (x1 - x0) * s) / 2, oy = y + (routeH - (y1 - y0) * s) / 2;
      g.lineJoin = g.lineCap = 'round';
      [[34, 'rgba(62,196,109,.18)'], [18, 'rgba(62,196,109,.35)'], [9, GREEN]].forEach(function (st) {
        g.strokeStyle = st[1]; g.lineWidth = st[0]; g.beginPath();
        var seg = null;
        pts.forEach(function (p, i) {
          var px = ox + (p[1] * k - x0) * s, py = oy + (-p[0] - y0) * s;
          if (i === 0 || p[4] !== seg) g.moveTo(px, py); else g.lineTo(px, py);
          seg = p[4];
        });
        g.stroke();
      });
      y += routeH + (opt.format === 'post' ? 30 : 90);
    } else y = opt.format === 'story' ? 620 : opt.format === 'sticker' ? 330 : 250;
    if (opt.format === 'post' && routeH) y = Math.max(y, 520);
    // texts
    g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    function text(t, font, color, x, yy, max) { g.font = font; g.fillStyle = color; g.fillText(window.I18N ? I18N.t(t) : t, x, yy, max || W - 2 * pad); }
    if (sticker) { g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 18; }
    text(String(card.eyebrow || '').toUpperCase(), '600 38px "Rethink Sans", sans-serif', MINT, pad, y); y += 130;
    text(card.title, 'italic 600 150px "Barlow Condensed", "Arial Narrow", sans-serif', INK, pad, y); y += 70;
    if (card.subtitle) { text(card.subtitle, '500 36px "Rethink Sans", sans-serif', sticker ? INK : MUTED, pad, y); y += 40; }
    if (card.badge) {
      y += 30; g.font = '600 36px "Rethink Sans", sans-serif';
      var bwid = g.measureText(card.badge).width + 60;
      g.fillStyle = 'rgba(252,185,0,.18)'; roundRect(g, pad, y, bwid, 70, 35); g.fill();
      text(card.badge, '600 36px "Rethink Sans", sans-serif', '#fcb900', pad + 30, y + 48); y += 70;
    }
    var stats = (card.stats || []).slice(0, 3);
    if (stats.length) {
      y += 90; var cw = (W - 2 * pad) / stats.length;
      stats.forEach(function (st, i) {
        text(String(st[0]), 'italic 600 96px "Barlow Condensed", "Arial Narrow", sans-serif', INK, pad + i * cw, y, cw - 20);
        text(String(st[1]).toUpperCase(), '600 30px "Rethink Sans", sans-serif', sticker ? INK : MUTED, pad + i * cw, y + 48, cw - 20);
      });
      y += 48;
    }
    // brand footer
    var fy = H - (opt.format === 'story' ? 150 : 90);
    // Rutina wordmark
    g.font = '700 78px "Fraunces", Georgia, serif';
    g.fillStyle = INK; try { g.fontVariantLigatures = 'none'; } catch (e) {}
    g.fillText('rutina', pad, fy);
    text('BY NATURE’S FINEST', '600 24px "Rethink Sans", sans-serif', sticker ? INK : MUTED, pad + 2, fy + 36);
    g.shadowBlur = 0;
    return c;
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function toBlob(c) { return new Promise(function (res) { c.toBlob(function (b) { res(b); }, 'image/png'); }); }

  // ---------------------------------------------------------------- sheet
  var NETS = [
    { k: 'whatsapp', name: 'WhatsApp', url: function (t, u) { return 'https://wa.me/?text=' + encodeURIComponent(t + ' ' + u); } },
    { k: 'facebook', name: 'Facebook', url: function (t, u) { return 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(u) + '&quote=' + encodeURIComponent(t); } },
    { k: 'x', name: 'X', url: function (t, u) { return 'https://x.com/intent/post?text=' + encodeURIComponent(t) + '&url=' + encodeURIComponent(u); } },
    { k: 'threads', name: 'Threads', url: function (t, u) { return 'https://www.threads.net/intent/post?text=' + encodeURIComponent(t + ' ' + u); } },
    { k: 'linkedin', name: 'LinkedIn', url: function (t, u) { return 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(u); } },
    { k: 'telegram', name: 'Telegram', url: function (t, u) { return 'https://t.me/share/url?url=' + encodeURIComponent(u) + '&text=' + encodeURIComponent(t); } },
    { k: 'pinterest', name: 'Pinterest', url: function (t, u) { return 'https://pinterest.com/pin/create/button/?url=' + encodeURIComponent(u) + '&description=' + encodeURIComponent(t); } }
  ];
  function close() { var w = document.querySelector('.share-wrap'); if (w) { var u = w.getAttribute('data-url'); if (u) URL.revokeObjectURL(u); w.remove(); } }
  App.share = function (card) {
    close();
    var opt = { format: 'story', hideEnds: true, photo: null }, blob = null, url = link(card.kind);
    var caption = (card.caption || card.title) + '\n' + (card.tags || ['#Rutina', '#NaturesFinest']).join(' ');
    var canFiles = !!(navigator.canShare && navigator.share);
    var w = document.createElement('div'); w.className = 'sheet-wrap share-wrap';
    w.innerHTML = '<div class="sheet share-sheet" role="dialog" aria-modal="true"><div class="sh-grab"></div>' +
      '<button class="sh-back focusable" id="shClose" aria-label="Close">✕</button><h3>Share</h3>' +
      '<div class="sh-prev"><img id="shImg" alt="Preview of the image to share"></div>' +
      '<div class="sh-row">' + Object.keys(FORMATS).map(function (k) { return '<button class="chip focusable' + (k === opt.format ? ' on' : '') + '" data-fmt="' + k + '">' + FORMATS[k].name + '</button>'; }).join('') +
      '<label class="chip focusable sh-photo" tabindex="0">📷 Photo<input type="file" id="shPhoto" accept="image/*" hidden></label></div>' +
      (card.pts && card.pts.length > 1 ? '<label class="check"><input type="checkbox" id="shHide" class="focusable" checked><span>Hide the start and end of my route (privacy)</span></label>' : '') +
      '<textarea class="field focusable" id="shCap" rows="3" maxlength="600">' + esc(caption) + '</textarea>' +
      '<button class="btn primary focusable sh-go" id="shGo">' + (canFiles ? '↗ Share…  Instagram · TikTok · WhatsApp · more' : '⬇ Save image') + '</button>' +
      '<div class="sh-row sh-small"><button class="btn sm focusable" id="shSave">⬇ Save image</button><button class="btn sm focusable" id="shCopy">⧉ Copy caption</button></div>' +
      '<div class="sh-nets">' + NETS.map(function (n) { return '<a class="sh-net focusable" data-net="' + n.k + '" target="_blank" rel="noopener">' + n.name + '</a>'; }).join('') + '</div>' +
      '<div class="hint">Instagram & TikTok: use Share… on your phone, or save the image and add it to your story or post. Sticker = transparent, for your own photo.</div></div>';
    document.body.appendChild(w);
    w.addEventListener('click', function (e) { if (e.target === w) close(); });
    $('#shClose', w).onclick = close;
    function cap() { return $('#shCap', w).value; }
    function nets() { $$('[data-net]', w).forEach(function (a) { var n = NETS.filter(function (x) { return x.k === a.getAttribute('data-net'); })[0]; a.href = n.url(cap(), url); }); }
    $('#shCap', w).oninput = nets; nets();
    var busy = Promise.resolve();
    function redraw() {
      busy = fontsReady().then(function () { return toBlob(render(card, opt)); }).then(function (b) {
        blob = b; var old = w.getAttribute('data-url'); if (old) URL.revokeObjectURL(old);
        var u = URL.createObjectURL(b); w.setAttribute('data-url', u); $('#shImg', w).src = u;
        $('#shImg', w).parentNode.className = 'sh-prev f-' + opt.format;
      });
      return busy;
    }
    $$('[data-fmt]', w).forEach(function (b) { b.onclick = function () { opt.format = b.getAttribute('data-fmt'); $$('[data-fmt]', w).forEach(function (x) { x.classList.toggle('on', x === b); }); redraw(); }; });
    if ($('#shHide', w)) $('#shHide', w).onchange = function () { opt.hideEnds = this.checked; redraw(); };
    $('#shPhoto', w).onchange = function () {
      var f = this.files && this.files[0]; if (!f) return;
      var im = new Image(); im.onload = function () { opt.photo = im; if (opt.format === 'sticker') opt.format = 'story'; redraw(); };
      im.src = URL.createObjectURL(f);
    };
    function fileName() { return 'rutina-' + (card.kind || 'moment') + '-' + new Date().toISOString().slice(0, 10) + '.png'; }
    function save() {
      busy.then(function () {
        var a = document.createElement('a'); a.href = w.getAttribute('data-url'); a.download = fileName();
        document.body.appendChild(a); a.click(); a.remove(); App.toast('Image saved');
      });
    }
    $('#shSave', w).onclick = save;
    $('#shCopy', w).onclick = function () {
      var t = cap() + '\n' + url;
      (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { App.toast('Caption copied'); })
        .catch(function () { var ta = $('#shCap', w); ta.select(); App.toast('Select and copy the caption'); });
    };
    $('#shGo', w).onclick = function () {
      if (!canFiles) { save(); return; }
      busy.then(function () {
        var file = new File([blob], fileName(), { type: 'image/png' });
        var data = { files: [file], text: cap() + '\n' + url, title: card.title };
        if (!navigator.canShare(data)) data = { text: cap() + '\n' + url, title: card.title, url: url };
        return navigator.share(data).then(function () { App.toast('Shared – nice! 🎉'); close(); });
      }).catch(function (e) { if (e && e.name !== 'AbortError') save(); });
    };
    redraw();
    return busy;
  };
  App.shareClose = close;
});
