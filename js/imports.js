/*
 * Watch / tracker file import – pure logic, no DOM (unit-tested in Node by tools/imports.cjs).
 *
 * Brings workouts in from the files sport watches and apps export:
 *   - .fit  binary (Garmin, Coros, Suunto, Wahoo, Polar …) – compact decoder below
 *   - .tcx  XML (Garmin Connect, Polar Flow, Fitbit, many apps)
 *   - .gpx  XML (Strava, Apple Watch via export apps …) – Track.parseGPX plus heart rate extensions
 *   - .zip  (Garmin "Export Original", bulk exports) and .gz – unpacked with DecompressionStream
 * Every format is turned into a time series and built by ONE shared builder (fromSeries) into the
 * Activity shape of js/track.js, plus heart rate: hrs [[tSec, bpm]], hr (avg), hrMax, device.
 *
 * Imports.parse(fileName, arrayBuffer, kg) → Promise<Activity[]>
 * Imports.dedupe(existing, a)             → { action: 'added'|'merged'|'duplicate', target }
 * Imports.zones(hrs, maxHr)               → [{ z, name, from, to, sec }] × 5
 */
(function (global) {
  'use strict';

  var FIT_EPOCH = 631065600;     // seconds from 1970-01-01 to 1989-12-31 (FIT time zero)
  var GAP = 30;                  // s without samples = a pause
  function T() { return global.Track; }

  // ------------------------------------------------------------------ helpers
  function u8of(buf) {
    if (buf instanceof Uint8Array) return buf;
    if (buf && buf.buffer instanceof ArrayBuffer) return new Uint8Array(buf.buffer, buf.byteOffset || 0, buf.byteLength);
    return new Uint8Array(buf || 0);
  }
  function text(u8) {
    try { return new TextDecoder('utf-8').decode(u8); } catch (e) { return ''; }
  }
  function ext(name) { var m = /\.([a-z0-9]+)$/i.exec(name || ''); return m ? m[1].toLowerCase() : ''; }
  function isFIT(u8) { return u8.length >= 14 && u8[8] === 0x2E && u8[9] === 0x46 && u8[10] === 0x49 && u8[11] === 0x54; }
  function isZIP(u8) { return u8.length >= 4 && u8[0] === 0x50 && u8[1] === 0x4B && u8[2] === 3 && u8[3] === 4; }
  function isGZ(u8) { return u8.length >= 3 && u8[0] === 0x1F && u8[1] === 0x8B && u8[2] === 8; }
  function round1(x) { return Math.round(x * 10) / 10; }
  function newId() { return 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

  function autoTitle(type, startMs) {
    var h = new Date(startMs).getHours();
    var part = h < 5 ? 'Night' : h < 12 ? 'Morning' : h < 14 ? 'Lunch' : h < 18 ? 'Afternoon' : h < 22 ? 'Evening' : 'Night';
    return part + ' ' + (T().TYPES[type] || T().TYPES.other).name.toLowerCase();
  }
  // a file name is a title only when it reads like words ("Lake loop.gpx"), not "1234567_ACTIVITY.fit"
  function niceName(fileName) {
    var n = (fileName || '').replace(/^.*[\/\\]/, '').replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();
    if (!n || /\d{5,}/.test(n) || (n.match(/[a-z]/gi) || []).length < 3) return null;
    if (/^(activity|activities|track|workout|export|untitled|garmin|polar|suunto|coros|wahoo|fitbit|strava|route|file|new|\d)/i.test(n)) return null;
    return n.charAt(0).toUpperCase() + n.slice(1);
  }

  // unpack a gzip / raw-deflate buffer with the platform stream API (browsers, Node ≥ 18)
  function decompress(u8, format) {
    if (typeof DecompressionStream === 'undefined' || typeof Response === 'undefined') return Promise.reject(new Error('no DecompressionStream'));
    var stream = new Response(u8).body.pipeThrough(new DecompressionStream(format));
    return new Response(stream).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }

  // ------------------------------------------------------------------ heart rate
  // samples [[tSec, bpm]] → { hrs (≥ 5 s apart), hr (time-weighted avg), hrMax }
  function hrStats(series) {
    series = series.filter(function (s) { return s[1] > 0 && s[1] < 255; });
    if (!series.length) return null;
    var hrs = [], last = -Infinity, sum = 0, w = 0, max = 0;
    series.forEach(function (s, i) {
      var next = series[i + 1], dt = next ? Math.min(GAP, Math.max(0, next[0] - s[0])) : 1;
      sum += s[1] * dt; w += dt;
      if (s[1] > max) max = s[1];
      if (s[0] - last >= 5) { hrs.push([Math.round(s[0]), Math.round(s[1])]); last = s[0]; }
    });
    return { hrs: hrs, hr: Math.round(w ? sum / w : series[0][1]), hrMax: Math.round(max) };
  }

  // ------------------------------------------------------------------ shared builder
  // o = { type, startMs, samples: [{ t (ms), lat, lon, ele, hr, dist }], totals: { elapsed, moving, dist,
  //       kcal, ascent, hrAvg, hrMax }, laps: [{ dist, sec }], title, source, device }
  function fromSeries(o, kg) {
    var s = (o.samples || []).filter(function (x) { return x && isFinite(x.t); }).sort(function (a, b) { return a.t - b.t; });
    var tot = o.totals || {};
    var start = o.startMs || (s.length ? s[0].t : 0);
    if (!start || (!s.length && !tot.elapsed)) return null;
    var lastT = s.length ? s[s.length - 1].t : start;
    var elapsed = tot.elapsed || Math.max(0, (lastT - start) / 1000);
    if (!elapsed) return null;

    var type = o.type || 'other';
    var hasPos = s.some(function (x) { return x.lat != null && x.lon != null; });
    if (!hasPos && type === 'run') type = 'indoor_run';    // run without GPS = treadmill
    if (!hasPos && type === 'ride') type = 'indoor_ride';
    var hasRecDist = s.some(function (x) { return x.dist != null; });

    // walk the series once: moving time, cumulative distance, gaps, gain, points, splits
    var mt = 0, gaps = 0, cd = 0, cum = [], mts = [], pts = [], seg = 0, lastPos = null, lastKept = null;
    var gain = 0, eleRef = null, recDist = null;
    for (var i = 0; i < s.length; i++) {
      var x = s[i], dt = i ? (x.t - s[i - 1].t) / 1000 : 0, pause = dt > GAP;
      if (pause) { gaps += dt; seg++; lastKept = null; } else mt += dt;
      if (x.dist != null) recDist = x.dist;
      var pos = x.lat != null && x.lon != null && isFinite(x.lat) && isFinite(x.lon);
      if (pos) {
        if (lastPos && lastPos.seg === seg) cd += T().dist([lastPos.lat, lastPos.lon], [x.lat, x.lon]);
        lastPos = { lat: x.lat, lon: x.lon, seg: seg };
        var tSec = Math.round((x.t - start) / 1000);
        // ≥ 2 s between points, but always keep the last sample of a segment
        var segEnd = !s[i + 1] || (s[i + 1].t - x.t) / 1000 > GAP;
        if (!lastKept || tSec - lastKept[2] >= 2 || segEnd) {
          if (lastKept && tSec === lastKept[2]) pts.pop();
          lastKept = [Math.round(x.lat * 1e6) / 1e6, Math.round(x.lon * 1e6) / 1e6, tSec, x.ele != null && isFinite(x.ele) ? Math.round(x.ele) : null, seg];
          pts.push(lastKept);
        }
      }
      if (x.ele != null && isFinite(x.ele)) {   // 3 m hysteresis like the recorder
        if (eleRef == null) eleRef = x.ele;
        else if (x.ele - eleRef >= 3) { gain += x.ele - eleRef; eleRef = x.ele; }
        else if (eleRef - x.ele >= 3) eleRef = x.ele;
      }
      cum.push(hasRecDist ? (recDist || 0) : cd);
      mts.push(mt);
    }

    var dist = tot.dist || (hasRecDist ? recDist : 0) || cd || 0;
    var moving = tot.moving || Math.max(0, elapsed - gaps);

    // km splits in moving time, interpolated at the exact km mark
    var splits = [], sum = 0;
    for (i = 1; i < cum.length; i++) {
      var d0 = cum[i - 1], d1 = cum[i], m0 = mts[i - 1], m1 = mts[i];
      while (d1 > d0 && d1 >= (splits.length + 1) * 1000) {
        var mark = (splits.length + 1) * 1000, frac = (mark - d0) / (d1 - d0);
        var sp = round1(m0 + (m1 - m0) * Math.max(0, Math.min(1, frac)) - sum);
        splits.push(sp); sum += sp;
      }
    }
    var rest = dist - splits.length * 1000;
    var a = {
      id: newId(), type: type, start: new Date(start).toISOString(),
      elapsed: Math.round(elapsed), moving: Math.round(moving), dist: Math.round(dist),
      gain: Math.round(tot.ascent != null ? tot.ascent : gain),
      pts: pts, splits: splits,
      lastSplit: splits.length && rest > 50 ? { m: Math.round(rest), sec: Math.round(moving - sum) } : null,
      laps: o.laps && o.laps.length > 1 ? o.laps : [],
      source: o.source
    };
    a.kcal = tot.kcal ? Math.round(tot.kcal) : T().kcal(type, kg, a.moving || a.elapsed, a.dist);
    a.title = o.title || autoTitle(type, start);
    a.best = pts.length > 1 ? T().bestEfforts(pts) : {};
    var hr = hrStats(s.filter(function (x) { return x.hr; }).map(function (x) { return [(x.t - start) / 1000, x.hr]; }));
    if (hr) { a.hrs = hr.hrs; a.hr = hr.hr; a.hrMax = hr.hrMax; }
    if (tot.hrAvg) a.hr = Math.round(tot.hrAvg);
    if (tot.hrMax) a.hrMax = Math.round(tot.hrMax);
    if (o.device) a.device = o.device;
    return a;
  }

  // ------------------------------------------------------------------ FIT decoder
  var BASE_SIZE = { 0: 1, 1: 1, 2: 1, 3: 2, 4: 2, 5: 4, 6: 4, 10: 1, 11: 2, 12: 4 };   // integer base types we read
  function readField(dv, pos, size, base, le) {
    var b = base & 0x1F;
    if (BASE_SIZE[b] !== size) return null;   // strings, floats, 64-bit, arrays: skipped
    var v;
    switch (b) {
      case 0: case 2: case 10: v = dv.getUint8(pos); return v === 0xFF || (b === 10 && v === 0) ? null : v;
      case 1: v = dv.getInt8(pos); return v === 0x7F ? null : v;
      case 3: v = dv.getInt16(pos, le); return v === 0x7FFF ? null : v;
      case 4: case 11: v = dv.getUint16(pos, le); return v === 0xFFFF || (b === 11 && v === 0) ? null : v;
      case 5: v = dv.getInt32(pos, le); return v === 0x7FFFFFFF ? null : v;
      case 6: case 12: v = dv.getUint32(pos, le); return v === 0xFFFFFFFF || (b === 12 && v === 0) ? null : v;
    }
    return null;
  }
  // → [{ num (global message), f: { fieldNum: value } }] ; CRC is not checked
  function decodeFIT(u8) {
    if (!isFIT(u8)) return null;
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    var hs = u8[0], end = Math.min(u8.length, hs + dv.getUint32(4, true));
    if (hs < 12 || end <= hs) end = u8.length;
    var pos = hs, defs = {}, lastTs = null, out = [];
    while (pos < end) {
      var h = u8[pos++], local, ts = null;
      if (h & 0x80) {                                   // compressed timestamp header
        local = (h >> 5) & 3;
        var off = h & 0x1F;
        if (lastTs != null) {
          ts = lastTs - (lastTs % 32) + off;
          if (off < lastTs % 32) ts += 32;
          lastTs = ts;
        }
      } else if (h & 0x40) {                            // definition message
        local = h & 0x0F;
        if (pos + 5 > end) break;
        var le = u8[pos + 1] === 0, num = dv.getUint16(pos + 2, le), n = u8[pos + 4];
        pos += 5;
        var fields = [], size = 0;
        for (var i = 0; i < n && pos + 3 <= end; i++, pos += 3) {
          fields.push([u8[pos], u8[pos + 1], u8[pos + 2]]); size += u8[pos + 1];
        }
        if (h & 0x20 && pos < end) {                    // developer fields: only their sizes matter
          var nd = u8[pos++];
          for (i = 0; i < nd && pos + 3 <= end; i++, pos += 3) size += u8[pos + 1];
        }
        defs[local] = { num: num, le: le, fields: fields, size: size };
        continue;
      } else local = h & 0x0F;
      var def = defs[local];
      if (!def || pos + def.size > u8.length) break;    // corrupt / truncated: keep what we have
      var f = {}, p = pos;
      def.fields.forEach(function (fd) {
        var v = readField(dv, p, fd[1], fd[2], def.le);
        if (v != null) f[fd[0]] = v;
        p += fd[1];
      });
      pos += def.size;
      if (f[253] != null) lastTs = f[253];
      else if (ts != null) f[253] = ts;
      out.push({ num: def.num, f: f });
    }
    return out;
  }

  var MAKERS = { 1: 'Garmin', 23: 'Suunto', 123: 'Polar', 294: 'Coros', 32: 'Wahoo', 89: 'Tacx', 95: 'Stryd', 255: 'Development', 260: 'Zwift', 267: 'Bryton', 289: 'Hammerhead' };
  function fitType(sport, sub) {
    switch (sport) {
      case 1: return sub === 1 || sub === 58 ? 'indoor_run' : 'run';           // treadmill, virtual
      case 2: return sub === 5 || sub === 6 || sub === 58 ? 'indoor_ride' : 'ride';   // spin, indoor, virtual
      case 11: return 'walk';
      case 17: return 'hike';
      case 5: return 'swim';
      case 10: return sub === 43 ? 'yoga' : sub === 44 ? 'pilates' : 'gym';
      case 4: return 'gym';
      case 6: return 'basketball';
      case 7: return 'football';
      case 8: return 'tennis';
      case 12: case 13: return 'ski';
      default: return 'other';
    }
  }
  function fitMs(v) { return (v + FIT_EPOCH) * 1000; }

  function parseFIT(u8, kg, fileName) {
    var msgs = decodeFIT(u8);
    if (!msgs) return [];
    var recs = [], sessions = [], laps = [], device = null, sport = null;
    msgs.forEach(function (m) {
      var f = m.f;
      if (m.num === 0 && f[1] != null) device = MAKERS[f[1]] || null;
      else if (m.num === 12 && f[0] != null) sport = { sport: f[0], sub: f[1] };
      else if (m.num === 19) laps.push(f);
      else if (m.num === 18) sessions.push(f);
      else if (m.num === 20 && f[253] != null) {
        var lat = f[0] != null ? f[0] * 180 / 2147483648 : null, lon = f[1] != null ? f[1] * 180 / 2147483648 : null;
        var alt = f[78] != null ? f[78] / 5 - 500 : f[2] != null ? f[2] / 5 - 500 : null;
        recs.push({ t: fitMs(f[253]), lat: lat != null && lon != null ? lat : null, lon: lat != null && lon != null ? lon : null,
          ele: alt, hr: f[3] || null, dist: f[5] != null ? f[5] / 100 : null });
      }
    });
    var title = niceName(fileName);
    function build(sess, samples) {
      var sp = sess && sess[5] != null ? { sport: sess[5], sub: sess[6] } : sport || { sport: 0 };
      var startMs = sess && sess[2] != null ? fitMs(sess[2]) : samples.length ? samples[0].t : 0;
      var tot = {};
      if (sess) {
        if (sess[7] != null) tot.elapsed = sess[7] / 1000;
        if (sess[8] != null) tot.moving = sess[8] / 1000;
        if (sess[9] != null) tot.dist = sess[9] / 100;
        if (sess[11] != null) tot.kcal = sess[11];
        if (sess[16] != null) tot.hrAvg = sess[16];
        if (sess[17] != null) tot.hrMax = sess[17];
        if (sess[22] != null) tot.ascent = sess[22];
      }
      var lp = laps.filter(function (l) { return l[2] == null || !sess || (fitMs(l[2]) >= startMs && fitMs(l[2]) <= startMs + (tot.elapsed || 1e9) * 1000); })
        .map(function (l) { return { dist: Math.round((l[9] || 0) / 100), sec: Math.round((l[8] != null ? l[8] : l[7] || 0) / 1000) }; });
      return fromSeries({ type: fitType(sp.sport, sp.sub), startMs: startMs, samples: samples, totals: tot, laps: lp,
        title: title, source: 'fit', device: device }, kg);
    }
    var acts;
    if (sessions.length <= 1) acts = [build(sessions[0], recs)];
    else acts = sessions.map(function (sess) {   // multisport / several sessions: split records by time
      var from = sess[2] != null ? fitMs(sess[2]) : 0, to = from + ((sess[7] || 0) + 1000);
      return build(sess, recs.filter(function (r) { return r.t >= from && r.t <= to; }));
    });
    return acts.filter(Boolean);
  }

  // ------------------------------------------------------------------ TCX
  function tag(body, name) {   // first <name>value</name>, any namespace prefix
    var m = new RegExp('<(?:[\\w-]+:)?' + name + '\\b[^>]*>([^<]*)<').exec(body);
    return m ? m[1].trim() : null;
  }
  function num(v) { return v == null || v === '' || !isFinite(+v) ? null : +v; }
  function bpm(body, name) {
    var m = new RegExp('<(?:[\\w-]+:)?' + name + '\\b[^>]*>\\s*<(?:[\\w-]+:)?Value>\\s*([\\d.]+)').exec(body);
    return m ? +m[1] : null;
  }
  function parseTCX(xml, kg, fileName) {
    var out = [], am, reA = /<(?:[\w-]+:)?Activity\b([^>]*)>([\s\S]*?)<\/(?:[\w-]+:)?Activity>/g;
    while ((am = reA.exec(xml))) {
      var sportAttr = /Sport="([^"]*)"/.exec(am[1]), sport = sportAttr ? sportAttr[1].toLowerCase() : '';
      var type = /bik|cycl/.test(sport) ? 'ride' : /run/.test(sport) ? 'run' : /walk/.test(sport) ? 'walk' : /hik/.test(sport) ? 'hike' : /swim/.test(sport) ? 'swim' : 'other';
      var body = am[2], samples = [], laps = [], tot = { elapsed: 0, dist: 0, kcal: 0 }, hrMax = 0, lm;
      var reL = /<(?:[\w-]+:)?Lap\b([^>]*)>([\s\S]*?)<\/(?:[\w-]+:)?Lap>/g, firstLap = null;
      while ((lm = reL.exec(body))) {
        var lapStart = /StartTime="([^"]+)"/.exec(lm[1]);
        if (firstLap == null && lapStart) firstLap = Date.parse(lapStart[1]);
        var lapOnly = lm[2].replace(/<(?:[\w-]+:)?Track\b[\s\S]*?<\/(?:[\w-]+:)?Track>/g, '');   // lap totals, not trackpoints
        var sec = num(tag(lapOnly, 'TotalTimeSeconds')) || 0, d = num(tag(lapOnly, 'DistanceMeters')) || 0;
        tot.elapsed += sec; tot.dist += d; tot.kcal += num(tag(lapOnly, 'Calories')) || 0;
        hrMax = Math.max(hrMax, bpm(lapOnly, 'MaximumHeartRateBpm') || 0);
        laps.push({ dist: Math.round(d), sec: Math.round(sec) });
        var tm, reT = /<(?:[\w-]+:)?Trackpoint\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?Trackpoint>/g;
        while ((tm = reT.exec(lm[2]))) {
          var p = tm[1], t = Date.parse(tag(p, 'Time'));
          if (!isFinite(t)) continue;
          samples.push({ t: t, lat: num(tag(p, 'LatitudeDegrees')), lon: num(tag(p, 'LongitudeDegrees')),
            ele: num(tag(p, 'AltitudeMeters')), dist: num(tag(p, 'DistanceMeters')), hr: bpm(p, 'HeartRateBpm') });
        }
      }
      // TotalTimeSeconds is timer time; elapsed comes from the clock
      var startMs = firstLap || Date.parse(tag(body, 'Id')) || (samples[0] && samples[0].t);
      var totals = { moving: tot.elapsed || null, dist: tot.dist || null, kcal: tot.kcal || null, hrMax: hrMax || null };
      var lastT = samples.length ? samples[samples.length - 1].t : 0;
      totals.elapsed = lastT > startMs ? Math.max((lastT - startMs) / 1000, tot.elapsed) : tot.elapsed || null;
      var creator = /<(?:[\w-]+:)?Creator\b[\s\S]*?<(?:[\w-]+:)?Name>([^<]+)</.exec(body);
      var a = fromSeries({ type: type, startMs: startMs, samples: samples, totals: totals, laps: laps,
        title: niceName(fileName), source: 'tcx', device: creator ? brand(creator[1]) : null }, kg);
      if (a) out.push(a);
    }
    return out;
  }
  function brand(s) {
    var m = /garmin|polar|suunto|coros|wahoo|fitbit|apple|amazfit|zepp|huawei|samsung|forerunner|fenix|edge/i.exec(s || '');
    if (!m) return null;
    var b = m[0].toLowerCase();
    if (b === 'forerunner' || b === 'fenix' || b === 'edge') return 'Garmin';
    return b.charAt(0).toUpperCase() + b.slice(1);
  }

  // ------------------------------------------------------------------ GPX (+ heart rate)
  function parseGPXFile(xml, kg) {
    var a = T().parseGPX(xml, kg);
    if (!a) return [];
    a.source = 'gpx';
    var start = Date.parse(a.start), series = [], m, re = /<trkpt\b[^>]*>([\s\S]*?)<\/trkpt>/g;
    while ((m = re.exec(xml))) {
      var tm = /<time>([^<]+)<\/time>/.exec(m[1]), hr = /<(?:[\w-]+:)?hr>\s*([\d.]+)\s*</.exec(m[1]);
      if (tm && hr) series.push([(Date.parse(tm[1]) - start) / 1000, +hr[1]]);
    }
    var st = a.elapsed ? hrStats(series) : null;   // untimed GPX: no HR timeline
    if (st) { a.hrs = st.hrs; a.hr = st.hr; a.hrMax = st.hrMax; }
    var cr = /<gpx\b[^>]*creator="([^"]*)"/.exec(xml), dev = cr && brand(cr[1]);
    if (dev) a.device = dev;
    return [a];
  }

  // ------------------------------------------------------------------ ZIP
  function unzip(u8) {
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), entries = [], i;
    // central directory is authoritative (sizes are known even with data descriptors)
    var eocd = -1;
    for (i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd >= 0) {
      var n = dv.getUint16(eocd + 10, true), p = dv.getUint32(eocd + 16, true);
      for (i = 0; i < n && p + 46 <= u8.length && dv.getUint32(p, true) === 0x02014b50; i++) {
        var nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
        var lo = dv.getUint32(p + 42, true);
        entries.push({ name: text(u8.subarray(p + 46, p + 46 + nl)), method: dv.getUint16(p + 10, true),
          csize: dv.getUint32(p + 20, true), local: lo });
        p += 46 + nl + el + cl;
      }
      entries.forEach(function (e) {
        if (e.local + 30 > u8.length || dv.getUint32(e.local, true) !== 0x04034b50) { e.data = null; return; }
        var s = e.local + 30 + dv.getUint16(e.local + 26, true) + dv.getUint16(e.local + 28, true);
        e.data = u8.subarray(s, Math.min(u8.length, s + e.csize));
      });
    } else {
      // no central directory (truncated): walk local headers; entries with data descriptors can't be sized
      p = 0;
      while (p + 30 <= u8.length && dv.getUint32(p, true) === 0x04034b50) {
        var flag = dv.getUint16(p + 6, true), cs = dv.getUint32(p + 18, true);
        var nl2 = dv.getUint16(p + 26, true), el2 = dv.getUint16(p + 28, true), ds = p + 30 + nl2 + el2;
        if (flag & 8 && !cs) break;
        entries.push({ name: text(u8.subarray(p + 30, p + 30 + nl2)), method: dv.getUint16(p + 8, true), data: u8.subarray(ds, ds + cs) });
        p = ds + cs;
      }
    }
    return entries.filter(function (e) { return e.data && !/(^|\/)__MACOSX\//.test(e.name) && !/\/$/.test(e.name); });
  }
  function parseZIP(u8, kg, depth) {
    var wanted = unzip(u8).filter(function (e) { return /\.(fit|tcx|gpx|zip|gz)$/i.test(e.name); });
    return wanted.reduce(function (chain, e) {
      return chain.then(function (acc) {
        var data = e.method === 0 ? Promise.resolve(e.data) : e.method === 8 ? decompress(e.data, 'deflate-raw') : Promise.resolve(null);
        return data.then(function (d) { return d ? parseBytes(e.name, d, kg, depth + 1) : []; })
          .catch(function () { return []; })
          .then(function (list) { return acc.concat(list); });
      });
    }, Promise.resolve([]));
  }

  // ------------------------------------------------------------------ entry point
  function parseBytes(fileName, u8, kg, depth) {
    if (depth > 3 || !u8 || !u8.length) return Promise.resolve([]);
    var e = ext(fileName);
    if (isZIP(u8)) return parseZIP(u8, kg, depth);
    if (isGZ(u8)) return decompress(u8, 'gzip').then(function (d) { return parseBytes(fileName.replace(/\.gz$/i, ''), d, kg, depth + 1); });
    if (isFIT(u8) || e === 'fit') return Promise.resolve(parseFIT(u8, kg, fileName));
    var xml = text(u8.subarray(0, Math.min(u8.length, 4096)));
    if (/<TrainingCenterDatabase/i.test(xml) || e === 'tcx') return Promise.resolve(parseTCX(text(u8), kg, fileName));
    if (/<gpx[\s>]/i.test(xml) || e === 'gpx') return Promise.resolve(parseGPXFile(text(u8), kg));
    return Promise.resolve([]);
  }
  function parse(fileName, buf, kg) {
    return Promise.resolve().then(function () { return parseBytes(fileName || '', u8of(buf), kg, 0); })
      .catch(function () { return []; });
  }

  // ------------------------------------------------------------------ duplicates (phone + watch)
  var PAIRS = { run: 'indoor_run', indoor_run: 'run', ride: 'indoor_ride', indoor_ride: 'ride' };
  function compatible(a, b) { return a === b || PAIRS[a] === b || a === 'other' || b === 'other'; }
  function hasHr(x) { return !!(x.hrs && x.hrs.length) || !!x.hr; }
  function hasPts(x) { return !!(x.pts && x.pts.length); }
  function dedupe(existing, a) {
    var t = Date.parse(a.start), best = null, bestDt = Infinity;
    (existing || []).forEach(function (e) {
      if (!e || e === a) return;
      var dt = Math.abs(Date.parse(e.start) - t);
      if (!(dt <= 180000) || !compatible(e.type, a.type)) return;
      if (e.dist > 0 && a.dist > 0 && Math.abs(e.dist - a.dist) / Math.max(e.dist, a.dist) > 0.05) return;
      if (dt < bestDt) { best = e; bestDt = dt; }
    });
    if (!best) return { action: 'added', target: null };
    var changed = false;
    // take the watch's heart rate when we have none – or only a few live samples from a phone-paired strap
    var richer = a.hrs && a.hrs.length >= 2 * ((best.hrs || []).length) + 5;
    if (hasHr(a) && (!hasHr(best) || richer)) {
      if (a.hrs) {
        var shift = Math.round((Date.parse(a.start) - Date.parse(best.start)) / 1000);   // align to this activity's clock
        best.hrs = a.hrs.map(function (h) { return [h[0] + shift, h[1]]; }).filter(function (h) { return h[0] >= 0; });
      }
      if (a.hr) best.hr = a.hr;
      if (a.hrMax) best.hrMax = a.hrMax;
      changed = true;
    }
    if (!hasPts(best) && hasPts(a)) {
      best.pts = a.pts; best.best = a.best || {};
      if (!best.gain && a.gain) best.gain = a.gain;
      changed = true;
    }
    if (changed) {
      if (!(best.splits && best.splits.length) && a.splits && a.splits.length) { best.splits = a.splits; best.lastSplit = a.lastSplit; }
      if (!best.device && a.device) best.device = a.device;
    }
    return { action: changed ? 'merged' : 'duplicate', target: best };
  }

  // ------------------------------------------------------------------ heart rate zones
  var ZONES = ['Easy', 'Endurance', 'Tempo', 'Threshold', 'Max'];
  function zones(hrs, maxHr) {
    hrs = hrs || [];
    if (!maxHr) maxHr = hrs.reduce(function (m, h) { return Math.max(m, h[1]); }, 0);
    var out = ZONES.map(function (name, i) {
      return { z: i + 1, name: name, from: Math.round(maxHr * (0.5 + i / 10)), to: Math.round(maxHr * (0.6 + i / 10)), sec: 0 };
    });
    if (!maxHr) return out;
    for (var i = 0; i + 1 < hrs.length; i++) {
      var pct = hrs[i][1] / maxHr;
      if (pct < 0.5) continue;
      var z = Math.min(4, Math.floor(Math.round(pct * 1000) / 100 - 5));   // 0.5–0.6 → 0 … ≥ 0.9 → 4
      out[z].sec += Math.min(GAP, Math.max(0, hrs[i + 1][0] - hrs[i][0]));
    }
    return out;
  }

  global.Imports = {
    parse: parse, dedupe: dedupe, zones: zones,
    // exposed for tests / reuse
    fromSeries: fromSeries, decodeFIT: decodeFIT, parseFIT: parseFIT, parseTCX: parseTCX, unzip: unzip
  };
})(typeof window !== 'undefined' ? window : global);
