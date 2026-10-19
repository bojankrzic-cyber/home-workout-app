// Watch / tracker import tests (no browser):  node tools/imports.cjs
// Builds synthetic FIT / TCX / GPX / ZIP files itself, so no fixtures are needed.
global.window = global;
require('../js/track.js');
require('../js/imports.js');
const zlib = require('zlib');
const T = global.Track, I = global.Imports;
const errs = [];
const ok = (c, m) => { if (!c) errs.push(m); };
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol, m + ` (got ${a}, want ${b}±${tol})`);

const M_LAT = 1 / 111195;   // degrees latitude per metre
const FIT_EPOCH = 631065600;
const T0 = Date.parse('2026-10-18T06:00:00Z');
const fitTs = (ms) => Math.round(ms / 1000) - FIT_EPOCH;
const semi = (deg) => Math.round(deg * 2147483648 / 180);

// ------------------------------------------------------------------ tiny FIT encoder
// field = [num, size, base]; base: 0x00 enum, 0x02 uint8, 0x84 uint16, 0x85 sint32, 0x86 uint32, 0x07 string
class Fit {
  constructor() { this.parts = []; this.defs = {}; }
  def(local, gnum, fields, opts = {}) {
    const be = !!opts.bigEndian, dev = opts.dev || [];
    const b = [0x40 | (dev.length ? 0x20 : 0) | local, 0, be ? 1 : 0];
    b.push(...(be ? [gnum >> 8, gnum & 255] : [gnum & 255, gnum >> 8]), fields.length);
    fields.forEach(f => b.push(...f));
    if (dev.length) { b.push(dev.length); dev.forEach(d => b.push(...d)); }   // [field, size, dev index]
    this.defs[local] = { fields, be, devSize: dev.reduce((s, d) => s + d[1], 0) };
    this.parts.push(Buffer.from(b));
  }
  // values: { fieldNum: value }; missing → invalid; compressed: timestamp for a compressed header
  data(local, values, compressed) {
    const d = this.defs[local];
    const size = d.fields.reduce((s, f) => s + f[1], 0) + d.devSize;
    const buf = Buffer.alloc(1 + size, 0);
    buf[0] = compressed != null ? 0x80 | (local << 5) | (compressed & 31) : local;
    let p = 1;
    d.fields.forEach(([num, sz, base]) => {
      const v = values[num];
      const w = (fn, x) => buf[fn + (d.be ? 'BE' : 'LE')](x, p);
      if (base === 0x07) buf.write(String(v || ''), p, sz, 'latin1');
      else if (sz === 1) base === 0x01 ? buf.writeInt8(v == null ? 0x7F : v, p) : buf.writeUInt8(v == null ? 0xFF : v, p);
      else if (sz === 2) w('writeUInt16', v == null ? 0xFFFF : v);
      else if (sz === 4) base === 0x85 ? w('writeInt32', v == null ? 0x7FFFFFFF : v) : w('writeUInt32', v == null ? 0xFFFFFFFF : v);
      p += sz;
    });
    for (let i = 0; i < d.devSize; i++) buf[p + i] = 0xAB;   // developer data bytes (must be skipped)
    this.parts.push(buf);
  }
  bytes() {
    const body = Buffer.concat(this.parts);
    const h = Buffer.alloc(14);
    h[0] = 14; h[1] = 0x20; h.writeUInt16LE(2132, 2); h.writeUInt32LE(body.length, 4); h.write('.FIT', 8, 'latin1');
    return Buffer.concat([h, body, Buffer.alloc(2)]);   // CRC left as zero (decoder ignores it)
  }
}
const ab = (buf) => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

const FILE_ID = [[0, 1, 0x00], [1, 2, 0x84], [2, 2, 0x84], [4, 4, 0x86]];
const REC_FULL = [[253, 4, 0x86], [0, 4, 0x85], [1, 4, 0x85], [2, 2, 0x84], [3, 1, 0x02], [5, 4, 0x86], [6, 2, 0x84]];
const REC_COMP = [[0, 4, 0x85], [1, 4, 0x85], [78, 4, 0x86], [3, 1, 0x02], [5, 4, 0x86]];   // no timestamp, enhanced altitude
const SESSION = [[253, 4, 0x86], [2, 4, 0x86], [5, 1, 0x00], [6, 1, 0x00], [7, 4, 0x86], [8, 4, 0x86], [9, 4, 0x86],
  [11, 2, 0x84], [16, 1, 0x02], [17, 1, 0x02], [22, 2, 0x84], [4, 8, 0x07]];   // + an 8-byte string field to skip

// ---- 3.6 km run: 3 m/s, 1 Hz, a 60 s pause (no records) at 1.5 km, climbs 20 m between 2.0 and 2.4 km
function runFit() {
  const f = new Fit();
  f.def(0, 0, FILE_ID);
  f.data(0, { 0: 4, 1: 1, 2: 3121, 4: fitTs(T0) });
  f.def(1, 20, REC_COMP, { dev: [[0, 2, 0]] });   // developer field (2 bytes) on the compressed-record definition
  f.def(2, 20, REC_FULL);
  let t = T0, y = 0, prevGap = false, hrMax = 0, hrSum = 0, n = 0;
  const truth = { n: 0 };
  for (let i = 0; i <= 1200; i++) {
    if (i === 500) { t += 61000; prevGap = true; }   // paused 60 s: a 61 s step between records
    const ele = 300 + Math.max(0, Math.min(20, (y - 2000) / 20));
    const hr = 120 + Math.round(i / 30) + (i % 7);
    hrMax = Math.max(hrMax, hr); hrSum += hr; n++;
    const lat = semi(46 + y * M_LAT), lon = semi(14.5), dist = Math.round(y * 100);
    if (i % 3 === 0 || prevGap) f.data(2, { 253: fitTs(t), 0: lat, 1: lon, 2: Math.round((ele + 500) * 5), 3: hr, 5: dist, 6: 3000 });
    else f.data(1, { 0: lat, 1: lon, 78: Math.round((ele + 500) * 5), 3: hr, 5: dist }, fitTs(t));
    prevGap = false;
    t += 1000; y += 3;
  }
  truth.end = t - 1000; truth.hrAvg = Math.round(hrSum / n); truth.hrMax = hrMax;
  f.def(3, 18, SESSION);
  f.data(3, { 253: fitTs(truth.end), 2: fitTs(T0), 5: 1, 6: 0, 7: (truth.end - T0), 8: 1200000, 9: 360000,
    11: 290, 16: truth.hrAvg, 17: truth.hrMax, 22: 20, 4: 'running' });
  return { buf: f.bytes(), truth };
}

// ---- treadmill: no positions, HR + distance, 2.5 m/s for 20 min, no session HR (computed from records)
function treadmillFit(bigEndian) {
  const f = new Fit(), t0 = T0 + 86400000;
  f.def(0, 0, FILE_ID, { bigEndian });
  f.data(0, { 0: 4, 1: 294, 2: 1, 4: fitTs(t0) });
  f.def(1, 20, [[253, 4, 0x86], [3, 1, 0x02], [5, 4, 0x86], [73, 4, 0x86]], { bigEndian });
  for (let i = 0; i <= 1200; i++) f.data(1, { 253: fitTs(t0 + i * 1000), 3: i < 600 ? 130 : 150, 5: Math.round(i * 2.5 * 100), 73: 2500 });
  f.def(2, 18, [[253, 4, 0x86], [2, 4, 0x86], [5, 1, 0x00], [6, 1, 0x00], [7, 4, 0x86], [8, 4, 0x86], [9, 4, 0x86]], { bigEndian });
  f.data(2, { 253: fitTs(t0 + 1200000), 2: fitTs(t0), 5: 1, 6: 1, 7: 1200000, 8: 1200000, 9: 300000 });
  return f.bytes();
}

// ------------------------------------------------------------------ TCX: 2 laps of 2.5 km biking at 7 m/s
function tcx() {
  const t0 = T0 + 2 * 86400000;
  let pts = [[], []], d = 0;
  for (let i = 0; i <= 715; i++) {
    const lap = i < 357 ? 0 : 1;
    pts[lap].push(`<Trackpoint><Time>${new Date(t0 + i * 1000).toISOString()}</Time><Position><LatitudeDegrees>${(46 + d * M_LAT).toFixed(7)}</LatitudeDegrees><LongitudeDegrees>14.5</LongitudeDegrees></Position><AltitudeMeters>${200 + i * 0.02}</AltitudeMeters><DistanceMeters>${d.toFixed(1)}</DistanceMeters><HeartRateBpm><Value>${lap ? 160 : 140}</Value></HeartRateBpm></Trackpoint>`);
    d += 7;
  }
  const lap = (k, start) => `<Lap StartTime="${new Date(start).toISOString()}"><TotalTimeSeconds>357</TotalTimeSeconds><DistanceMeters>2500</DistanceMeters><MaximumHeartRateBpm><Value>${k ? 165 : 145}</Value></MaximumHeartRateBpm><Calories>${k ? 90 : 80}</Calories><Track>${pts[k].join('')}</Track></Lap>`;
  return `<?xml version="1.0"?><TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Biking"><Id>${new Date(t0).toISOString()}</Id>` +
    lap(0, t0) + lap(1, t0 + 357000) + '<Creator><Name>Edge 530</Name></Creator></Activity></Activities></TrainingCenterDatabase>';
}

// ------------------------------------------------------------------ GPX with Garmin TrackPointExtension HR
function gpx(withHr, t0 = T0) {
  return '<?xml version="1.0"?><gpx creator="Garmin Connect" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"><trk><name>Lake loop</name><type>running</type><trkseg>' +
    Array.from({ length: 1201 }, (_, i) => {
      const t = t0 + i * 1000 + (i >= 500 ? 61000 : 0) - (i >= 500 ? 1000 : 0);
      return `<trkpt lat="${(46 + i * 3 * M_LAT).toFixed(7)}" lon="14.5"><ele>300</ele><time>${new Date(t).toISOString()}</time>` +
        (withHr ? `<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${130 + (i % 10)}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>` : '') + '</trkpt>';
    }).join('') + '</trkseg></trk></gpx>';
}

// ------------------------------------------------------------------ ZIP writer (deflate + data descriptor, and stored)
function zip(files) {
  const locals = [], central = [];
  let off = 0;
  files.forEach(({ name, data, deflate }) => {
    const nm = Buffer.from(name), comp = deflate ? zlib.deflateRawSync(data) : data;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(deflate ? 8 : 0, 6);
    lh.writeUInt16LE(deflate ? 8 : 0, 8);
    if (!deflate) { lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); }   // descriptor case: sizes 0 here
    lh.writeUInt16LE(nm.length, 26);
    const dd = deflate ? Buffer.alloc(16) : Buffer.alloc(0);
    if (deflate) { dd.writeUInt32LE(0x08074b50, 0); dd.writeUInt32LE(comp.length, 8); dd.writeUInt32LE(data.length, 12); }
    locals.push(lh, nm, comp, dd);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(deflate ? 8 : 0, 8);
    ch.writeUInt16LE(deflate ? 8 : 0, 10); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nm.length, 28); ch.writeUInt32LE(off, 42);
    central.push(ch, nm);
    off += 30 + nm.length + comp.length + dd.length;
  });
  const cd = Buffer.concat(central), e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(files.length, 8); e.writeUInt16LE(files.length, 10);
  e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...locals, cd, e]);
}

(async () => {
  // ---- FIT run
  const { buf: runBuf, truth } = runFit();
  const runs = await I.parse('12345678_ACTIVITY.fit', ab(runBuf), 70);
  ok(runs.length === 1, 'FIT: one activity, got ' + runs.length);
  const r = runs[0] || {};
  ok(r.type === 'run' && r.source === 'fit', 'FIT: type run / source fit: ' + r.type + ' ' + r.source);
  ok(r.start === new Date(T0).toISOString(), 'FIT: start time ' + r.start);
  near(r.dist, 3600, 36, 'FIT: distance');
  near(r.elapsed, 1260, 2, 'FIT: elapsed includes the pause');
  near(r.moving, 1200, 2, 'FIT: moving excludes the pause');
  ok(r.splits && r.splits.length === 3, 'FIT: 3 splits, got ' + JSON.stringify(r.splits));
  (r.splits || []).forEach((s, i) => near(s, 333.3, 2, 'FIT: split ' + (i + 1)));
  ok(r.hr === truth.hrAvg && r.hrMax === truth.hrMax, `FIT: hr ${r.hr}/${r.hrMax} vs ${truth.hrAvg}/${truth.hrMax}`);
  ok(r.hrs && r.hrs.length > 200 && r.hrs.length <= 1260 / 5 + 2, 'FIT: hrs downsampled, n=' + (r.hrs || []).length);
  ok((r.hrs || []).every((h, i, a) => !i || h[0] - a[i - 1][0] >= 5), 'FIT: hrs ≥ 5 s apart');
  ok(r.pts && r.pts.length > 300 && r.pts.length <= 605, 'FIT: pts downsampled to ≥ 2 s, n=' + (r.pts || []).length);
  ok((r.pts || []).every((p, i, a) => !i || p[2] - a[i - 1][2] >= 1), 'FIT: pts increasing time');
  ok(new Set((r.pts || []).map(p => p[4])).size === 2, 'FIT: 2 segments');
  ok(r.pts && r.pts[0][3] === 300 && Math.abs(r.pts[0][0] - 46) < 1e-5, 'FIT: first point position/elevation ' + JSON.stringify(r.pts && r.pts[0]));
  ok(r.device === 'Garmin', 'FIT: device ' + r.device);
  ok(r.best && r.best[1000] > 320 && r.best[1000] < 345, 'FIT: best 1 km ' + (r.best && r.best[1000]));
  ok(r.gain === 20 && r.kcal === 290, 'FIT: session ascent / calories ' + r.gain + ' ' + r.kcal);
  ok(r.lastSplit && Math.abs(r.lastSplit.m - 600) <= 5, 'FIT: last partial split ' + JSON.stringify(r.lastSplit));
  ok(r.title === 'Morning run' || /run$/.test(r.title), 'FIT: auto title ' + r.title);
  ok(typeof r.id === 'string' && r.id[0] === 'a', 'FIT: id');

  // ---- treadmill (little + big endian)
  for (const be of [false, true]) {
    const tm = (await I.parse('treadmill.fit', ab(treadmillFit(be)), 70))[0] || {};
    const tag = be ? 'FIT big-endian' : 'FIT treadmill';
    ok(tm.type === 'indoor_run', tag + ': type ' + tm.type);
    ok(!tm.pts || tm.pts.length === 0, tag + ': no pts');
    near(tm.dist, 3000, 1, tag + ': distance');
    near(tm.moving, 1200, 1, tag + ': moving');
    near(tm.hr, 140, 1, tag + ': time-weighted hr');
    ok(tm.hrMax === 150, tag + ': hrMax ' + tm.hrMax);
    ok(tm.splits && tm.splits.length === 3 && Math.abs(tm.splits[0] - 400) < 1, tag + ': splits ' + JSON.stringify(tm.splits));
    ok(tm.device === 'Coros', tag + ': device ' + tm.device);
    ok(tm.kcal > 0, tag + ': kcal estimated');
  }

  // ---- TCX
  const rides = await I.parse('ride.tcx', ab(Buffer.from(tcx())), 70);
  const rd = rides[0] || {};
  ok(rides.length === 1 && rd.type === 'ride' && rd.source === 'tcx', 'TCX: one ride ' + rd.type);
  near(rd.dist, 5000, 1, 'TCX: distance from laps');
  near(rd.moving, 714, 1, 'TCX: moving from laps');
  ok(rd.laps && rd.laps.length === 2, 'TCX: 2 laps');
  near(rd.hr, 150, 1, 'TCX: average hr');
  ok(rd.hrMax === 165, 'TCX: max hr from laps ' + rd.hrMax);
  ok(rd.kcal === 170, 'TCX: calories ' + rd.kcal);
  ok(rd.pts && rd.pts.length > 300, 'TCX: points');
  ok(rd.splits && rd.splits.length === 5, 'TCX: splits ' + (rd.splits || []).length);
  ok(rd.device === 'Garmin', 'TCX: device from creator ' + rd.device);

  // ---- GPX with HR extensions
  const gs = await I.parse('lake.gpx', ab(Buffer.from(gpx(true))), 70);
  const g = gs[0] || {};
  ok(gs.length === 1 && g.source === 'gpx' && g.title === 'Lake loop', 'GPX: parsed ' + g.title);
  ok(g.hrs && g.hrs.length > 200, 'GPX: hr series attached');
  near(g.hr, 134.5, 1, 'GPX: average hr');
  ok(g.hrMax === 139, 'GPX: max hr');
  ok(g.device === 'Garmin', 'GPX: device from creator');

  // ---- ZIP (deflated FIT with a data descriptor + a stored GPX + junk)
  const z = zip([
    { name: 'export/12345678_ACTIVITY.fit', data: runBuf, deflate: true },
    { name: 'export/lake.gpx', data: Buffer.from(gpx(true)), deflate: false },
    { name: 'export/readme.txt', data: Buffer.from('hello'), deflate: false }
  ]);
  const za = await I.parse('export.zip', ab(z), 70);
  ok(za.length === 2, 'ZIP: 2 activities, got ' + za.length);
  ok(za.some(a => a.source === 'fit' && Math.abs(a.dist - 3600) < 36) && za.some(a => a.source === 'gpx'), 'ZIP: fit + gpx inside');
  const gz = await I.parse('ride.tcx.gz', ab(zlib.gzipSync(Buffer.from(tcx()))), 70);
  ok(gz.length === 1 && gz[0].type === 'ride', 'GZ: tcx inside');

  // ---- garbage
  for (const [name, data] of [['x.fit', Buffer.alloc(0)], ['x.fit', Buffer.from('not a fit file at all')], ['x.zip', Buffer.from('PK\x03\x04garbage')],
    ['x.gpx', Buffer.from('<gpx><trk></trk></gpx>')], ['x.tcx', Buffer.from('<TrainingCenterDatabase>')], ['x.bin', Buffer.from([1, 2, 3])],
    ['x.fit', runBuf.subarray(0, 300)]]) {
    let res;
    try { res = await I.parse(name, ab(data), 70); } catch (e) { res = 'threw ' + e.message; }
    ok(Array.isArray(res) && (res.length === 0 || name === 'x.fit'), 'garbage ' + name + ': ' + JSON.stringify(res).slice(0, 60));
  }
  ok(Array.isArray(await I.parse('nothing', null, 70)), 'null buffer → []');

  // ---- dedupe: phone recording (no HR) + watch FIT (HR) of the same run
  const phone = T.parseGPX(gpx(false, T0 + 40000), 70);
  phone.source = 'gps'; delete phone.hrs; delete phone.hr;
  const list = [phone];
  const fit1 = (await I.parse('a.fit', ab(runBuf), 70))[0];
  const d1 = I.dedupe(list, fit1);
  ok(d1.action === 'merged' && d1.target === phone, 'dedupe: merged into phone run, got ' + d1.action + ` (phone ${phone.dist} m, fit ${fit1.dist} m)`);
  ok(phone.hrs && phone.hrs.length > 200 && phone.hr === fit1.hr && phone.hrMax === fit1.hrMax && phone.device === 'Garmin', 'dedupe: HR moved into phone activity');
  ok(phone.source === 'gps' && phone.pts.length > 0, 'dedupe: phone keeps its own track');
  const fit2 = (await I.parse('a.fit', ab(runBuf), 70))[0];
  ok(I.dedupe(list, fit2).action === 'duplicate', 'dedupe: importing the FIT again → duplicate');
  const other = Object.assign({}, fit2, { start: new Date(T0 + 86400000).toISOString() });
  ok(I.dedupe(list, other).action === 'added', 'dedupe: different day → added');
  ok(I.dedupe(list, Object.assign({}, fit2, { type: 'ride' })).action === 'added', 'dedupe: run vs ride → added');
  ok(I.dedupe(list, Object.assign({}, fit2, { dist: 5000 })).action === 'added', 'dedupe: distance off by > 5 % → added');
  const tread = { type: 'indoor_run', start: new Date(T0 + 60000).toISOString(), dist: 0, pts: [], hr: 140 };
  ok(I.dedupe([tread], fit2).action === 'merged' && tread.pts.length > 0, 'dedupe: treadmill without distance absorbs GPS track');

  // ---- zones (max 200): 50–60 % = 100–120 bpm …
  const zs = I.zones([[0, 90], [10, 110], [20, 130], [30, 150], [40, 170], [50, 190], [100, 200], [110, 140]], 200);
  ok(zs.length === 5 && zs.map(z => z.name).join() === 'Easy,Endurance,Tempo,Threshold,Max', 'zones: names');
  ok(JSON.stringify(zs.map(z => z.sec)) === '[10,10,10,10,40]', 'zones: seconds ' + JSON.stringify(zs.map(z => z.sec)));
  ok(zs[0].from === 100 && zs[0].to === 120 && zs[4].to === 200, 'zones: bpm bounds');
  ok(I.zones(r.hrs, 190).reduce((s, z) => s + z.sec, 0) > 1100, 'zones: run series fills the zones');

  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
})().catch(e => { console.log('ERRORS:\n' + e.stack); });
