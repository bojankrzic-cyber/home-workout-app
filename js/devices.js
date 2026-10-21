/*
 * Watches & sensors – what a user of each brand can do today, in order of usefulness:
 *   1. Import workouts from the watch (FIT / TCX / GPX / ZIP via js/imports.js) – route, splits AND heart
 *      rate; a run recorded on the phone and on the watch merges into one activity
 *   2. Live heart rate over Bluetooth (any standard HR strap, or a watch that broadcasts HR) – shown
 *      while recording and saved with the activity. Web Bluetooth: Android/desktop Chrome, not iPhone.
 *   3. Automatic sync – server layer ready (supabase/functions/device-ingest); switched on per provider
 *      once accounts are live. Apple Health / Health Connect come with the native app.
 * The chosen brand is kept in settings.device (also tells us which integration to build first).
 */
(window.FS_MODULES = window.FS_MODULES || []).push(function (App) {
  'use strict';
  var $ = App.$, $$ = App.$$, esc = App.esc;
  function st() { return App.state(); }

  // ---------------------------------------------------------------- Bluetooth heart rate (GATT 0x180D)
  var HeartRate = window.HeartRate = {
    dev: null, bpm: null, at: 0, name: '', subs: [],
    supported: function () { return !!(navigator.bluetooth && window.isSecureContext !== false); },
    live: function () { return HeartRate.bpm && Date.now() - HeartRate.at < 6000 ? HeartRate.bpm : null; },
    on: function (f) { HeartRate.subs.push(f); return function () { HeartRate.subs = HeartRate.subs.filter(function (x) { return x !== f; }); }; },
    emit: function () { HeartRate.subs.forEach(function (f) { try { f(HeartRate.live()); } catch (e) {} }); },
    connect: function () {
      return navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] }).then(function (d) {
        HeartRate.dev = d; HeartRate.name = d.name || 'Heart-rate sensor';
        d.addEventListener('gattserverdisconnected', function () {
          // one quiet reconnect (straps drop briefly when you move away from the phone)
          setTimeout(function () { if (HeartRate.dev === d) d.gatt.connect().then(subscribe).catch(function () { HeartRate.bpm = null; HeartRate.emit(); }); }, 1500);
        });
        return d.gatt.connect();
      }).then(subscribe);
      function subscribe(server) {
        return server.getPrimaryService('heart_rate').then(function (s) { return s.getCharacteristic('heart_rate_measurement'); })
          .then(function (c) {
            c.addEventListener('characteristicvaluechanged', function (e) {
              var v = e.target.value, flags = v.getUint8(0);
              HeartRate.bpm = flags & 1 ? v.getUint16(1, true) : v.getUint8(1);
              HeartRate.at = Date.now(); HeartRate.emit();
            });
            return c.startNotifications();
          });
      }
    },
    disconnect: function () { var d = HeartRate.dev; HeartRate.dev = null; HeartRate.bpm = null; if (d && d.gatt.connected) d.gatt.disconnect(); HeartRate.emit(); }
  };

  // ---------------------------------------------------------------- brands
  var IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var AUTO = 'Automatic sync – comes with your Nature’s Finest account';
  var NATIVE = 'Automatic sync – comes with the FinestMe app for your phone';
  var BRANDS = [
    { k: 'garmin', name: 'Garmin', ico: '⌚', auto: AUTO,
      imp: ['Garmin Connect (web or app): open the activity › ⚙ / ⋯ › <b>Export Original</b> (.zip) – or Export to GPX / TCX.', 'Import the file below – route, splits and heart rate come along.'],
      live: 'In the watch settings turn on <b>Broadcast Heart Rate</b> (Wrist Heart Rate or the controls menu), then connect below.' },
    { k: 'apple', name: 'Apple Watch', ico: '', auto: NATIVE,
      imp: ['The Health app can’t export single workouts. Use an export app such as <b>HealthFit</b> or <b>RunGap</b> to save the workout as FIT or GPX to Files.', 'Import the file below.'],
      live: null, liveNo: 'Apple Watch doesn’t share live heart rate with web apps – it comes with the FinestMe iPhone app (Apple Health).' },
    { k: 'polar', name: 'Polar', ico: '⌚', auto: AUTO,
      imp: ['Polar Flow (web): open the training session › ⋯ › <b>Export session</b> (TCX or GPX).', 'Import the file below.'],
      live: 'Polar H9/H10/Verity sensors pair directly. Polar watches: enable <b>Share HR with other devices</b> / HR sensor mode, then connect below.' },
    { k: 'suunto', name: 'Suunto', ico: '⌚', auto: AUTO,
      imp: ['Suunto app: open the workout › ⋯ › <b>Export</b> (.fit), or export GPX from a service it syncs to.', 'Import the file below.'],
      live: 'Turn on <b>Share HR</b> in the watch settings (supported models), or connect a chest strap below.' },
    { k: 'coros', name: 'COROS', ico: '⌚', auto: AUTO,
      imp: ['COROS app: open the workout › ⋯ › <b>Export data</b> (.fit, .tcx or .gpx).', 'Import the file below.'],
      live: 'Watch settings › <b>Heart Rate Broadcast</b> on, then connect below.' },
    { k: 'fitbit', name: 'Fitbit / Pixel Watch', ico: '⌚', auto: AUTO,
      imp: ['Fitbit dashboard (web): open the exercise › ⋯ › <b>Export as TCX</b>.', 'Import the file below.'],
      live: null, liveNo: 'Fitbit and Pixel Watch don’t broadcast standard heart rate – automatic sync will bring it in.' },
    { k: 'samsung', name: 'Samsung Galaxy Watch', ico: '⌚', auto: NATIVE,
      imp: ['Samsung Health doesn’t export single workouts. If you sync to another app (e.g. Strava), export GPX from there.', 'Import the file below.'],
      live: null, liveNo: 'Galaxy Watch doesn’t broadcast standard heart rate – it comes with the FinestMe Android app (Health Connect).' },
    { k: 'strap', name: 'Heart-rate strap', ico: '❤️', auto: null,
      imp: ['Straps record no workouts of their own – pair it here and FinestMe records your heart rate while you train.'],
      live: 'Polar H9/H10, Garmin HRM, Wahoo TICKR and any Bluetooth heart-rate strap: wet the electrodes, put it on, connect below.' },
    { k: 'other', name: 'Other', ico: '📲', auto: null,
      imp: ['Almost every watch and sports app can export <b>GPX, TCX or FIT</b> – import it below.'],
      live: 'Any Bluetooth heart-rate sensor or a watch that broadcasts heart rate works – connect below.' }
  ];
  var BY = {}; BRANDS.forEach(function (b) { BY[b.k] = b; });

  // ---------------------------------------------------------------- import (shared with the log screen)
  function importFiles(files) {
    if (!window.Imports) { App.toast('Importer unavailable'); return Promise.resolve(null); }
    var s = st(), kg = s.settings.weight, res = { added: [], merged: 0, dup: 0, bad: 0 };
    s.activities = s.activities || [];
    return Array.prototype.reduce.call(files, function (p, f) {
      return p.then(function () {
        return f.arrayBuffer().then(function (buf) { return Imports.parse(f.name, buf, kg); }).then(function (list) {
          if (!list || !list.length) { res.bad++; return; }
          list.forEach(function (a) {
            var d = Imports.dedupe(s.activities, a);
            if (d.action === 'added') { s.activities.push(a); res.added.push(a); }
            else if (d.action === 'merged') res.merged++;
            else res.dup++;
          });
        }).catch(function () { res.bad++; });
      });
    }, Promise.resolve()).then(function () {
      s.activities.sort(function (x, y) { return x.start < y.start ? 1 : -1; });
      App.save();
      var msg = [];
      if (res.added.length) msg.push(res.added.length + ' imported');
      if (res.merged) msg.push(res.merged + ' merged with what you recorded');
      if (res.dup) msg.push(res.dup + ' already here');
      if (res.bad) msg.push(res.bad + ' not readable');
      App.toast(msg.join(' · ') || 'Nothing to import');
      return res;
    });
  }
  App.importFiles = importFiles;
  var ACCEPT = '.fit,.FIT,.gpx,.tcx,.zip,application/gpx+xml,application/xml,text/xml,application/zip,application/octet-stream';
  App.IMPORT_ACCEPT = ACCEPT;

  // ---------------------------------------------------------------- screen
  App.SCREENS.devices = function (p) {
    var s = st(), k = p.k || s.settings.device || '', b = BY[k];
    var bt = HeartRate.supported(), hr = HeartRate.live();
    var html = '<div class="screen"><div class="topbar"><h1>Watches & sensors</h1></div>' +
      '<div class="hint">Bring in workouts from your watch, see your heart rate live, and – soon – sync automatically.</div>' +
      '<div class="panel"><h3>Which do you use?</h3><div class="dv-brands">' + BRANDS.map(function (x) {
        return '<button class="chip focusable' + (x.k === k ? ' on' : '') + '" data-dv="' + x.k + '" data-fid="dv-' + x.k + '">' + (x.ico ? x.ico + ' ' : '') + esc(x.name) + '</button>';
      }).join('') + '</div></div>';
    if (b) {
      html += '<div class="dv-cards">' +
        '<div class="panel dv-card"><div class="dv-n">1</div><h3>Import workouts</h3><ol>' + b.imp.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ol>' +
        '<label class="btn primary focusable dv-imp" tabindex="0">📂 Import FIT · GPX · TCX · ZIP<input type="file" id="dvFile" multiple accept="' + ACCEPT + '" hidden></label>' +
        '<div class="hint" id="dvRes">The same run from your phone and your watch is merged – heart rate is added, nothing doubles.</div></div>' +
        '<div class="panel dv-card"><div class="dv-n">2</div><h3>Live heart rate</h3>' +
        (b.live ? (bt ? '<p>' + b.live + '</p>' + (hr ? '<div class="dv-live">❤ <b id="dvBpm">' + hr + '</b> bpm · ' + esc(HeartRate.name) + '</div><button class="btn ghost focusable" id="dvOff">Disconnect</button>'
          : '<button class="btn primary focusable" id="dvOn">❤ Connect heart rate</button>') + '<div class="hint">Once connected, Record shows it live and saves it with the activity.</div>'
          : '<p class="dv-no">' + (IOS ? 'iPhone browsers can’t connect to Bluetooth sensors. Live heart rate comes with the FinestMe iPhone app; until then, import the workout from your watch afterwards.' : 'This browser can’t connect to Bluetooth sensors – use Chrome on Android or a computer.') + '</p>')
          : '<p class="dv-no">' + esc(b.liveNo || 'Not available for this device.') + '</p>') + '</div>' +
        '<div class="panel dv-card"><div class="dv-n">3</div><h3>Automatic sync</h3>' +
        (b.auto ? '<p>' + esc(b.auto) + ' – your workouts, heart rate' + (k === 'garmin' ? ', and FinestMe workouts sent to your watch' : '') + ', without exporting.</p>' +
          '<label class="check"><input type="checkbox" class="focusable" id="dvNotify"' + (s.settings.deviceNotify ? ' checked' : '') + '><span>Tell me when it’s ready for ' + esc(b.name) + '</span></label>'
          : '<p class="dv-no">Nothing to sync – a strap only measures; FinestMe records it with your workout.</p>') + '</div></div>';
    }
    html += '</div>';
    App.$('#app').innerHTML = html;
    $$('[data-dv]').forEach(function (x) { x.onclick = function () { s.settings.device = x.getAttribute('data-dv'); App.save(); App.refresh({ k: s.settings.device }); }; });
    var f = $('#dvFile');
    if (f) f.onchange = function () {
      var files = this.files; if (!files || !files.length) return;
      $('#dvRes').textContent = 'Importing…';
      importFiles(files).then(function (res) {
        if (!res) return;
        if (res.added.length === 1 && !res.merged) App.go('activity', { id: res.added[0].id, fresh: true });
        else App.refresh({ k: k });
      });
    };
    if ($('#dvOn')) $('#dvOn').onclick = function () {
      HeartRate.connect().then(function () { App.toast('Heart rate connected'); setTimeout(function () { App.refresh({ k: k }); }, 800); })
        .catch(function (e) { if (!/cancel/i.test(e && e.message)) App.toast('Couldn’t connect – is the sensor on and broadcasting?'); });
    };
    if ($('#dvOff')) $('#dvOff').onclick = function () { HeartRate.disconnect(); App.refresh({ k: k }); };
    if ($('#dvNotify')) $('#dvNotify').onchange = function () { s.settings.deviceNotify = this.checked; App.save(); App.toast(this.checked ? 'We’ll let you know' : 'Okay'); };
    var off = HeartRate.on(function (v) { var el = $('#dvBpm'); if (el && v) el.textContent = v; });
    App.onCleanup(off);
  };

  // Settings card
  App.hooks.settings.push(function () {
    var b = BY[st().settings.device];
    return '<div class="panel set-cta"><div><h3>Watches & sensors</h3><div class="hint">' + (b ? esc(b.name) + ' · import workouts' + (HeartRate.live() ? ' · ❤ ' + HeartRate.live() + ' bpm live' : '') : 'Import workout files from any watch (Garmin, Apple Watch, Polar …) · live heart rate from a Bluetooth chest strap') + '</div></div>' +
      '<button class="btn focusable" data-go="devices">' + (b ? 'Manage →' : 'Connect →') + '</button></div>';
  });
});
