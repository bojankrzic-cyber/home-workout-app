/*
 * Sport tracker engine – pure logic, no DOM (unit-tested in Node by tools/track.cjs).
 *
 * Recorder turns raw GPS fixes into an activity the way dedicated run/ride apps do:
 *   - rejects weak fixes (accuracy), GPS jitter while standing and impossible jumps
 *   - auto-pause: moving time stops when you stop; elapsed time keeps running
 *   - splits every km (time interpolated at the exact km mark), laps on demand
 *   - elevation gain with a hysteresis threshold so altitude noise doesn't add up
 *   - screen-off gaps (iOS suspends GPS when locked): a plausible straight line is kept,
 *     an impossible one is dropped
 *   - snapshot()/restore() so a reload or a killed tab resumes the activity
 *
 * Activity = { id, type, start (ISO), elapsed, moving, dist (m), gain (m), pts: [[lat, lon, t, ele, seg]],
 *              splits: [sec per km], laps: [{ dist, sec }], kcal, source: 'gps'|'gpx'|'manual', title, rpe, notes }
 */
(function (global) {
  'use strict';

  // met: fallback MET when speed is unknown; minSpeed: below it you count as stopped (m/s);
  // maxSpeed: faster is a GPS glitch (m/s); unit: what the big number shows
  var TYPES = {
    run: { name: 'Run', ico: '🏃', gps: true, unit: 'pace', minSpeed: 0.9, maxSpeed: 9, met: 9.8 },
    walk: { name: 'Walk', ico: '🚶', gps: true, unit: 'pace', minSpeed: 0.4, maxSpeed: 4, met: 3.5 },
    hike: { name: 'Hike', ico: '🥾', gps: true, unit: 'pace', minSpeed: 0.3, maxSpeed: 4, met: 6 },
    ride: { name: 'Ride', ico: '🚴', gps: true, unit: 'speed', minSpeed: 1.5, maxSpeed: 25, met: 8 },
    // manual-only sports (no GPS): duration + effort, optional distance
    swim: { name: 'Swim', ico: '🏊', met: 7, dist: true },
    football: { name: 'Football', ico: '⚽', met: 7 },
    tennis: { name: 'Tennis', ico: '🎾', met: 7.3 },
    padel: { name: 'Padel', ico: '🏸', met: 6 },
    basketball: { name: 'Basketball', ico: '🏀', met: 6.5 },
    ski: { name: 'Skiing', ico: '⛷️', met: 6, dist: true },
    yoga: { name: 'Yoga', ico: '🧘', met: 2.8 },
    pilates: { name: 'Pilates', ico: '🤸', met: 3 },
    gym: { name: 'Gym session', ico: '🏋️', met: 5 },
    indoor_run: { name: 'Treadmill', ico: '🏃', met: 9, dist: true, unit: 'pace' },
    indoor_ride: { name: 'Indoor bike', ico: '🚲', met: 7, dist: true, unit: 'speed' },
    other: { name: 'Other sport', ico: '✨', met: 5, dist: true }
  };
  var GPS_TYPES = ['run', 'walk', 'hike', 'ride'];
  var MANUAL_TYPES = ['swim', 'football', 'tennis', 'padel', 'basketball', 'ski', 'yoga', 'pilates', 'gym', 'indoor_run', 'indoor_ride', 'other'];

  var R = 6371008.8;
  function rad(d) { return d * Math.PI / 180; }
  function dist(a, b) {   // haversine, metres; a/b = [lat, lon]
    var dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1]);
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  // calories: ACSM equations for walking/running (speed known), MET table otherwise
  function kcal(type, kg, sec, distM) {
    var t = TYPES[type] || TYPES.other, w = kg || 75, met = t.met;
    if (distM && sec > 0 && (type === 'run' || type === 'walk' || type === 'hike' || type === 'indoor_run')) {
      var mpm = distM / (sec / 60);   // metres per minute
      var vo2 = mpm > 134 ? 0.2 * mpm + 3.5 : 0.1 * mpm + 3.5;   // > ~8 km/h = running
      met = Math.max(met * 0.6, vo2 / 3.5) * (type === 'hike' ? 1.25 : 1);
    } else if (distM && sec > 0 && (type === 'ride' || type === 'indoor_ride')) {
      var kmh = distM / sec * 3.6;
      met = kmh < 16 ? 4 : kmh < 19 ? 6.8 : kmh < 22 ? 8 : kmh < 26 ? 10 : 12;
    }
    return Math.round(met * w * sec / 3600);
  }

  // pace "5:32" (min/km) or speed "24.6" (km/h)
  function pace(sec, m) {
    if (!m || m < 5 || !sec) return '–:––';
    var s = Math.round(sec / (m / 1000));
    if (s > 3599) return '–:––';
    return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2);
  }
  function speed(sec, m) { return !sec || !m ? '0.0' : (m / sec * 3.6).toFixed(1); }
  function km(m) { return (m / 1000).toFixed(m < 10000 ? 2 : 1); }
  function clock(sec) {
    sec = Math.max(0, Math.round(sec));
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return (h ? h + ':' + ('0' + m).slice(-2) : m) + ':' + ('0' + s).slice(-2);
  }

  // ------------------------------------------------------------------ recorder
  function Recorder(type, opts) {
    opts = opts || {};
    this.type = type;
    this.t = TYPES[type];
    this.now = opts.now || function () { return Date.now(); };
    this.onSplit = opts.onSplit || null;
    this.reset();
  }
  Recorder.prototype.reset = function () {
    this.state = 'idle';           // idle | rec | paused (manual) ; this.auto = auto-paused while rec
    this.auto = false;
    this.startTs = 0; this.elapsedBase = 0; this.runFrom = 0;
    this.moving = 0; this.d = 0; this.gain = 0;
    this.pts = []; this.splits = []; this.laps = []; this.seg = 0;
    this.last = null;              // last accepted fix { lat, lon, ts, ele }
    this.eleRef = null; this.stillSince = 0; this.recent = [];
    this.lapFrom = { d: 0, t: 0 };
    this.acc = null;
  };
  Recorder.prototype.start = function () {
    var n = this.now();
    this.state = 'rec'; this.startTs = n; this.runFrom = n; this.stillSince = n;
  };
  Recorder.prototype.elapsed = function () {
    return this.elapsedBase + (this.state === 'rec' ? (this.now() - this.runFrom) / 1000 : 0);
  };
  Recorder.prototype.pause = function () {
    if (this.state !== 'rec') return;
    this.elapsedBase = this.elapsed(); this.state = 'paused';
    this.last = null; this.raw = []; this.seg++;   // next fix starts a new segment – no line across the pause
  };
  Recorder.prototype.resume = function () {
    if (this.state !== 'paused') return;
    this.state = 'rec'; this.runFrom = this.now(); this.stillSince = this.now(); this.auto = false;
  };

  // feed one GPS fix: { lat, lon, acc, ele, ts }
  Recorder.prototype.add = function (f) {
    this.acc = f.acc;
    if (this.state !== 'rec') return 'ignored';
    if (f.acc != null && f.acc > 35) return 'weak';
    var ts = f.ts || this.now();
    // average the last 3 fixes (within 5 s): cuts GPS scatter that would otherwise zig-zag the
    // track and inflate distance, at the cost of ~1 s lag
    this.raw = (this.raw || []).filter(function (r) { return ts - r.ts < 5000; });
    this.raw.push({ lat: f.lat, lon: f.lon, ts: ts });
    if (this.raw.length > 3) this.raw.shift();
    var n = this.raw.length;
    f = { lat: this.raw.reduce(function (s, r) { return s + r.lat; }, 0) / n, lon: this.raw.reduce(function (s, r) { return s + r.lon; }, 0) / n, acc: f.acc, ele: f.ele };
    if (!this.last) { this.accept(f, ts, 0, 0); return 'first'; }
    var dt = (ts - this.last.ts) / 1000;
    if (dt <= 0) return 'dup';
    var d = dist([this.last.lat, this.last.lon], [f.lat, f.lon]);
    var v = d / dt;
    if (v > this.t.maxSpeed) return 'jump';                 // glitch, or an impossible screen-off gap
    var noise = Math.max(4, (f.acc || 5) * 0.5);
    var moving = d > noise && v >= this.t.minSpeed * 0.8 || (dt > 20 && d > 25 && v >= this.t.minSpeed * 0.5);
    if (!moving) {
      if (ts - this.stillSince > 6000 && !this.auto) this.auto = true;   // auto-pause after 6 s still
      // while auto-paused, re-anchor every 10 s: standing time never turns into moving time, and the
      // anchor stays old enough that a slow walk away still shows up as movement
      if (this.auto && ts - this.last.ts > 10000) this.last = { lat: f.lat, lon: f.lon, ts: ts, ele: this.last.ele };
      return 'still';
    }
    this.auto = false; this.stillSince = ts;
    this.accept(f, ts, d, dt);
    return 'ok';
  };
  Recorder.prototype.accept = function (f, ts, d, dt) {
    var before = this.d;
    this.d += d; this.moving += dt;
    // elevation gain with 3 m hysteresis
    if (f.ele != null && isFinite(f.ele)) {
      if (this.eleRef == null) this.eleRef = f.ele;
      else if (f.ele - this.eleRef >= 3) { this.gain += f.ele - this.eleRef; this.eleRef = f.ele; }
      else if (this.eleRef - f.ele >= 3) this.eleRef = f.ele;
    }
    // km split: interpolate the moment the km mark was crossed
    var kmDone = Math.floor(this.d / 1000);
    while (this.splits.length < kmDone) {
      var mark = (this.splits.length + 1) * 1000;
      var frac = d > 0 ? (mark - before) / d : 1;
      var tAt = this.moving - dt + dt * frac;
      var prev = this.splits.reduce(function (s, x) { return s + x; }, 0);
      this.splits.push(Math.round((tAt - prev) * 10) / 10);
      if (this.onSplit) this.onSplit(this.splits.length, this.splits[this.splits.length - 1]);
    }
    this.recent.push([this.moving, this.d]);
    while (this.recent.length > 2 && this.moving - this.recent[0][0] > 30) this.recent.shift();
    this.last = { lat: f.lat, lon: f.lon, ts: ts, ele: f.ele };
    var t0 = this.startTs;
    this.pts.push([Math.round(f.lat * 1e6) / 1e6, Math.round(f.lon * 1e6) / 1e6, Math.round((ts - t0) / 1000), f.ele != null ? Math.round(f.ele) : null, this.seg]);
  };
  // pace / speed over the last ~30 s of movement
  Recorder.prototype.current = function () {
    if (this.auto || this.state !== 'rec' || this.recent.length < 2) return { sec: 0, m: 0 };
    var a = this.recent[0], b = this.recent[this.recent.length - 1];
    return { sec: b[0] - a[0], m: b[1] - a[1] };
  };
  Recorder.prototype.lap = function () {
    var l = { dist: Math.round(this.d - this.lapFrom.d), sec: Math.round(this.moving - this.lapFrom.t) };
    this.laps.push(l); this.lapFrom = { d: this.d, t: this.moving };
    return l;
  };
  Recorder.prototype.snapshot = function () {
    var o = {};
    for (var k in this) if (Object.prototype.hasOwnProperty.call(this, k) && typeof this[k] !== 'function' && k !== 't') o[k] = this[k];
    o.elapsedBase = this.elapsed(); o.runFrom = this.now();
    return o;
  };
  Recorder.restore = function (snap, opts) {
    var r = new Recorder(snap.type, opts);
    for (var k in snap) r[k] = snap[k];
    r.t = TYPES[snap.type];
    if (r.state === 'rec') { r.runFrom = r.now(); r.last = null; r.raw = []; r.seg++; }   // time while the tab was dead isn't counted
    return r;
  };
  Recorder.prototype.finish = function (kg) {
    var el = this.elapsed();
    if (this.state === 'rec') this.elapsedBase = el;
    this.state = 'done';
    // last partial km keeps its pace in the splits table as a fraction
    var rest = this.d - this.splits.length * 1000;
    return finalize({
      type: this.type, start: new Date(this.startTs).toISOString(), elapsed: Math.round(el),
      moving: Math.round(this.moving), dist: Math.round(this.d), gain: Math.round(this.gain),
      pts: this.pts, splits: this.splits.slice(), lastSplit: rest > 50 ? { m: Math.round(rest), sec: Math.round(this.moving - this.splits.reduce(function (s, x) { return s + x; }, 0)) } : null,
      laps: this.laps.slice(), source: 'gps'
    }, kg);
  };

  function finalize(a, kg) {
    a.id = a.id || 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    a.kcal = kcal(a.type, kg, a.moving || a.elapsed, a.dist);
    a.title = a.title || autoTitle(a);
    a.best = bestEfforts(a.pts);
    return a;
  }
  function autoTitle(a) {
    var h = new Date(a.start).getHours();
    var part = h < 5 ? 'Night' : h < 12 ? 'Morning' : h < 14 ? 'Lunch' : h < 18 ? 'Afternoon' : h < 22 ? 'Evening' : 'Night';
    return part + ' ' + (TYPES[a.type] || TYPES.other).name.toLowerCase();
  }

  // fastest time over standard distances inside one activity (two-pointer over cumulative distance)
  var EFFORTS = [[400, '400 m'], [1000, '1 km'], [1609, '1 mile'], [5000, '5 km'], [10000, '10 km'], [21097, 'Half marathon'], [42195, 'Marathon']];
  function bestEfforts(pts) {
    var out = {};
    if (!pts || pts.length < 2) return out;
    var cum = [0], t = [pts[0][2]];
    for (var i = 1; i < pts.length; i++) {
      var same = pts[i][4] === pts[i - 1][4];
      cum.push(cum[i - 1] + (same ? dist(pts[i - 1], pts[i]) : 0));
      t.push(pts[i][2]);
    }
    // time spent between segments (pauses) is removed
    var tm = [0];
    for (i = 1; i < pts.length; i++) tm.push(tm[i - 1] + (pts[i][4] === pts[i - 1][4] ? t[i] - t[i - 1] : 0));
    EFFORTS.forEach(function (e) {
      var L = e[0], best = Infinity, j = 0;
      if (cum[cum.length - 1] < L) return;
      for (var k = 1; k < cum.length; k++) {
        while (j + 1 < k && cum[k] - cum[j + 1] >= L) j++;
        if (cum[k] - cum[j] >= L) {
          var over = cum[k] - cum[j] - L, seg = cum[k] - cum[k - 1];   // trim the overshoot proportionally
          var dtk = tm[k] - tm[k - 1];
          var tt = tm[k] - tm[j] - (seg > 0 ? dtk * over / seg : 0);
          if (tt < best) best = tt;
        }
      }
      if (best < Infinity) out[L] = Math.round(best);
    });
    return out;
  }

  // ------------------------------------------------------------------ GPX import (watch / other apps)
  function parseGPX(xml, kg) {
    var re = /<trkpt[^>]*?lat="([-\d.]+)"[^>]*?lon="([-\d.]+)"[^>]*?(?:\/>|>([\s\S]*?)<\/trkpt>)/g, m, pts = [];
    var re2 = /<trkpt[^>]*?lon="([-\d.]+)"[^>]*?lat="([-\d.]+)"[^>]*?(?:\/>|>([\s\S]*?)<\/trkpt>)/g;
    var found = false;
    while ((m = re.exec(xml))) { found = true; pts.push(pt(+m[1], +m[2], m[3])); }
    if (!found) while ((m = re2.exec(xml))) pts.push(pt(+m[2], +m[1], m[3]));
    function pt(lat, lon, body) {
      var ele = body && /<ele>([-\d.]+)<\/ele>/.exec(body), tm = body && /<time>([^<]+)<\/time>/.exec(body);
      return { lat: lat, lon: lon, ele: ele ? +ele[1] : null, ts: tm ? Date.parse(tm[1]) : null };
    }
    if (pts.length < 2) return null;
    var typeTag = /<type>([^<]+)<\/type>/.exec(xml), tt = typeTag ? typeTag[1].toLowerCase() : '';
    var type = /bik|cycl|rid/.test(tt) ? 'ride' : /walk/.test(tt) ? 'walk' : /hik/.test(tt) ? 'hike' : 'run';
    var name = /<trk>[\s\S]*?<name>([^<]+)<\/name>/.exec(xml);
    var timed = pts.every(function (p) { return p.ts; });
    var t0 = timed ? pts[0].ts : Date.now();
    var r = new Recorder(type, { now: function () { return t0; } });
    r.t = Object.assign({}, r.t, { maxSpeed: r.t.maxSpeed * 1.5 });   // recorded tracks are already clean
    r.start();
    pts.forEach(function (p, i) { r.add({ lat: p.lat, lon: p.lon, ele: p.ele, acc: 5, ts: timed ? p.ts : t0 + i * 1000 }); });
    var endTs = timed ? pts[pts.length - 1].ts : t0 + pts.length * 1000;
    r.now = function () { return endTs; };
    var a = r.finish(kg);
    a.source = 'gpx';
    if (!timed) { a.elapsed = 0; a.moving = 0; a.splits = []; a.best = {}; }
    if (name) a.title = name[1].trim();
    return a;
  }

  function manual(o, kg) {
    return finalize({
      type: o.type, start: o.start || new Date().toISOString(), elapsed: o.sec, moving: o.sec, dist: o.dist || 0, gain: 0,
      pts: [], splits: [], laps: [], source: 'manual', title: o.title, rpe: o.rpe, notes: o.notes, hr: o.hr
    }, kg);
  }

  // weekly totals for the progress view: [{ from: Date, dist, sec, n }] oldest → newest
  function weeks(acts, n, now) {
    now = now || new Date();
    var monday = new Date(now); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    var out = [];
    for (var w = n - 1; w >= 0; w--) {
      var from = new Date(monday); from.setDate(monday.getDate() - w * 7);
      var to = new Date(from); to.setDate(from.getDate() + 7);
      var sel = acts.filter(function (a) { var d = new Date(a.start); return d >= from && d < to; });
      out.push({ from: from, n: sel.length, dist: sel.reduce(function (s, a) { return s + (a.dist || 0); }, 0), sec: sel.reduce(function (s, a) { return s + (a.moving || a.elapsed || 0); }, 0) });
    }
    return out;
  }
  // personal records per type across all activities: { 1000: { sec, id, date } }
  function records(acts, type) {
    var rec = {};
    acts.filter(function (a) { return a.type === type && a.best; }).forEach(function (a) {
      Object.keys(a.best).forEach(function (L) {
        if (!rec[L] || a.best[L] < rec[L].sec) rec[L] = { sec: a.best[L], id: a.id, date: a.start };
      });
    });
    return rec;
  }

  global.Track = {
    TYPES: TYPES, GPS_TYPES: GPS_TYPES, MANUAL_TYPES: MANUAL_TYPES, EFFORTS: EFFORTS,
    dist: dist, kcal: kcal, pace: pace, speed: speed, km: km, clock: clock,
    Recorder: Recorder, bestEfforts: bestEfforts, parseGPX: parseGPX, manual: manual, weeks: weeks, records: records
  };
})(typeof window !== 'undefined' ? window : global);
