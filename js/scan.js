/*
 * In-app scanner for the QR code on a Nature's Finest pack.
 * Recognises every code already printed (qrstud.io short links, mapped to the SKU in js/catalog.js), the
 * new app links (?p=<sku>) and a typed product number. Camera: the native BarcodeDetector where the
 * browser has one (Chrome / Android), else jsQR (loaded on first use). When the camera is blocked or
 * missing, the same screen offers "find your product" by name – the customer is never stuck.
 */
(function (global) {
  'use strict';
  var JSQR = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';

  // text from a QR code → { sku } | { url } | null
  function resolve(text) {
    text = String(text || '').trim();
    var cat = global.FS_CATALOG || {};
    if (/^\d{4}$/.test(text)) return cat[text] ? { sku: text } : null;
    var u;
    try { u = new URL(text); } catch (e) { return null; }
    var p = u.searchParams.get('p');
    if (p && cat[p]) return { sku: p };
    if (/(^|\.)qrstud\.io$/i.test(u.hostname)) {
      var code = u.pathname.replace(/^\/+|\/+$/g, '');
      for (var k in cat) if (cat[k].q && cat[k].q.indexOf(code) >= 0) return { sku: k };
    }
    var m = /\/(\d{4})[-_][^/]*\.pdf$/i.exec(u.pathname);              // a code that still points at a label PDF
    if (m && cat[m[1]]) return { sku: m[1] };
    return /^https:$/.test(u.protocol) ? { url: u.href } : null;
  }
  // product search by name or number (fallback without camera)
  function search(q, n) {
    var cat = global.FS_CATALOG || {}, words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return Object.keys(cat).filter(function (k) {
      var hay = (k + ' ' + cat[k].n).toLowerCase();
      return words.every(function (w) { return hay.indexOf(w) >= 0; });
    }).sort(function (a, b) { return (cat[b].k === 'supplement') - (cat[a].k === 'supplement') || cat[a].n.localeCompare(cat[b].n); }).slice(0, n || 12);
  }
  // The way in – the scanner is shown where the customer is: Today (under the greeting), the ＋ menu and
  // My program. One component, three sizes; first-time wording until a routine exists.
  var QR_ART = '<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="currentColor"><path d="M4 4h14v14H4zm4 4v6h6V8zM30 4h14v14H30zm4 4v6h6V8zM4 30h14v14H4zm4 4v6h6v-6z"/>' +
    '<path d="M22 4h4v4h-4zm0 8h4v6h-4zm8 14h4v4h-4zm8 0h6v4h-6zm-16 0h4v8h-4zm8 8h4v4h-4zm8 0h6v4h-6zm-8 8h4v6h-4zm8 0h4v6h-4zM4 22h6v4H4zm10 0h4v4h-4z"/></g></svg>';
  function hero(s, where) {
    var first = !(s && s.settings && (s.settings.routine || []).length);
    if (where === 'sheet') return '<button class="scan-line focusable" data-sgo="scan" data-p=\'{}\'><span class="scan-art">' + QR_ART + '<i></i></span><span><b>Scan a product</b><small>QR code on your Nature’s Finest pack → how to use it + your routine</small></span><span class="scan-go">📷</span></button>';
    if (where === 'small') return '<button class="btn focusable scan-small" data-go="scan">📷 Scan a pack</button>';
    return '<div class="scan-hero' + (first ? ' first' : '') + '"><div class="scan-art">' + QR_ART + '<i></i></div><div class="scan-txt">' +
      (first ? '<div class="kicker">Bought Nature’s Finest?</div><h3>Scan your product</h3><p>How to use exactly your product, your daily routine and rewards – in 10 seconds.</p>'
        : '<h3>New pack or another product?</h3><p>Scan the QR on the pack – your routine and rewards keep counting.</p>') +
      '</div><button class="btn primary focusable scan-btn" data-go="scan">📷 Scan now</button></div>';
  }
  global.Scan = { resolve: resolve, search: search, hero: hero };
  if (!global.FS_MODULES) return;

  global.FS_MODULES.push(function (App) {
    var $ = App.$, esc = App.esc;
    // My program: scan a new pack / another product right at the top
    var program = App.SCREENS.program;
    if (program) App.SCREENS.program = function (p) {
      program(p);
      var bar = document.querySelector('.screen .topbar'); if (!bar || bar.querySelector('.scan-small')) return;
      bar.insertAdjacentHTML('beforeend', hero(App.state(), 'small'));
    };
    function loadJsQR() {
      return new Promise(function (ok, no) {
        if (global.jsQR) return ok(global.jsQR);
        var s = document.createElement('script'); s.src = JSQR; s.onload = function () { ok(global.jsQR); }; s.onerror = no; document.head.appendChild(s);
      });
    }
    function open(hit, src) {
      if (hit.sku) { App.go('product', { id: hit.sku, src: src || 'scan' }, true); return; }
      App.ask('This code is not a product guide. Open the link?', 'Open', function () { global.open(hit.url, '_blank', 'noopener'); });
    }

    App.SCREENS.scan = function () {
      var stream = null, alive = true, raf = 0, detector = null, canvas = null, ctx = null, busy = false, frame = 0, t0 = Date.now(), helped = false;
      App.$('#app').innerHTML = '<div class="screen scan-screen"><div class="topbar"><h1>Scan your product</h1></div>' +
        '<div class="scan-cam" id="scCam"><video id="scVid" playsinline muted></video><div class="scan-frame"><i></i><i></i><i></i><i></i></div>' +
        '<button class="btn sm focusable scan-torch" id="scTorch" hidden>🔦 Light</button></div>' +
        '<div class="scan-guide"><div class="sg-ok"><span class="sg-qr">' + QR_ART + '</span><b>✓ The small square code</b></div><div class="sg-no"><span class="sg-bar"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><b>✗ Not the barcode</b></div></div>' +
        '<p class="scan-hint" id="scHint">Hold the phone 10–15 cm from the small square code on the label – it is usually next to the nutrition table.</p>' +
        '<div class="panel scan-find"><h3>No camera? Find your product</h3><input id="scQ" class="focusable" type="search" autocomplete="off" placeholder="Name or the 4-digit number on the label">' +
        '<div class="scan-res" id="scRes"></div></div></div>';
      var vid = $('#scVid');

      function stop() {
        alive = false; cancelAnimationFrame(raf);
        if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
        stream = null;
      }
      App.onCleanup(stop);
      function found(text) {
        var hit = resolve(text);
        if (!hit) { $('#scHint').textContent = 'That code isn’t one of ours – try the code on the back of the pack.'; return false; }
        if (navigator.vibrate) navigator.vibrate(60);
        stop(); open(hit, 'scan');
        return true;
      }
      function noCam(msg) {
        var cam = $('#scCam'); if (cam) cam.classList.add('off');
        $('#scHint').textContent = msg;
        if (!App.TOUCH) return;
        var q = $('#scQ'); if (q) q.focus();
      }
      function tick() {
        if (!alive) return;
        if (busy || vid.readyState < 2) { raf = requestAnimationFrame(tick); return; }
        if (!helped && Date.now() - t0 > 9000) {
          helped = true; var hh = $('#scHint');
          if (hh) { hh.classList.add('more'); hh.textContent = 'Can’t find it? Move closer to the square code, turn the pack so the code faces the camera, or type the 4-digit number from the label below.'; }
        }
        busy = true;
        var done = function () { busy = false; if (alive) raf = requestAnimationFrame(tick); };
        if (detector) {
          detector.detect(vid).then(function (codes) { if (codes && codes.length && found(codes[0].rawValue)) return; done(); }, done);
        } else if (global.jsQR) {
          // every other frame: the whole picture (scaled), or the centre at full sharpness – small codes on a
          // label are often only ~150 px wide in a 1080p frame, too small once the whole frame is scaled down
          var w = vid.videoWidth, h = vid.videoHeight, crop = (frame++ % 2) === 1, sx = 0, sy = 0, sw = w, sh = h;
          if (crop) { sw = Math.round(w * 0.55); sh = Math.round(h * 0.55); sx = Math.round((w - sw) / 2); sy = Math.round((h - sh) / 2); }
          var sc = Math.min(1, (crop ? 1000 : 900) / Math.max(sw, sh));
          canvas.width = Math.round(sw * sc); canvas.height = Math.round(sh * sc);
          ctx.drawImage(vid, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
          var img = ctx.getImageData(0, 0, canvas.width, canvas.height), r = global.jsQR(img.data, img.width, img.height, { inversionAttempts: frame % 6 < 2 ? 'attemptBoth' : 'dontInvert' });
          if (r && r.data && found(r.data)) return;
          done();
        } else done();
      }
      function startCam() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return noCam('This browser can’t use the camera here – find your product below.');
        navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }).then(function (s) {
          if (!alive) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
          stream = s; vid.srcObject = s; vid.play().catch(function () {});
          var track = s.getVideoTracks()[0], caps = track && track.getCapabilities ? track.getCapabilities() : {};
          if (caps.focusMode && caps.focusMode.indexOf('continuous') >= 0) track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(function () {});
          if (caps.torch) {
            var tb = $('#scTorch'), on = false; tb.hidden = false;
            tb.onclick = function () { on = !on; track.applyConstraints({ advanced: [{ torch: on }] }).catch(function () {}); tb.classList.toggle('on', on); };
          }
          var ready = 'BarcodeDetector' in global
            ? global.BarcodeDetector.getSupportedFormats().then(function (f) { if (f.indexOf('qr_code') >= 0) detector = new global.BarcodeDetector({ formats: ['qr_code'] }); else throw 0; })
            : Promise.reject();
          ready.catch(function () { return loadJsQR().then(function () { canvas = document.createElement('canvas'); ctx = canvas.getContext('2d', { willReadFrequently: true }); }); })
            .then(function () { raf = requestAnimationFrame(tick); }, function () { noCam('The scanner could not load – find your product below.'); });
        }, function (err) {
          noCam(err && err.name === 'NotAllowedError' ? 'Camera access is off. Allow the camera for this site in your browser settings – or find your product below.' : 'No camera found – find your product below.');
        });
      }
      startCam();

      var q = $('#scQ'), res = $('#scRes'), cat = global.FS_CATALOG || {};
      q.oninput = function () {
        var hits = search(q.value);
        res.innerHTML = hits.length ? hits.map(function (k) { return '<button class="sh-line focusable" data-sku="' + k + '"><span class="ico">' + (cat[k].k === 'supplement' ? '🌿' : cat[k].k === 'drink' ? '☕' : '🥣') + '</span><span><b translate="no">' + esc(cat[k].n) + '</b><small>#' + k + (cat[k].days ? ' · ' + cat[k].days + ' days per pack' : '') + '</small></span></button>'; }).join('')
          : q.value.trim().length > 1 ? '<p class="hint">No product found – try another word.</p>' : '';
      };
      res.addEventListener('click', function (e) { var b = e.target.closest('[data-sku]'); if (b) { stop(); open({ sku: b.getAttribute('data-sku') }, 'search'); } });
    };
  });
})(typeof window !== 'undefined' ? window : global);
