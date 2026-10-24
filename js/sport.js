/*
 * Sport tracker module – Record (GPS), activity detail, activity list, manual log + GPX import,
 * and the panels it adds to Home and Progress. Engine: js/track.js. Core API: window.App (js/app.js).
 *
 * Patterned on how the leading run/ride trackers work (record → auto-pause → splits → save with
 * effort → weekly volume + best efforts), adapted to a web app:
 *   - iOS stops GPS when the screen locks, so recording keeps the screen awake, says so up front,
 *     and bridges short screen-off gaps (js/track.js)
 *   - the recording survives a reload or a killed tab (snapshot in localStorage every few seconds)
 *   - maps load on demand (Leaflet from cdnjs); without network the route is drawn as SVG
 */
(window.FS_MODULES = window.FS_MODULES || []).push(function (App) {
  'use strict';
  var T = window.Track, $ = App.$, $$ = App.$$, esc = App.esc;
  var S = App.SCREENS;
  function st() { return App.state(); }
  function acts() { var s = st(); s.activities = s.activities || []; return s.activities; }
  function byId(id) { return acts().filter(function (a) { return a.id === id; })[0]; }
  function typeOf(k) { return T.TYPES[k] || T.TYPES.other; }
  function isSpeed(a) { return typeOf(a.type).unit === 'speed'; }
  function paceTxt(a, sec, m) { return isSpeed(a) ? T.speed(sec, m) : T.pace(sec, m); }
  function paceUnit(a) { return isSpeed(a) ? 'km/h' : '/km'; }
  function dateTxt(iso) {
    var d = new Date(iso), now = new Date(), y = new Date(); y.setDate(now.getDate() - 1);
    var day = d.toDateString() === now.toDateString() ? 'Today' : d.toDateString() === y.toDateString() ? 'Yesterday' : d.toLocaleDateString((window.I18N && I18N.locale || 'en-GB'), { weekday: 'short', day: 'numeric', month: 'short' });
    return day + ' · ' + d.toLocaleTimeString((window.I18N && I18N.locale || 'en-GB'), { hour: '2-digit', minute: '2-digit' });
  }
  function save() { App.save(); }

  // ---------------------------------------------------------------- maps
  var leafletP = null;
  function leaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletP) return leafletP;
    leafletP = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
      s.onload = function () { res(window.L); };
      s.onerror = function () { leafletP = null; rej(new Error('offline')); };
      document.head.appendChild(s);
    });
    return leafletP;
  }
  // OpenStreetMap tiles, darkened in CSS to match the app. Fine for the pilot; at scale the OSM tile policy
  // requires a commercial provider (MapTiler / Stadia / Mapbox) – swap TILES + ATTR here, nothing else.
  var TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  var ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  function segments(pts) {   // [[lat, lon], …] per recorded segment (no line across pauses)
    var out = [], cur = null, seg = null;
    (pts || []).forEach(function (p) {
      if (p[4] !== seg) { cur = []; out.push(cur); seg = p[4]; }
      cur.push([p[0], p[1]]);
    });
    return out;
  }
  // static route drawing – list thumbnails, and the fallback when the map can't load
  function routeSvg(pts, cls) {
    if (!pts || pts.length < 2) return '<div class="route-empty ' + (cls || '') + '">' + '</div>';
    var lat0 = pts[0][0], k = Math.cos(lat0 * Math.PI / 180);
    var xs = pts.map(function (p) { return p[1] * k; }), ys = pts.map(function (p) { return -p[0]; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var w = Math.max(x1 - x0, y1 - y0, 1e-6), pad = w * 0.08;
    var vb = (x0 - pad - (w - (x1 - x0)) / 2) + ' ' + (y0 - pad - (w - (y1 - y0)) / 2) + ' ' + (w + 2 * pad) + ' ' + (w + 2 * pad);
    var paths = segments(pts).map(function (s) {
      return '<polyline points="' + s.map(function (p) { return (p[1] * k).toFixed(6) + ',' + (-p[0]).toFixed(6); }).join(' ') + '"/>';
    }).join('');
    var a = pts[0], b = pts[pts.length - 1], r = w * 0.025;
    return '<svg class="route ' + (cls || '') + '" viewBox="' + vb + '" preserveAspectRatio="xMidYMid meet"><g style="stroke-width:' + (w * 0.022) + '">' + paths + '</g>' +
      '<circle class="r-start" cx="' + (a[1] * k) + '" cy="' + (-a[0]) + '" r="' + r + '"/><circle class="r-end" cx="' + (b[1] * k) + '" cy="' + (-b[0]) + '" r="' + r + '"/></svg>';
  }
  // interactive map; resolves to { map, line, dot } or null (then the SVG stays)
  function mountMap(el, pts, live, still) {
    return leaflet().then(function (L) {
      if (!el.isConnected) return null;
      el.innerHTML = '';
      var map = L.map(el, { zoomControl: false, attributionControl: true, preferCanvas: false, dragging: !still, touchZoom: !still, scrollWheelZoom: !still, doubleClickZoom: !still, boxZoom: !still, keyboard: !still });
      L.tileLayer(TILES, { attribution: ATTR, maxZoom: 19 }).addTo(map);
      var lines = segments(pts).map(function (s) { return L.polyline(s, { color: '#3ec46d', weight: 5, opacity: 0.95 }).addTo(map); });
      var dot = live ? L.circleMarker([0, 0], { radius: 8, color: '#04140a', weight: 3, fillColor: '#5ad1b8', fillOpacity: 1 }) : null;
      if (pts && pts.length > 1) {
        map.fitBounds(L.latLngBounds(pts.map(function (p) { return [p[0], p[1]]; })), { padding: [28, 28] });
        if (!live) {
          L.circleMarker([pts[0][0], pts[0][1]], { radius: 6, color: '#04140a', weight: 2, fillColor: '#3ec46d', fillOpacity: 1 }).addTo(map);
          var e = pts[pts.length - 1];
          L.circleMarker([e[0], e[1]], { radius: 6, color: '#04140a', weight: 2, fillColor: '#ff6b6b', fillOpacity: 1 }).addTo(map);
        }
      } else map.setView([46.05, 14.5], 13);
      var r = { L: L, map: map, lines: lines, dot: dot, alive: true };
      App.onCleanup(function () { r.alive = false; try { map.stop(); map.off(); map.remove(); } catch (x) {} });
      setTimeout(function () { if (r.alive) map.invalidateSize(); }, 60);
      return r;
    }).catch(function () { return null; });
  }

  // ---------------------------------------------------------------- recording
  var REC_KEY = function () { return 'formshaper.rec.' + st().id; };
  function loadSnap() { try { return JSON.parse(localStorage.getItem(REC_KEY()) || 'null'); } catch (e) { return null; } }
  function saveSnap(r) { try { localStorage.setItem(REC_KEY(), JSON.stringify(r.snapshot())); } catch (e) {} }
  function dropSnap() { try { localStorage.removeItem(REC_KEY()); } catch (e) {} }

  S.record = function (p) {
    var s = st().settings;
    var type = p.type && T.TYPES[p.type] && T.TYPES[p.type].gps ? p.type : s.trackType && T.TYPES[s.trackType] && T.TYPES[s.trackType].gps ? s.trackType : 'run';
    var snap = loadSnap(), rec = null, fix = null, watch = null, mapR = null, follow = true;
    var el = document.createElement('div');
    el.className = 'player rec-screen';
    el.innerHTML =
      '<div class="rec-map" id="rMap">' + routeSvg([]) + '</div>' +
      '<button class="btn sm ghost focusable rec-back" data-back>← Back</button>' +
      '<button class="btn sm focusable rec-center" id="rCenter" hidden>◎ Recenter</button>' +
      '<div class="rec-gps" id="rGps"><i></i><span>Searching for GPS…</span></div>' +
      '<button class="rec-hr focusable" id="rHr" hidden>❤ <b>–</b></button>' +
      '<div class="rec-panel">' +
      '<div class="rec-pick" id="rPick">' + T.MAIN_GPS.concat(T.MAIN_GPS.indexOf(type) < 0 ? [type] : []).map(function (k) {
        return '<button class="chip focusable' + (k === type ? ' on' : '') + '" data-rt="' + k + '">' + typeOf(k).ico + ' ' + typeOf(k).name + '</button>';
      }).join('') + '<button class="chip focusable ghost" id="rOther">＋ Other sport / import</button></div>' +
      '<div class="rec-state" id="rState"></div>' +
      '<div class="rec-main"><b id="rTime">0:00</b><span id="rTimeL">moving time</span></div>' +
      '<div class="rec-grid">' +
      '<div><b id="rDist">0.00</b><span>km</span></div>' +
      '<div><b id="rPace">–:––</b><span id="rPaceL">pace /km</span></div>' +
      '<div><b id="rAvg">–:––</b><span id="rAvgL">avg /km</span></div>' +
      '<div><b id="rGain">0</b><span>elev. gain m</span></div></div>' +
      '<div class="rec-hint" id="rHint">Keep this screen on while you record – phones pause GPS when the screen locks. ' +
      'Short screen-off gaps are bridged automatically.</div>' +
      '<div class="rec-ctrl" id="rCtrl"></div>' +
      '</div>';
    document.body.appendChild(el);
    App.onCleanup(function () {
      if (watch != null && navigator.geolocation) navigator.geolocation.clearWatch(watch);
      clearInterval(tick); el.remove();
    });

    function setType(k) {
      type = k; s.trackType = k; save();
      $$('[data-rt]', el).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-rt') === k); });
      var sp = typeOf(k).unit === 'speed';
      $('#rPaceL').textContent = sp ? 'speed km/h' : 'pace /km';
      $('#rAvgL').textContent = sp ? 'avg km/h' : 'avg /km';
    }
    $$('[data-rt]', el).forEach(function (b) { b.onclick = function () { if (!rec) setType(b.getAttribute('data-rt')); }; });
    $('#rOther').onclick = function () { App.go('logSport', {}, true); };
    // live heart rate from a Bluetooth strap / watch (js/devices.js); tap to connect, saved with the activity
    var HR = window.HeartRate;
    function paintHr(v) {
      var b = $('#rHr'); if (!b) return;
      b.hidden = !(HR && HR.supported());
      b.classList.toggle('on', !!v);
      b.innerHTML = v ? '❤ <b>' + v + '</b> bpm' : '❤ <b>Connect HR</b>';
      if (v && rec) rec.addHr(v);
    }
    if (HR) {
      App.onCleanup(HR.on(paintHr)); paintHr(HR.live());
      $('#rHr').onclick = function () {
        if (HR.live()) return;
        HR.connect().then(function () { App.toast('Heart rate connected'); }).catch(function (e) { if (!/cancel/i.test(e && e.message)) App.toast('Couldn’t connect – is the sensor on?'); });
      };
    }
    setType(type);

    function onSplit(n, sec) {
      App.beep(1180, 0.18);
      if (s.trackVoice === false) return;
      var a = { type: type };
      var p = isSpeed(a) ? T.speed(sec, 1000) + ' kilometres per hour' : T.pace(sec, 1000).replace(':', ' minutes ') + ' per kilometre';
      var keys = ['n_' + n, n === 1 ? 'km_one' : 'km_many'];
      if (isSpeed(a)) {
        var v = sec > 0 ? 3600 / sec : 0, tenth = Math.round(v * 10) % 10;
        keys.push('speed', 'n_' + Math.floor(v)); if (tenth) keys.push('point', 'n_' + tenth); keys.push('kmh');
      }
      else { var mm = Math.floor(sec / 60), ss = Math.round(sec % 60); keys.push('pace', 'n_' + mm, ss === 0 ? 'minutes_flat' : ss < 10 ? 'oh_' + ss : 'n_' + ss, 'per_km'); }
      App.cue(n + (n === 1 ? ' kilometre' : ' kilometres') + '. ' + (isSpeed(a) ? 'Speed ' : 'Pace ') + p + '.', keys);
    }
    function newRec() { return new T.Recorder(type, { onSplit: onSplit }); }

    // ----- GPS
    function gpsStatus(txt, cls) { var g = $('#rGps'); g.className = 'rec-gps ' + (cls || ''); $('span', g).textContent = txt; }
    var lastSave = 0;
    function onPos(pos) {
      var c = pos.coords;
      fix = { lat: c.latitude, lon: c.longitude, acc: c.accuracy, ele: c.altitude, ts: pos.timestamp || Date.now() };
      gpsStatus(c.accuracy <= 20 ? 'GPS ready · ±' + Math.round(c.accuracy) + ' m' : c.accuracy <= 35 ? 'GPS ok · ±' + Math.round(c.accuracy) + ' m' : 'Weak GPS · ±' + Math.round(c.accuracy) + ' m – move into the open',
        c.accuracy <= 20 ? 'good' : c.accuracy <= 35 ? 'ok' : 'weak');
      if (rec) {
        rec.add(fix);
        if (Date.now() - lastSave > 4000) { lastSave = Date.now(); saveSnap(rec); }
      }
      drawLive();
      paint();
    }
    // Location: the system prompt appears as soon as Record opens (no extra tap). If it was refused,
    // show the exact switch for this phone, a one-tap retry, and the option to record time only.
    var denied = false;
    var IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var ANDROID = /Android/.test(navigator.userAgent);
    function locHelp(again) {
      var steps = IOS ? ['In Safari, tap <b>aA</b> (left of the address) › <b>Website Settings</b> › <b>Location</b> › <b>Allow</b>.',
        'Still off? Settings › Privacy &amp; Security › <b>Location Services</b> on › <b>Safari Websites</b> › <b>While Using the App</b>.']
        : ANDROID ? ['Tap the icon left of the address › <b>Permissions</b> › <b>Location</b> › <b>Allow</b>.', 'Check that the phone’s <b>Location</b> is on (swipe down from the top).']
        : ['Click the icon left of the address › <b>Location</b> › <b>Allow</b>.'];
      return '<div class="loc-card"><b>📍 Location is off for this app</b><p>' + (again ? 'Still off. After changing the setting, reload once:' : 'Turn it on once – after that it’s on automatically every time you record:') + '</p>' +
        '<ol>' + steps.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ol></div>';
    }
    function onErr(e) {
      if (e.code === 1) {
        denied = true;
        gpsStatus('Location is off', 'weak');
        $('#rHint').innerHTML = locHelp(false);
        if (!rec) controls();
      } else gpsStatus(e.code === 3 ? 'Still searching for GPS…' : 'GPS unavailable – move into the open', 'weak');
    }
    function watchGps() {
      if (watch != null) navigator.geolocation.clearWatch(watch);
      watch = navigator.geolocation.watchPosition(function (pos) { if (denied) { denied = false; $('#rHint').innerHTML = HINT; if (!rec) controls(); } onPos(pos); }, onErr,
        { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
    }
    function retry() {
      gpsStatus('Asking for location…', '');
      navigator.geolocation.getCurrentPosition(function (pos) { denied = false; $('#rHint').innerHTML = HINT; watchGps(); onPos(pos); controls(); },
        function (e) { if (e.code === 1) { $('#rHint').innerHTML = locHelp(true); controls(true); } else onErr(e); },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
    }
    var HINT = $('#rHint').innerHTML;
    if (navigator.geolocation) watchGps();
    else { denied = true; gpsStatus('No GPS on this device', 'weak'); }

    // ----- map
    mountMap($('#rMap'), [], true).then(function (m) {
      mapR = m; if (!m) return;
      m.map.on('dragstart', function () { follow = false; $('#rCenter').hidden = false; });
      drawLive(true);
    });
    $('#rCenter').onclick = function () { follow = true; this.hidden = true; drawLive(true); };
    function drawLive(force) {
      var pts = rec ? rec.pts : [];
      if (mapR && !mapR.alive) return;
      if (!mapR) { if (rec && pts.length > 1 && (force || pts.length % 5 === 0)) $('#rMap').innerHTML = routeSvg(pts, 'live'); return; }
      var L = mapR.L, segs = segments(pts);
      mapR.lines.forEach(function (l) { mapR.map.removeLayer(l); });
      mapR.lines = segs.map(function (sg) { return L.polyline(sg, { color: '#3ec46d', weight: 6, opacity: 0.95 }).addTo(mapR.map); });
      if (fix) {
        mapR.dot.setLatLng([fix.lat, fix.lon]);
        if (!mapR.map.hasLayer(mapR.dot)) mapR.dot.addTo(mapR.map);
        if (follow) mapR.map.setView([fix.lat, fix.lon], force || mapR.map.getZoom() < 15 ? 16 : mapR.map.getZoom(), { animate: !force });
      }
    }

    // ----- numbers + controls
    function paint() {
      var r = rec;
      var gps = r && r.pts.length > 1;
      $('#rTime').textContent = T.clock(r ? (gps ? r.moving : r.elapsed()) : 0);
      $('#rTimeL').textContent = gps || !r ? 'moving time' : 'time';
      $('#rDist').textContent = r ? T.km(r.d) : '0.00';
      var a = { type: type }, cur = r ? r.current() : { sec: 0, m: 0 };
      $('#rPace').textContent = cur.m > 5 ? paceTxt(a, cur.sec, cur.m) : isSpeed(a) ? '0.0' : '–:––';
      $('#rAvg').textContent = r && r.d > 20 ? paceTxt(a, r.moving, r.d) : isSpeed(a) ? '0.0' : '–:––';
      $('#rGain').textContent = r ? Math.round(r.gain) : 0;
      var stt = !r ? '' : r.state === 'paused' ? 'PAUSED · ' + T.clock(r.elapsed()) + ' total' : r.auto ? 'AUTO-PAUSED – start moving to resume' : '● RECORDING';
      var se = $('#rState'); se.textContent = stt; se.className = 'rec-state' + (r && r.state === 'rec' && !r.auto ? ' live' : r ? ' hold' : '');
      el.classList.toggle('recording', !!r);
    }
    var tick = setInterval(paint, 1000);

    function controls(reload) {
      var c = $('#rCtrl');
      if (!rec && denied) {
        c.innerHTML = (reload ? '<button class="btn primary focusable rec-go" id="rReload">↻ Reload</button>' : '<button class="btn primary focusable rec-go" id="rRetry">📍 Try again</button>') +
          '<button class="btn focusable" id="rNoGps">⏱ Without GPS</button>';
        if ($('#rRetry')) $('#rRetry').onclick = retry;
        if ($('#rReload')) $('#rReload').onclick = function () { try { sessionStorage.setItem('fs.reopen', JSON.stringify({ type: type })); } catch (e) {} location.reload(); };
        $('#rNoGps').onclick = start;
      } else if (!rec) {
        c.innerHTML = '<button class="btn primary focusable rec-go" id="rStart" data-autofocus>▶ Start ' + esc(typeOf(type).name.toLowerCase()) + '</button>';
        $('#rStart').onclick = start;
      } else if (rec.state === 'rec') {
        c.innerHTML = '<button class="btn focusable" id="rLap">Lap</button><button class="btn primary focusable rec-go" id="rPause">❚❚ Pause</button>';
        $('#rPause').onclick = function () { rec.pause(); saveSnap(rec); if (s.trackVoice !== false) App.cue('Paused.', ['paused']); controls(); paint(); };
        $('#rLap').onclick = function () { var l = rec.lap(); App.toast('Lap ' + rec.laps.length + ' · ' + T.km(l.dist) + ' km · ' + T.clock(l.sec)); };
      } else {
        c.innerHTML = '<button class="btn primary focusable rec-go" id="rResume">▶ Resume</button>' +
          '<button class="btn focusable rec-finish" id="rFinish"><i></i><span>Hold to finish</span></button>';
        $('#rResume').onclick = function () { rec.resume(); saveSnap(rec); if (s.trackVoice !== false) App.cue('Resumed. Let\'s go.', ['resumed']); controls(); paint(); };
        holdToFinish($('#rFinish'));
      }
      $('#rPick').hidden = !!rec;
      $('#rHint').hidden = !!rec && (denied || rec.d > 100);
      if (rec && denied) gpsStatus('Time only – no location', 'weak');
    }
    function start() {
      if (!fix) App.toast(denied ? 'Recording time only – distance needs location' : 'Waiting for GPS – the route starts at the first fix');
      rec = newRec(); rec.start();
      if (fix && Date.now() - fix.ts < 10000) rec.add(Object.assign({}, fix, { ts: Date.now() }));
      App.keepAwake(true); saveSnap(rec);
      App.beep(880, 0.2);
      if (s.trackVoice !== false) App.cue(typeOf(type).name + ' started.', ['trail_' + type]);
      controls(); paint();
    }
    // press and hold (no accidental finishes in a pocket); Enter on a TV remote/keyboard asks instead
    function holdToFinish(b) {
      var t0 = 0, raf = 0;
      function down(e) { e.preventDefault(); t0 = Date.now(); b.classList.add('holding'); loop(); }
      function up() { cancelAnimationFrame(raf); b.classList.remove('holding'); b.style.setProperty('--p', 0); }
      function loop() {
        var k = (Date.now() - t0) / 1100; b.style.setProperty('--p', Math.min(1, k));
        if (k >= 1) { up(); finish(); return; }
        raf = requestAnimationFrame(loop);
      }
      b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
      b.addEventListener('keydown', function (e) { if (e.keyCode === 13 || e.keyCode === 32) { e.preventDefault(); e.stopPropagation(); App.ask('Finish and save this activity?', 'Finish', finish); } });
      b.onclick = function (e) { if (e.detail === 0) App.ask('Finish and save this activity?', 'Finish', finish); };
    }
    function finish() {
      var a = rec.finish(st().settings.weight);
      if (a.pts.length < 2) a = T.manual({ type: a.type, sec: a.elapsed, start: a.start }, st().settings.weight);   // no GPS: keep the time
      dropSnap(); App.keepAwake(false);
      if (a.dist < 50 && a.moving < 60) {
        rec = null; App.toast('Too short to save – discarded'); controls(); paint(); return;
      }
      if (s.trackVoice !== false) App.cue('Great work. Your activity is saved.', ['trail_done']);
      acts().unshift(a); save();
      rec = null;
      App.go('activity', { id: a.id, fresh: true }, true);
    }

    // recovered recording (reload, crash, killed tab)
    if (snap && snap.state && snap.state !== 'done') {
      rec = T.Recorder.restore(snap, { onSplit: onSplit });
      type = rec.type; setType(type);
      if (rec.state === 'rec') { rec.pause(); }
      App.keepAwake(true);
      App.toast('Recovered your ' + typeOf(type).name.toLowerCase() + ' – tap Resume to continue');
    }
    controls(); paint();

    App.session({
      confirmExit: function (proceed) {
        if (!rec) { proceed(); return; }
        App.ask('Discard this ' + typeOf(rec.type).name.toLowerCase() + '? (' + T.km(rec.d) + ' km so far)', 'Discard', function () { dropSnap(); rec = null; proceed(); });
      },
      destroy: function () {}
    });
  };

  // ---------------------------------------------------------------- activity detail / summary
  var RPE = ['', 'Very easy', 'Easy', 'Easy', 'Moderate', 'Moderate', 'Hard', 'Hard', 'Very hard', 'Very hard', 'Max effort'];
  S.activity = function (p) {
    var a = byId(p.id);
    if (!a) { App.resetTo(window.__HOME || 'home'); return; }
    var t = typeOf(a.type), sp = isSpeed(a);
    var recs = T.records(acts(), a.type);
    var sec = a.moving || a.elapsed;
    var stats = [
      [a.dist ? T.km(a.dist) : '–', 'km'],
      [T.clock(sec), 'moving time'],
      [a.dist && sec ? paceTxt(a, sec, a.dist) : '–', sp ? 'avg km/h' : 'avg pace /km'],
      [a.gain || 0, 'elev. gain m'],
      [a.kcal || 0, 'kcal (est.)'],
      [a.elapsed > sec + 30 ? T.clock(a.elapsed) : a.hr ? a.hr : a.rpe ? a.rpe + '/10' : '–', a.elapsed > sec + 30 ? 'elapsed (incl. stops)' : a.hr ? 'avg HR' : 'effort']
    ];
    // splits: bar length relative to the slowest km
    var sp2 = a.splits || [], worst = Math.max.apply(null, sp2.concat([1])), bestS = Math.min.apply(null, sp2.length ? sp2 : [0]);
    var splits = sp2.map(function (x, i) {
      return '<div class="split' + (x === bestS && sp2.length > 1 ? ' best' : '') + '"><span>' + (i + 1) + '</span><div class="sbar"><i style="width:' + Math.max(18, (bestS / x) * 100).toFixed(0) + '%"></i></div><b>' + paceTxt(a, x, 1000) + '</b></div>';
    }).join('') + (a.lastSplit ? '<div class="split part"><span>' + (sp2.length + a.lastSplit.m / 1000).toFixed(1) + '</span><div class="sbar"><i style="width:' + Math.max(18, (bestS || a.lastSplit.sec / a.lastSplit.m * 1000) / (a.lastSplit.sec / a.lastSplit.m * 1000) * 100).toFixed(0) + '%"></i></div><b>' + paceTxt(a, a.lastSplit.sec, a.lastSplit.m) + '</b></div>' : '');
    var best = T.EFFORTS.filter(function (e) { return a.best && a.best[e[0]]; }).map(function (e) {
      var pr = recs[e[0]] && recs[e[0]].id === a.id;
      return '<div class="effort' + (pr ? ' pr' : '') + '"><span>' + e[1] + '</span><b>' + T.clock(a.best[e[0]]) + '</b>' + (pr ? '<i>🏆 PR</i>' : '') + '</div>';
    }).join('');
    var hasMap = a.pts && a.pts.length > 1;
    var html = '<div class="screen act-screen">' +
      '<div class="act-head"><div class="act-ico">' + t.ico + '</div><div class="act-tt">' +
      (p.fresh ? '<input class="field focusable act-title" id="aTitle" maxlength="60" value="' + esc(a.title) + '">' : '<h1>' + esc(a.title) + '</h1>') +
      '<div class="hint">' + esc(t.name) + ' · ' + dateTxt(a.start) + (a.source === 'gpx' ? ' · imported' : a.source === 'manual' ? ' · logged manually' : '') + '</div></div></div>' +
      (p.fresh ? '<div class="act-done">' + (App.share ? '<button class="btn sm primary focusable" id="aShare2">↗ Share</button>' : '') + '🎉 Saved. Nice work – ' + (a.dist ? T.km(a.dist) + ' km' : T.clock(sec)) + ' done' + (Object.keys(a.best || {}).some(function (L) { return recs[L] && recs[L].id === a.id; }) && acts().filter(function (x) { return x.type === a.type; }).length > 1 ? ' and a new personal record' : '') + '.</div>' : '') +
      (hasMap ? '<div class="act-map" id="aMap">' + routeSvg(a.pts) + '</div>' : '') +
      '<div class="act-stats">' + stats.map(function (x) { return '<div><b>' + x[0] + '</b><span>' + x[1] + '</span></div>'; }).join('') + '</div>' +
      (hasMap && sec ? '<div class="panel"><h3>' + (sp ? 'Speed' : 'Pace') + ' & elevation</h3>' + chart(a) + '</div>' : '') +
      hrPanel(a) +
      (splits ? '<div class="panel"><h3>Splits <small>' + (sp ? 'km/h per km' : 'pace per km') + '</small></h3><div class="splits">' + splits + '</div></div>' : '') +
      (best ? '<div class="panel"><h3>Best efforts</h3><div class="efforts">' + best + '</div></div>' : '') +
      ((a.laps || []).length ? '<div class="panel"><h3>Laps</h3><div class="efforts">' + a.laps.map(function (l, i) { return '<div class="effort"><span>Lap ' + (i + 1) + ' · ' + T.km(l.dist) + ' km</span><b>' + T.clock(l.sec) + '</b></div>'; }).join('') + '</div></div>' : '') +
      '<div class="panel"><h3>How hard was it?</h3><div class="rpe">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) {
        return '<button class="focusable' + (a.rpe === n ? ' on' : '') + '" data-rpe="' + n + '" data-fid="rpe-' + n + '">' + n + '</button>';
      }).join('') + '</div><div class="hint" id="aRpeTxt">' + (a.rpe ? a.rpe + '/10 · ' + RPE[a.rpe] : 'Rate your effort – it helps balance your training week') + '</div>' +
      '<textarea class="field focusable" id="aNotes" rows="2" maxlength="300" placeholder="Notes – how did it feel, route, shoes…">' + esc(a.notes || '') + '</textarea></div>' +
      '<div class="act-foot"><button class="btn ghost focusable" id="aDel">Delete</button><div class="spacer"></div>' +
      (App.share ? '<button class="btn focusable" id="aShare">↗ Share</button>' : '') +
      '<button class="btn primary focusable" id="aSave" data-autofocus>' + (p.fresh ? 'Done' : 'Save') + '</button></div></div>';
    App.$('#app').innerHTML = html;
    if (hasMap) mountMap($('#aMap'), a.pts, false);
    $$('[data-rpe]').forEach(function (b) {
      b.onclick = function () {
        a.rpe = +b.getAttribute('data-rpe');
        $$('[data-rpe]').forEach(function (x) { x.classList.toggle('on', x === b); });
        $('#aRpeTxt').textContent = a.rpe + '/10 · ' + RPE[a.rpe];
      };
    });
    function share() {
      if ($('#aTitle')) a.title = $('#aTitle').value.trim() || a.title;
      var pr = acts().filter(function (x) { return x.type === a.type; }).length > 1 &&
        Object.keys(a.best || {}).filter(function (L) { return recs[L] && recs[L].id === a.id; }).map(Number).sort(function (x, y) { return y - x; })[0];
      var prName = pr ? T.EFFORTS.filter(function (e) { return e[0] === pr; })[0][1] : '';
      App.share({ kind: 'activity', eyebrow: t.name + ' · ' + new Date(a.start).toLocaleDateString((window.I18N && I18N.locale || 'en-GB'), { weekday: 'short', day: 'numeric', month: 'short' }),
        title: a.dist ? T.km(a.dist) + ' km' : T.clock(sec), subtitle: a.title, pts: a.pts,
        stats: (a.dist ? [[paceTxt(a, sec, a.dist), sp ? 'km/h' : 'per km'], [T.clock(sec), 'time']] : [[T.clock(sec), 'time']]).concat(a.hr ? [[a.hr + ' bpm', 'avg heart rate']] : a.gain ? [[a.gain + ' m', 'elevation']] : a.kcal ? [[a.kcal, 'kcal']] : []),
        badge: pr ? '🏆 New ' + prName + ' record' : '',
        caption: (a.dist ? T.km(a.dist) + ' km ' + t.name.toLowerCase() + ' in ' + T.clock(sec) + (sp ? '' : ' (' + paceTxt(a, sec, a.dist) + ' /km)') : t.name + ' – ' + T.clock(sec)) + ' ' + t.ico + (pr ? ' New ' + prName + ' personal best!' : ''),
        tags: ['#Rutina', '#NaturesFinest', '#' + t.name.toLowerCase().replace(/[^a-z]/g, '')] });
    }
    if ($('#aShare')) $('#aShare').onclick = share;
    if ($('#aShare2')) $('#aShare2').onclick = share;
    $('#aSave').onclick = function () {
      if ($('#aTitle')) a.title = $('#aTitle').value.trim() || a.title;
      a.notes = $('#aNotes').value.trim();
      save(); App.toast('Saved');
      if (p.fresh) App.resetTo(window.__HOME || 'home'); else App.back();
    };
    $('#aDel').onclick = function () {
      App.ask('Delete “' + a.title + '”? This can’t be undone.', 'Delete', function () {
        var l = acts(); l.splice(l.indexOf(a), 1); save(); App.toast('Deleted');
        if (p.fresh) App.resetTo(window.__HOME || 'home'); else App.back();
      });
    };
  };

  // heart rate: average / max, the curve over time and time in zones (zones from the profile's max HR)
  function maxHr() {
    var s = st().settings;
    if (s.maxHr) return s.maxHr;
    return s.birthYear ? Math.round(208 - 0.7 * (new Date().getFullYear() - s.birthYear)) : 190;
  }
  function hrPanel(a) {
    if (!a.hr && !(a.hrs && a.hrs.length)) return '';
    var hrs = a.hrs || [], mx = Math.max(maxHr(), a.hrMax || 0), curve = '';
    if (hrs.length > 2) {
      var t1 = hrs[hrs.length - 1][0] || 1, lo = Math.min.apply(null, hrs.map(function (h) { return h[1]; })) - 5, hi = Math.max.apply(null, hrs.map(function (h) { return h[1]; })) + 5;
      curve = '<svg class="pchart hrchart" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline class="c-hr" points="' +
        hrs.map(function (h) { return (h[0] / t1 * 100).toFixed(2) + ',' + (95 - (h[1] - lo) / (hi - lo) * 88).toFixed(2); }).join(' ') + '"/></svg>';
    }
    var zones = window.Imports && hrs.length > 2 ? Imports.zones(hrs, mx) : [];
    var tot = zones.reduce(function (x, z) { return x + z.sec; }, 0);
    return '<div class="panel"><h3>Heart rate <small>' + (a.device ? esc(a.device) : 'max ' + mx + ' bpm') + '</small></h3>' +
      '<div class="act-tot"><div><b>' + (a.hr || '–') + '</b><span>avg bpm</span></div><div><b>' + (a.hrMax || '–') + '</b><span>max bpm</span></div><div><b>' + Math.round((a.hr || 0) / mx * 100) + '%</b><span>of your max</span></div></div>' +
      curve +
      (tot ? '<div class="hzones">' + zones.slice().reverse().map(function (z) {
        return '<div class="hz z' + z.z + '"><span>Z' + z.z + ' ' + esc(z.name) + '</span><div class="sbar"><i style="width:' + (z.sec / tot * 100).toFixed(1) + '%"></i></div><b>' + T.clock(z.sec) + '</b></div>';
      }).join('') + '</div>' : '') + '</div>';
  }

  // pace (or speed) per ~200 m with elevation underneath
  function chart(a) {
    var pts = a.pts, cum = [0], tm = [0];
    for (var i = 1; i < pts.length; i++) {
      var same = pts[i][4] === pts[i - 1][4];
      cum.push(cum[i - 1] + (same ? T.dist(pts[i - 1], pts[i]) : 0));
      tm.push(tm[i - 1] + (same ? pts[i][2] - pts[i - 1][2] : 0));
    }
    var total = cum[cum.length - 1];
    if (total < 300) return '<div class="hint">Too short for a chart.</div>';
    var step = Math.max(100, total / 60), bins = [], j = 0;
    for (var d = step; d <= total + 1; d += step) {
      var k = j; while (k < cum.length - 1 && cum[k] < d) k++;
      var dd = cum[k] - cum[j], dt = tm[k] - tm[j];
      if (dd > 0 && dt > 0) bins.push({ x: cum[k], v: isSpeed(a) ? dd / dt * 3.6 : dt / dd * 1000, e: pts[k][3] });
      j = k;
    }
    if (bins.length < 3) return '';
    var vs = bins.map(function (b) { return b.v; }).sort(function (x, y) { return x - y; });
    var lo = vs[Math.floor(vs.length * 0.05)], hi = vs[Math.ceil(vs.length * 0.95) - 1];
    if (hi - lo < 1) { lo -= 0.5; hi += 0.5; }
    var es = bins.map(function (b) { return b.e; }).filter(function (e) { return e != null; });
    var eLo = es.length ? Math.min.apply(null, es) : 0, eHi = es.length ? Math.max.apply(null, es) : 1;
    var X = function (x) { return (x / total * 100).toFixed(2); };
    // pace: faster = higher on the chart
    var Y = function (v) { var r = (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo); return (isSpeed(a) ? 70 - r * 60 : 10 + r * 60).toFixed(2); };
    var EY = function (e) { return (98 - (e - eLo) / Math.max(10, eHi - eLo) * 26).toFixed(2); };
    var line = bins.map(function (b) { return X(b.x) + ',' + Y(b.v); }).join(' ');
    var area = es.length > 2 ? '<polygon class="c-ele" points="0,100 ' + bins.filter(function (b) { return b.e != null; }).map(function (b) { return X(b.x) + ',' + EY(b.e); }).join(' ') + ' 100,100"/>' : '';
    var avg = isSpeed(a) ? a.dist / a.moving * 3.6 : a.moving / a.dist * 1000;
    return '<svg class="pchart" viewBox="0 0 100 100" preserveAspectRatio="none">' + area +
      '<line class="c-avg" x1="0" x2="100" y1="' + Y(avg) + '" y2="' + Y(avg) + '"/><polyline class="c-line" points="' + line + '"/></svg>' +
      '<div class="pchart-legend"><span><i class="lg-line"></i>' + (isSpeed(a) ? 'speed' : 'pace') + '</span><span><i class="lg-avg"></i>average ' + paceTxt(a, a.moving, a.dist) + ' ' + paceUnit(a) + '</span>' +
      (area ? '<span><i class="lg-ele"></i>elevation ' + Math.round(eLo) + '–' + Math.round(eHi) + ' m</span>' : '') + '<span class="sp"></span><span>' + T.km(total) + ' km</span></div>';
  }

  // ---------------------------------------------------------------- activity feed (sessions as cards, like the big sport trackers)
  // one list for everything: GPS / logged / imported activities + the gym workouts from the player
  var GYM = { name: 'Gym workout', ico: '🏋️' };
  function gymKcal(l, kg) { return l.kcal || Math.round(5 * (kg || 75) * (l.sec || (l.min || 0) * 60) / 3600); }
  function feed(s) {
    var kg = s.settings.weight;
    var a = acts().map(function (x) {
      var sec = x.moving || x.elapsed || 0;
      return { k: 'act', id: x.id, type: x.type, start: x.start, title: x.title, sec: sec, dist: x.dist || 0, kcal: x.kcal || T.kcal(x.type, kg, sec, x.dist), pts: x.pts, hr: x.hr, a: x };
    });
    var g = (s.log || []).map(function (l, i) {
      return { k: 'gym', id: 'g' + i, i: i, type: 'app_gym', start: l.date, title: l.name || 'Workout', sec: l.sec || (l.min || 0) * 60, dist: 0, kcal: gymKcal(l, kg), sets: (l.sets || []).length };
    });
    return a.concat(g).filter(function (x) { return x.start; }).sort(function (x, y) { return x.start < y.start ? 1 : -1; });
  }
  function meta(it) { return it.type === 'app_gym' ? GYM : typeOf(it.type); }
  function hm(sec) {   // 1 h 05 min · 42 min
    var m = Math.round((sec || 0) / 60), h = Math.floor(m / 60);
    return h ? h + ' h ' + (m % 60 < 10 ? '0' : '') + (m % 60) + ' min' : m + ' min';
  }
  function cardStats(it) {
    var st2 = [];
    if (it.dist) {
      st2.push(['Distance', T.km(it.dist) + ' km'], ['Duration', T.clock(it.sec)]);
      st2.push(it.sec && it.a ? [isSpeed(it.a) ? 'Avg speed' : 'Avg pace', paceTxt(it.a, it.sec, it.dist) + ' ' + paceUnit(it.a)] : ['Calories', it.kcal + ' kcal']);
    } else {
      st2.push(['Duration', T.clock(it.sec)], ['Calories', it.kcal + ' kcal']);
      if (it.k === 'gym') st2.push(['Sets', String(it.sets)]);
      else if (it.hr) st2.push(['Avg heart rate', it.hr + ' bpm']);
    }
    return '<div class="fc-stats">' + st2.map(function (x) { return '<div><small>' + x[0] + '</small><b>' + x[1] + '</b></div>'; }).join('') + '</div>';
  }
  function card(it, who) {
    var t = meta(it), p = it.k === 'act' ? { id: it.id } : { i: it.i };
    return '<div class="feed-card focusable" tabindex="0" data-go="' + (it.k === 'act' ? 'activity' : 'gymLog') + '" data-p=\'' + JSON.stringify(p) + '\'>' +
      '<div class="fc-head"><span class="fc-ico" style="background:' + T.color(it.type) + '">' + t.ico + '</span><div class="fc-tt"><b>' + esc(it.title) + '</b><small>' + dateTxt(it.start) + ' · <span translate="no">' + esc(who) + '</span></small></div></div>' +
      (it.pts && it.pts.length > 1 ? '<div class="fc-map" data-fmap="' + esc(it.id) + '">' + routeSvg(it.pts, 'feed') + '</div>' : '') +
      cardStats(it) + '</div>';
  }
  // real map tiles for the cards on screen (static maps: no dragging, the tap opens the activity)
  function liveMaps(items) {
    if (!('IntersectionObserver' in window) || navigator.webdriver || navigator.onLine === false) return;
    var n = 0, io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting || n >= 12) return;
        io.unobserve(e.target); n++;
        var it = items.filter(function (x) { return x.id === e.target.getAttribute('data-fmap'); })[0];
        if (it) mountMap(e.target, it.pts, false, true);
      });
    }, { rootMargin: '200px' });
    $$('[data-fmap]').forEach(function (el) { io.observe(el); });
    App.onCleanup(function () { io.disconnect(); });
  }
  S.activities = function (p) {
    var s = st(), f = p.f || 'all', all = feed(s);
    var list = all.filter(function (x) { return f === 'all' || x.type === f; });
    var types = []; all.forEach(function (x) { if (types.indexOf(x.type) < 0) types.push(x.type); });
    var html = '<div class="screen feed-screen"><div class="topbar"><h1>Activities</h1><span class="chip">' + list.length + '</span><div class="spacer"></div>' +
      '<button class="btn sm focusable" data-go="logSport">＋ Log / import</button><button class="btn sm primary focusable" data-go="record">● Record</button></div>' +
      (types.length > 1 ? '<div class="filters"><button class="chip focusable' + (f === 'all' ? ' on' : '') + '" data-af="all">All</button>' + types.map(function (k) {
        var t = meta({ type: k });
        return '<button class="chip focusable' + (f === k ? ' on' : '') + '" data-af="' + k + '">' + t.ico + ' ' + t.name + '</button>';
      }).join('') + '</div>' : '');
    var month = '';
    html += '<div class="feed">' + (list.map(function (it) {
      var m = new Date(it.start).toLocaleDateString((window.I18N && I18N.locale || 'en-GB'), { month: 'long', year: 'numeric' }), h = '';
      if (m !== month) { month = m; h = '<div class="act-month" translate="no">' + m + '</div>'; }
      return h + card(it, s.name);
    }).join('') || '<div class="empty-state"><div class="big">🏃</div><h3>No activities yet</h3><p>Record a run, walk, hike or ride with GPS – or log any other sport in seconds.</p>' +
      '<button class="btn primary focusable" data-go="record">● Start recording</button></div>') + '</div></div>';
    App.$('#app').innerHTML = html;
    $$('[data-af]').forEach(function (b) { b.onclick = function () { App.refresh({ f: b.getAttribute('data-af') }); }; });
    liveMaps(list);
  };

  // ---------------------------------------------------------------- gym workout detail (from the feed)
  S.gymLog = function (p) {
    var s = st(), l = s.log[p.i];
    if (!l) { App.back(); return; }
    var sec = l.sec || (l.min || 0) * 60, by = {}, order = [];
    (l.sets || []).forEach(function (x) { if (!by[x.id]) { by[x.id] = []; order.push(x.id); } by[x.id].push(x); });
    var reps = (l.sets || []).reduce(function (a, x) { return a + (x.reps || 0); }, 0);
    var vol = (l.sets || []).reduce(function (a, x) { var e = Exercises.BY_ID[x.id]; return a + (e && e.unit === 'kg' ? (x.reps || 0) * (x.load || 0) : 0); }, 0);
    var stats = [[hm(sec), 'duration'], [gymKcal(l, s.settings.weight) + ' kcal', 'calories'], [String((l.sets || []).length), 'sets'], [String(reps), 'reps']];
    if (vol) stats.push([Math.round(vol) + ' kg', 'volume']);
    var rows = order.map(function (id) {
      var e = Exercises.BY_ID[id] || { name: id }, sets = by[id];
      var load = e.unit === 'kg' && sets[sets.length - 1].load ? sets[sets.length - 1].load + ' kg × ' : '';
      return '<div class="gl-row"><b>' + esc(e.name) + '</b><span>' + load + sets.map(function (x) { return x.reps; }).join(' / ') + '</span></div>';
    }).join('');
    App.$('#app').innerHTML = '<div class="screen act-screen">' +
      '<div class="act-head"><div class="act-ico" style="background:' + T.color('app_gym') + '">' + GYM.ico + '</div><div class="act-tt"><h1>' + esc(l.name || 'Workout') + '</h1>' +
      '<div class="hint">' + GYM.name + ' · ' + dateTxt(l.date) + (l.partial ? ' · ended early' : '') + '</div></div></div>' +
      '<div class="act-stats">' + stats.map(function (x) { return '<div><b>' + x[0] + '</b><span>' + x[1] + '</span></div>'; }).join('') + '</div>' +
      (rows ? '<div class="panel"><h3>Exercises</h3><div class="gl-list">' + rows + '</div></div>' : '') +
      '<div class="act-foot"><button class="btn sm focusable" data-go="activities">All activities →</button></div></div>';
  };

  // ---------------------------------------------------------------- today's calories (Home) + statistics (Me)
  // resting = Mifflin-St Jeor BMR, counted up to now (like the trackers' day total); active = today's sessions
  function bmr(s) {
    var w = s.weight; if (!w) return 0;
    var a = App.me ? App.me.age(s) : null;
    if (!s.height || !a) return Math.round(w * 22 * (s.sex === 'f' ? 0.9 : 1));
    return Math.round(10 * w + 6.25 * s.height - 5 * a + (s.sex === 'f' ? -161 : 5));
  }
  function today(s) {
    var d0 = new Date(); d0.setHours(0, 0, 0, 0);
    var items = feed(s).filter(function (x) { return new Date(x.start) >= d0; });
    var active = items.reduce(function (a, x) { return a + (x.kcal || 0); }, 0);
    var rest = Math.round(bmr(s.settings) * (Date.now() - d0) / 864e5);
    return { active: active, rest: rest, total: active + rest, min: Math.round(items.reduce(function (a, x) { return a + x.sec; }, 0) / 60), n: items.length };
  }
  function todayCard(s) {
    var t = today(s);
    return '<div class="kc-card focusable" tabindex="0" data-go="activities"><div class="kc-main"><span class="kc-lab">🔥 Today’s calories</span>' +
      '<b>' + t.total + '<small> kcal</small></b>' +
      '<small>' + (t.rest ? 'active ' + t.active + ' · resting ' + t.rest : 'from your sessions today') + '</small></div>' +
      '<div class="kc-side"><div><b>' + t.min + '</b><span>active min</span></div><div><b>' + t.n + '</b><span>' + (t.n === 1 ? 'session' : 'sessions') + '</span></div></div></div>';
  }
  var statP = 'year';
  function statsCard() {
    var s = st(), from = new Date(); from.setHours(0, 0, 0, 0);
    if (statP === 'month') from.setDate(1); else if (statP === 'year') { from.setMonth(0, 1); } else from = new Date(0);
    var items = feed(s).filter(function (x) { return new Date(x.start) >= from; });
    if (!feed(s).length) return '';
    var days = {}, km = 0, sec = 0, by = {};
    items.forEach(function (x) {
      days[x.start.slice(0, 10)] = 1; km += x.dist; sec += x.sec;
      var b = by[x.type] = by[x.type] || { n: 0, sec: 0, dist: 0 }; b.n++; b.sec += x.sec; b.dist += x.dist;
    });
    var keys = Object.keys(by).sort(function (a, b) { return by[b].sec - by[a].sec; }), top = keys.length ? by[keys[0]].sec || 1 : 1;
    function chip(k, lab) { return '<button class="chip focusable' + (statP === k ? ' on' : '') + '" data-stp="' + k + '">' + lab + '</button>'; }
    return '<section class="set-group ps-group"><h2>Statistics</h2><div class="set-card ps-card">' +
      '<div class="ps-per">' + chip('month', 'This month') + chip('year', 'This year') + chip('all', 'All time') + '</div>' +
      '<div class="ps-tot"><div><b>' + items.length + '</b><span>activities</span></div><div><b>' + T.km(km) + '</b><span>km</span></div>' +
      '<div><b>' + Object.keys(days).length + '</b><span>active days</span></div><div><b>' + Math.floor(sec / 3600) + '</b><span>hours</span></div></div>' +
      (keys.length ? '<div class="ps-h"><b>Sports</b><span>' + keys.length + '</span></div><div class="ps-list">' + keys.map(function (k) {
        var b = by[k], t = meta({ type: k });
        return '<div class="ps-row"><span class="fc-ico" style="background:' + T.color(k) + '">' + t.ico + '</span><div class="ps-mid"><div class="ps-l"><b>' + esc(t.name) + '</b><span>' +
          b.n + '× · ' + hm(b.sec) + (b.dist ? ' · ' + T.km(b.dist) + ' km' : '') + '</span></div><i style="width:' + Math.max(4, b.sec / top * 100).toFixed(0) + '%;background:' + T.color(k) + '"></i></div></div>';
      }).join('') + '</div>' : '<div class="hint">Nothing in this period yet.</div>') + '</div></section>';
  }
  App.hooks.settings.unshift(statsCard);
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-stp]');
    if (b) { statP = b.getAttribute('data-stp'); App.refresh(); }
  });

  // ---------------------------------------------------------------- manual log + GPX import
  S.logSport = function (p) {
    var d = p.d || { type: 'football', h: 1, m: 0, km: '', rpe: 0, hr: '', when: localNow(), notes: '' };
    function localNow() { var n = new Date(); n.setMinutes(n.getMinutes() - n.getTimezoneOffset()); return n.toISOString().slice(0, 16); }
    var types = T.MANUAL_TYPES.concat(T.GPS_TYPES);
    var t = typeOf(d.type), showDist = t.dist || t.gps;
    var html = '<div class="screen"><div class="topbar"><h1>Log an activity</h1></div>' +
      '<div class="panel"><h3>Import from a watch or another app</h3><div class="hint">FIT, GPX, TCX or ZIP – Garmin, Polar, Suunto, COROS, Wahoo, Fitbit, Apple Watch (via an export app). Heart rate comes along. <a href="#" id="lDev">Step-by-step for your watch →</a></div>' +
      '<label class="btn focusable gpx-btn" tabindex="0">📂 Choose file(s)<input type="file" id="gpx" multiple accept="' + (App.IMPORT_ACCEPT || '.gpx,application/gpx+xml,application/xml,text/xml') + '" hidden></label></div>' +
      '<div class="panel"><h3>Sport</h3><div class="sport-grid">' + types.map(function (k) {
        return '<button class="sport-tile focusable' + (k === d.type ? ' on' : '') + '" data-st="' + k + '" data-fid="st-' + k + '"><span>' + typeOf(k).ico + '</span>' + esc(typeOf(k).name) + '</button>';
      }).join('') + '</div></div>' +
      '<div class="panel"><h3>Details</h3><div class="pgrid">' +
      '<div class="pfield"><div class="k">When</div><input class="field focusable" type="datetime-local" id="lWhen" value="' + esc(d.when) + '"></div>' +
      '<div class="pfield"><div class="k">Duration</div><div class="dur"><input class="field focusable num-in" id="lH" inputmode="numeric" value="' + d.h + '"><span>h</span><input class="field focusable num-in" id="lM" inputmode="numeric" value="' + d.m + '"><span>min</span></div></div>' +
      (showDist ? '<div class="pfield"><div class="k">Distance (optional)</div><div class="dur"><input class="field focusable num-in" id="lKm" inputmode="decimal" placeholder="—" value="' + esc(d.km) + '"><span>km</span></div></div>' : '') +
      '<div class="pfield"><div class="k">Avg heart rate (optional)</div><div class="dur"><input class="field focusable num-in" id="lHr" inputmode="numeric" placeholder="—" value="' + esc(d.hr) + '"><span>bpm</span></div></div></div>' +
      '<div class="k" style="margin-top:.4rem">How hard was it?</div><div class="rpe">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) {
        return '<button class="focusable' + (d.rpe === n ? ' on' : '') + '" data-lrpe="' + n + '" data-fid="lrpe-' + n + '">' + n + '</button>';
      }).join('') + '</div>' +
      '<textarea class="field focusable" id="lNotes" rows="2" maxlength="300" placeholder="Notes (optional)">' + esc(d.notes) + '</textarea></div>' +
      '<div class="act-foot"><div class="spacer"></div><button class="btn primary focusable" id="lSave">Save activity</button></div></div>';
    App.$('#app').innerHTML = html;
    function read() {
      d.when = $('#lWhen').value || d.when; d.h = $('#lH').value; d.m = $('#lM').value;
      d.km = $('#lKm') ? $('#lKm').value : ''; d.hr = $('#lHr').value; d.notes = $('#lNotes').value;
    }
    $$('[data-st]').forEach(function (b) { b.onclick = function () { read(); d.type = b.getAttribute('data-st'); App.refresh({ d: d }); }; });
    $$('[data-lrpe]').forEach(function (b) { b.onclick = function () { read(); d.rpe = +b.getAttribute('data-lrpe'); $$('[data-lrpe]').forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
    $('#lSave').onclick = function () {
      read();
      var sec = (parseFloat(d.h) || 0) * 3600 + (parseFloat(d.m) || 0) * 60;
      if (sec < 60) { App.toast('Enter how long it took'); return; }
      var km = parseFloat(String(d.km).replace(',', '.')) || 0, hr = parseInt(d.hr, 10) || null;
      var a = T.manual({ type: d.type, sec: sec, dist: km * 1000, rpe: d.rpe || null, hr: hr, notes: d.notes.trim(), start: new Date(d.when).toISOString() }, st().settings.weight);
      acts().unshift(a); acts().sort(function (x, y) { return x.start < y.start ? 1 : -1; }); save();
      App.go('activity', { id: a.id, fresh: true }, true);
    };
    $('#lDev').onclick = function (e) { e.preventDefault(); App.go('devices', {}); };
    $('#gpx').onchange = function () {
      var file = this.files && this.files[0]; if (!file) return;
      if (App.importFiles) {
        App.importFiles(this.files).then(function (res) {
          if (res && res.added.length === 1 && !res.merged) App.go('activity', { id: res.added[0].id, fresh: true }, true);
          else if (res && (res.added.length || res.merged)) App.go('activities', {}, true);
        });
        return;
      }
      var rd = new FileReader();
      rd.onload = function () {
        var a = T.parseGPX(String(rd.result), st().settings.weight);
        if (!a) { App.toast('No track found in that file'); return; }
        if (acts().some(function (x) { return x.start === a.start && Math.abs(x.dist - a.dist) < 50; })) { App.toast('Already imported'); return; }
        acts().unshift(a); acts().sort(function (x, y) { return x.start < y.start ? 1 : -1; }); save();
        App.go('activity', { id: a.id, fresh: true }, true);
      };
      rd.readAsText(file);
    };
  };

  try {
    var re = sessionStorage.getItem('fs.reopen');
    if (re) { sessionStorage.removeItem('fs.reopen'); setTimeout(function () { if (st()) App.go('record', JSON.parse(re)); }, 0); }
  } catch (e) {}
  window.Sport = { routeSvg: routeSvg, dateTxt: dateTxt, feed: feed, today: today, todayCard: todayCard, paceTxt: paceTxt, paceUnit: paceUnit, recording: function () { return loadSnap(); } };

  // ---------------------------------------------------------------- progress panel (Today shows activity via js/today.js)
  App.hooks.progress.push(function () {
    var list = acts();
    if (!list.length) return '';   // no empty charts: Progress shows "first steps" until there is something to plot
    var wk = T.weeks(list, 12), maxD = Math.max.apply(null, wk.map(function (w) { return w.dist; }).concat([1]));
    var maxS = Math.max.apply(null, wk.map(function (w) { return w.sec; }).concat([1]));
    var useDist = wk.some(function (w) { return w.dist > 0; });
    var bars = wk.map(function (w) {
      var v = useDist ? w.dist / maxD : w.sec / maxS;
      return '<i style="height:' + Math.max(3, v * 100).toFixed(0) + '%" title="' + (useDist ? T.km(w.dist) + ' km' : T.clock(w.sec)) + '"></i>';
    }).join('');
    var thisW = wk[11], total = list.reduce(function (s, a) { return s + (a.dist || 0); }, 0);
    var runRec = T.records(list, 'run');
    var prs = [[1000, '1 km'], [5000, '5 km'], [10000, '10 km'], [21097, 'Half']].map(function (e) {
      var r = runRec[e[0]];
      return '<div class="effort' + (r ? ' pr' : '') + '"><span>' + e[1] + '</span><b>' + (r ? T.clock(r.sec) : '—') + '</b>' + (r ? '<i>' + new Date(r.date).toLocaleDateString((window.I18N && I18N.locale || 'en-GB'), { day: 'numeric', month: 'short' }) + '</i>' : '') + '</div>';
    }).join('');
    return '<div class="hero"><div class="panel"><h3>Activity ' + (useDist ? 'distance' : 'time') + ' per week (12 weeks)</h3><div class="bars act-bars">' + bars + '</div>' +
      '<div class="act-tot"><div><b>' + thisW.n + '</b><span>this week</span></div><div><b>' + T.km(thisW.dist) + '</b><span>km this week</span></div><div><b>' + Math.round(total / 1000) + '</b><span>km all time</span></div></div></div>' +
      '<div class="panel"><h3>Running records</h3><div class="efforts">' + prs + '</div>' +
      '<div class="act-foot"><button class="btn sm focusable" data-go="activities">All activities →</button>' + (App.share ? '<button class="btn sm focusable" data-share-week>↗ Share my week</button>' : '') + '</div></div></div>';
  });
});
