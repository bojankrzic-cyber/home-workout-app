/*
 * In-app scanner for a Nature's Finest pack: the QR code OR the barcode – people point at either.
 * Recognises every QR already printed (qrstud.io short links, mapped to the SKU in js/catalog.js), the new
 * app links (?p=<sku>), EAN barcodes (from the ERP, catalog field b) and a typed product number.
 * It reads by itself while the code is in the frame; "📸 Scan now" grabs a sharp still and tries harder,
 * "Take a photo" uses the phone's own camera app (autofocus, full resolution) – the sure way on iPhone.
 * Decoders: the native BarcodeDetector where it exists (Chrome / Android), else ZXing (QR + EAN, loaded on
 * first use), jsQR as the last fallback. No camera → "find your product" by name or number.
 */
(function (global) {
  'use strict';
  var JSQR = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
  var ZXING = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
  function ean(text) {
    var cat = global.FS_CATALOG || {}, d = String(text).replace(/\D/g, '');
    if (d.length === 12) d = '0' + d;                                 // UPC-A read as 12 digits
    for (var k in cat) if (cat[k].b && (cat[k].b.indexOf(d) >= 0 || cat[k].b.indexOf(String(text)) >= 0)) return k;
    return null;
  }

  // text from a QR code → { sku } | { url } | null
  function resolve(text) {
    text = String(text || '').trim();
    var cat = global.FS_CATALOG || {};
    if (/^\d{4}$/.test(text)) return cat[text] ? { sku: text } : null;
    if (/^\d{8}$|^\d{12,14}$/.test(text)) { var e = ean(text); return e ? { sku: e } : /^0?383005/.test(text) ? { ours: true } : null; }
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
    // big button with the live QR art (shelf card on Today)
    if (where === 'button') return '<button class="btn primary focusable sc-scan" data-go="scan"><span class="scan-art">' + QR_ART + '<i></i></span><span>Scan a product</span></button>';
    return '<div class="scan-hero' + (first ? ' first' : '') + '"><div class="scan-art">' + QR_ART + '<i></i></div><div class="scan-txt">' +
      (first ? '<div class="kicker">Bought Nature’s Finest?</div><h3>Scan your product</h3><p>How to use exactly your product, your daily routine and rewards – in 10 seconds.</p>'
        : '<h3>New pack or another product?</h3><p>Scan the QR on the pack – your routine and rewards keep counting.</p>') +
      '</div><button class="btn primary focusable scan-btn" data-go="scan">📷 Scan now</button></div>';
  }
  global.Scan = { resolve: resolve, search: search, hero: hero, ean: ean };
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
    function load(src, name) {
      return new Promise(function (ok, no) {
        if (global[name]) return ok(global[name]);
        var s = document.createElement('script'); s.src = src; s.onload = function () { global[name] ? ok(global[name]) : no(); }; s.onerror = no; document.head.appendChild(s);
      });
    }
    // one decoder for canvases: ZXing (QR + EAN + UPC, try harder) or jsQR (QR only)
    var zx = null;
    function zxReader() {
      if (zx || !global.ZXing) return zx;
      var Z = global.ZXing, hints = new Map();
      hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.QR_CODE, Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E]);
      hints.set(Z.DecodeHintType.TRY_HARDER, true);
      zx = new Z.MultiFormatReader(); zx.setHints(hints);
      return zx;
    }
    function decodeCanvas(cv) {
      var r = zxReader();
      if (r) {
        try {
          var Z = global.ZXing, src = new Z.HTMLCanvasElementLuminanceSource(cv);
          return r.decodeWithState(new Z.BinaryBitmap(new Z.HybridBinarizer(src))).getText();
        } catch (e) { return null; }
      }
      if (global.jsQR) {
        var g = cv.getContext('2d'), img = g.getImageData(0, 0, cv.width, cv.height), q = global.jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
        return q && q.data || null;
      }
      return null;
    }
    // a still (frame or photo): whole picture, then the centre, then turned 90° (a barcode held upright)
    function decodeStill(srcEl, w, h) {
      var tries = [[0, 0, w, h, 1600, 0], [w * .2, h * .2, w * .6, h * .6, 1400, 0], [0, 0, w, h, 1600, 90]];
      for (var i = 0; i < tries.length; i++) {
        var t = tries[i], sc = Math.min(1, t[4] / Math.max(t[2], t[3])), cw = Math.round(t[2] * sc), ch = Math.round(t[3] * sc);
        var cv = document.createElement('canvas'), g = cv.getContext('2d', { willReadFrequently: true });
        if (t[5]) { cv.width = ch; cv.height = cw; g.translate(ch / 2, cw / 2); g.rotate(Math.PI / 2); g.drawImage(srcEl, t[0], t[1], t[2], t[3], -cw / 2, -ch / 2, cw, ch); }
        else { cv.width = cw; cv.height = ch; g.drawImage(srcEl, t[0], t[1], t[2], t[3], 0, 0, cw, ch); }
        var txt = decodeCanvas(cv); if (txt) return txt;
      }
      return null;
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
        '<div class="scan-acts"><button class="btn primary focusable" id="scShot">📸 Scan now</button><label class="btn focusable" tabindex="0" id="scPhotoL">📷 Take a photo of the code<input type="file" id="scPhoto" accept="image/*" capture="environment" hidden></label></div>' +
        '<div class="scan-guide"><div class="sg-ok"><span class="sg-qr">' + QR_ART + '</span><b>QR code</b></div><div class="sg-ok"><span class="sg-bar"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><b>or barcode</b></div></div>' +
        '<p class="scan-hint" id="scHint">Hold the QR code or the barcode of your pack in the frame – it scans by itself. Tap “Scan now” if it takes a moment.</p>' +        '<div class="panel scan-find"><h3>No camera? Find your product</h3><input id="scQ" class="focusable" type="search" autocomplete="off" placeholder="Name or the 4-digit number on the label">' +
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
        if (!hit || hit.ours) {
          var hh = $('#scHint'); hh.classList.add('more');
          hh.textContent = hit && hit.ours ? 'This product isn’t in the app yet – find it by name below.' : 'That code isn’t one of ours – try the code on the back of the pack.';
          return false;
        }
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
          if (hh) { hh.classList.add('more'); hh.textContent = 'Not reading? Tap “Scan now”, or “Take a photo of the code” – or type the product name below.'; }
        }
        busy = true;
        var done = function () { busy = false; if (alive) raf = requestAnimationFrame(tick); };
        if (detector) {
          detector.detect(vid).then(function (codes) { if (codes && codes.length && found(codes[0].rawValue)) return; done(); }, done);
        } else if (global.ZXing || global.jsQR) {
          // every other frame: the whole picture (scaled), or the centre at full sharpness – small codes on a
          // label are often only ~150 px wide in a 1080p frame, too small once the whole frame is scaled down
          var w = vid.videoWidth, h = vid.videoHeight, crop = (frame++ % 2) === 1, sx = 0, sy = 0, sw = w, sh = h;
          if (crop) { sw = Math.round(w * 0.55); sh = Math.round(h * 0.55); sx = Math.round((w - sw) / 2); sy = Math.round((h - sh) / 2); }
          var sc = Math.min(1, (crop ? 1000 : 900) / Math.max(sw, sh));
          canvas.width = Math.round(sw * sc); canvas.height = Math.round(sh * sc);
          ctx.drawImage(vid, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
          var txt = decodeCanvas(canvas);
          if (txt && found(txt)) return;
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
            ? global.BarcodeDetector.getSupportedFormats().then(function (f) {
              var want = ['qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e'].filter(function (x) { return f.indexOf(x) >= 0; });
              if (f.indexOf('qr_code') >= 0 && f.indexOf('ean_13') >= 0) detector = new global.BarcodeDetector({ formats: want }); else throw 0;
            })
            : Promise.reject();
          ready.catch(function () {
            return load(ZXING, 'ZXing').catch(function () { return load(JSQR, 'jsQR'); })
              .then(function () { canvas = document.createElement('canvas'); ctx = canvas.getContext('2d', { willReadFrequently: true }); });
          })
            .then(function () { raf = requestAnimationFrame(tick); }, function () { noCam('The scanner could not load – find your product below.'); });
        }, function (err) {
          noCam(err && err.name === 'NotAllowedError' ? 'Camera access is off. Allow the camera for this site in your browser settings – or find your product below.' : 'No camera found – find your product below.');
        });
      }
      // 📸 a sharp still from the live picture, decoded the hard way
      $('#scShot').onclick = function () {
        var b = this, hh = $('#scHint');
        if (!stream || vid.readyState < 2) { $('#scPhoto').click(); return; }
        b.disabled = true; hh.textContent = 'Looking for the code…';
        var go = function () {
          var txt = detector ? null : decodeStill(vid, vid.videoWidth, vid.videoHeight);
          var finish = function (t) { b.disabled = false; if (t && found(t)) return; hh.classList.add('more'); hh.textContent = 'No code in the picture – move a little closer, hold still and tap again, or take a photo of the code.'; };
          if (detector) detector.detect(vid).then(function (c) { finish(c && c[0] && c[0].rawValue); }, function () { finish(null); }); else finish(txt);
        };
        (global.ZXing || global.jsQR || detector ? Promise.resolve() : load(ZXING, 'ZXing')).then(function () { setTimeout(go, 30); }, function () { setTimeout(go, 30); });
      };
      // 📷 the phone's own camera: autofocus and full resolution
      $('#scPhotoL').onclick = function (e) { if (e.target.id !== 'scPhoto') $('#scPhoto').click(); };
      $('#scPhoto').onchange = function () {
        var f = this.files && this.files[0], hh = $('#scHint'); if (!f) return;
        hh.textContent = 'Looking for the code…';
        var url = URL.createObjectURL(f), img = new Image();
        img.onload = function () {
          (global.ZXing || global.jsQR ? Promise.resolve() : load(ZXING, 'ZXing').catch(function () { return load(JSQR, 'jsQR'); })).then(function () {
            var t = decodeStill(img, img.naturalWidth, img.naturalHeight); URL.revokeObjectURL(url);
            if (t && found(t)) return;
            hh.classList.add('more'); hh.textContent = 'No code found in the photo – take it closer, with the code sharp and filling about a third of the picture.';
          });
        };
        img.src = url; this.value = '';
      };
      startCam();

      var q = $('#scQ'), res = $('#scRes'), cat = global.FS_CATALOG || {};
      q.oninput = function () {
        var hits = search(q.value);
        res.innerHTML = hits.length ? hits.map(function (k) { return '<button class="sh-line focusable" data-sku="' + k + '">' + (cat[k].img ? '<img class="sr-img" src="' + esc(cat[k].img) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<span class="ico">' + (cat[k].k === 'supplement' ? '🌿' : cat[k].k === 'drink' ? '☕' : '🥣') + '</span>') + '<span><b translate="no">' + esc(cat[k].n) + '</b><small>#' + k + (cat[k].days ? ' · ' + cat[k].days + ' days per pack' : '') + '</small></span></button>'; }).join('')
          : q.value.trim().length > 1 ? '<p class="hint">No product found – try another word.</p>' : '';
      };
      res.addEventListener('click', function (e) { var b = e.target.closest('[data-sku]'); if (b) { stop(); open({ sku: b.getAttribute('data-sku') }, 'search'); } });
    };
  });
})(typeof window !== 'undefined' ? window : global);
