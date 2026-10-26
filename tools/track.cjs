// Sport tracker engine tests (no browser):  node tools/track.cjs
global.window = global;
require('../js/track.js');
const T = global.Track;
const errs = [];
const ok = (c, m) => { if (!c) errs.push(m); };
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol, m + ` (got ${a}, want ${b}±${tol})`);

// deterministic noise
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5;
const M_LAT = 1 / 111195;   // degrees latitude per metre

// a 3.5 km run north at 3 m/s (5:33 /km), 1 Hz fixes with ±1.5 m noise, a 60 s stop at 1.2 km,
// one 400 m GPS glitch and a 90 s screen-off gap (no fixes) at 2.5 km
function simulate(rec, clock) {
  let y = 0, t = 0, ele = 300;
  const fix = (acc) => rec.add({ lat: 46 + (y + rnd() * 3) * M_LAT, lon: 14.5 + rnd() * 3 * M_LAT / Math.cos(46 * Math.PI / 180), acc: acc || 6, ele: ele + rnd(), ts: clock.t });
  rec.start();
  while (y < 3500) {
    clock.t += 1000; t++;
    if (y >= 1200 && y < 1203 && !simulate.stopped) { simulate.stopped = true; for (let i = 0; i < 60; i++) { clock.t += 1000; fix(); } }
    if (y >= 2500 && !simulate.gap) { simulate.gap = true; clock.t += 90000; y += 270; }   // ran 270 m with the screen off
    y += 3; if (y > 1800 && y < 2100) ele += 0.3;
    if (t === 500) { y += 400; fix(); y -= 400; continue; }   // glitch fix
    if (t === 900) fix(80);                                     // weak fix
    fix();
  }
}
const clock = { t: Date.parse('2026-10-19T07:00:00Z') };
const rec = new T.Recorder('run', { now: () => clock.t, onSplit: (k, s) => { splitsSeen.push([k, s]); } });
const splitsSeen = [];
simulate(rec, clock);
const a = rec.finish(80);
near(a.dist, 3500, 70, 'distance');
near(a.moving, 3500 / 3, 40, 'moving time excludes the stop');
ok(a.elapsed >= a.moving + 55, 'elapsed time includes the stop');
ok(a.splits.length === 3 && splitsSeen.length === 3, 'three km splits: ' + a.splits.length);
a.splits.forEach((s, i) => near(s, 333, 25, 'split ' + (i + 1)));
near(a.gain, 30, 6, 'elevation gain (noise filtered)');
near(a.best[1000], 333, 20, 'best 1 km effort');
ok(!a.best[5000], 'no 5 km effort in a 3.5 km run');
ok(a.kcal > 250 && a.kcal < 400, 'calories ' + a.kcal);
ok(a.title === 'Morning run' || /run$/.test(a.title), 'auto title ' + a.title);
ok(T.pace(333, 1000) === '5:33', 'pace format ' + T.pace(333, 1000));
ok(T.clock(3725) === '1:02:05', 'clock format');

// standing still for 2 minutes: no distance, auto-paused
const c2 = { t: 0 }, r2 = new T.Recorder('walk', { now: () => c2.t });
r2.start();
for (let i = 0; i < 120; i++) { c2.t += 1000; r2.add({ lat: 46 + rnd() * 4 * M_LAT, lon: 14.5 + rnd() * 4 * M_LAT, acc: 8, ts: c2.t }); }
ok(r2.d < 15, 'GPS jitter while standing adds no distance: ' + r2.d.toFixed(1));
ok(r2.auto, 'auto-pause after standing still');
// then a slow walk (1 m/s) must resume
let wy = 0;
for (let i = 0; i < 60; i++) { c2.t += 1000; wy += 1; r2.add({ lat: 46 + wy * M_LAT, lon: 14.5, acc: 5, ts: c2.t }); }
ok(!r2.auto && r2.d > 40, 'slow walk resumes from auto-pause: ' + r2.d.toFixed(1));

// manual pause: no line across the pause, time stops
const c3 = { t: 0 }, r3 = new T.Recorder('ride', { now: () => c3.t });
r3.start();
let ry = 0;
for (let i = 0; i < 30; i++) { c3.t += 1000; ry += 8; r3.add({ lat: 46 + ry * M_LAT, lon: 14.5, acc: 5, ts: c3.t }); }
r3.pause(); c3.t += 300000; ry += 2000; r3.resume();
for (let i = 0; i < 30; i++) { c3.t += 1000; ry += 8; r3.add({ lat: 46 + ry * M_LAT, lon: 14.5, acc: 5, ts: c3.t }); }
near(r3.d, 460, 20, 'manual pause: distance during pause not counted');   // 2 × 29 × 8 m, minus ~1 s smoothing lag
near(r3.elapsed(), 60, 2, 'manual pause: elapsed stops');

// snapshot / restore keeps going
const snap = JSON.parse(JSON.stringify(r3.snapshot()));
const r4 = T.Recorder.restore(snap, { now: () => c3.t });
for (let i = 0; i < 10; i++) { c3.t += 1000; ry += 8; r4.add({ lat: 46 + ry * M_LAT, lon: 14.5, acc: 5, ts: c3.t }); }
ok(r4.d > r3.d + 60, 'restored recorder continues');

// GPX round trip
const gpx = '<?xml version="1.0"?><gpx><trk><name>Lake loop</name><type>running</type><trkseg>' +
  Array.from({ length: 601 }, (_, i) => `<trkpt lat="${(46 + i * 3.4 * M_LAT).toFixed(7)}" lon="14.5"><ele>${300 + i * 0.05}</ele><time>${new Date(Date.parse('2026-10-18T06:00:00Z') + i * 1000).toISOString()}</time></trkpt>`).join('') +
  '</trkseg></trk></gpx>';
const g = T.parseGPX(gpx, 70);
ok(g && g.title === 'Lake loop' && g.type === 'run', 'GPX name + type');
near(g.dist, 2040, 25, 'GPX distance');
near(g.moving, 600, 5, 'GPX moving time');
ok(g.splits.length === 2, 'GPX splits');
ok(g.start === '2026-10-18T06:00:00.000Z', 'GPX start time');

// manual entry + weekly totals + records
const m = T.manual({ type: 'tennis', sec: 3600, rpe: 7, start: '2026-10-20T10:00:00.000Z' }, 80);
ok(m.kcal === 584 && m.title === 'Morning tennis' || m.kcal === 584, 'manual tennis kcal ' + m.kcal);
const wk = T.weeks([a, g, m], 4, new Date('2026-10-21T12:00:00Z'));
ok(wk.length === 4 && wk[3].n === 2 && wk[2].n === 1, 'weekly buckets ' + JSON.stringify(wk.map(w => w.n)));
const pr = T.records([a, g], 'run');
ok(pr[1000] && pr[1000].sec <= a.best[1000], 'records pick the fastest');

console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
