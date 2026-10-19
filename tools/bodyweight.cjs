// Bodyweight-only program test (no browser needed):  node tools/bodyweight.cjs
// Loads figure.js + exercises.js + program.js and checks that a profile with NO equipment gets complete,
// sensible workouts for every template session, goal, level and block week, plus the custom builder.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = { console, Math, JSON, Date, Object, Array };
ctx.window = ctx; vm.createContext(ctx);
for (const f of ['figure', 'exercises', 'program']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../js/' + f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
const E = ctx.Exercises, P = ctx.Program, F = ctx.Figure;
const errs = [], log = (...a) => console.log(...a);
const fail = (m) => errs.push(m);
const OWN = ['floor'];
const NEW = ['knee_pushup', 'pike_pushup', 'superman', 'prone_y_raise', 'side_plank', 'wall_sit', 'jump_squat', 'burpee', 'hollow_hold', 'sl_glute_bridge', 'hamstring_floor'];
const GOALS = ['muscle', 'strength', 'fatloss', 'endurance', 'hyrox', 'general'];
const LEVELS = ['beg', 'mid', 'adv'];
const ex = (id) => E.BY_ID[id];

// ---------------------------------------------------------------- exercise data
NEW.forEach((id) => {
  const e = ex(id);
  if (!e) return fail('missing exercise ' + id);
  if (e.equip.join() !== 'floor') fail(id + ': equip must be floor only');
  if (!e.cues || e.cues.length !== 3) fail(id + ': needs 3 cues');
  if (!e.mistakes || e.mistakes.length !== 2) fail(id + ': needs 2 mistakes');
  if (!e.groups.length) fail(id + ': no focus groups');
  if (!e.anim.muscles.p.length) fail(id + ': no primary muscles');
  if (!E.PATTERN_OF[id]) fail(id + ': no movement pattern');
  if (['strength', 'core', 'cardio', 'mobility'].indexOf(e.type) < 0) fail(id + ': bad type');
  // animation: every joint stays on / above the floor and inside a sane box at many sample times
  const T = F.totalDur(e.anim);
  for (let k = 0; k <= 40; k++) {
    const J = F.solve(F.sample(e.anim, T * k / 40));
    for (const j of ['hip', 'sho', 'head', 'eN', 'eF', 'hN', 'hF', 'kN', 'kF', 'fN', 'fF', 'toeN', 'toeF', 'heelN', 'heelF']) {
      const p = J[j];
      if (!p || !isFinite(p[0]) || !isFinite(p[1])) { fail(id + ': bad joint ' + j); break; }
      if (p[1] > 1.5) fail(id + ' @' + (T * k / 40).toFixed(2) + 's: ' + j + ' below the floor (' + p[1].toFixed(1) + ')');
      if (Math.abs(p[0]) > 200 || p[1] < -260) fail(id + ': ' + j + ' far out of frame');
    }
    if (J.head[1] > -9) fail(id + ': head through the floor at ' + (T * k / 40).toFixed(2) + 's');
  }
});
const unlocked = E.LIST.filter((e) => E.available(e.id, OWN)).length;
log('bodyweight-only exercises unlocked:', unlocked, '(new:', NEW.length + ')');
if (unlocked < 20) fail('too few bodyweight exercises: ' + unlocked);
if (!E.EQUIP.floor.always) fail('floor must always be available');

// ---------------------------------------------------------------- generated sessions
const isLegs = (e) => e.type !== 'cardio' && (e.groups[0] === 'noge' || e.groups[0] === 'zadnjica');
const isPush = (e) => e.type === 'strength' && (e.groups[0] === 'prsa' || e.groups[0] === 'rame');
const isBack = (e) => e.type !== 'cardio' && e.groups[0] === 'hrbet';
const isCore = (e) => e.type === 'core' || (e.groups[0] === 'trup');
function state(goal, level, week, limits) {
  return { settings: { equipment: OWN, level, goal, days: 3, limits: limits || [], startDate: new Date(Date.now() - (week - 1) * 7 * 86400000 - 3600000).toISOString() }, ex: {}, log: [], customs: {} };
}
function checkSession(tag, s, need, race) {
  const ids = [];
  if (!s.blocks.length) fail(tag + ': no blocks');
  s.blocks.forEach((b) => {
    if (!b.items.length) fail(tag + ': empty block ' + b.title);
    b.items.forEach((it) => {
      ids.push(it.id);
      if (!E.available(it.id, OWN)) fail(tag + ': needs equipment – ' + it.id);
      if (!(it.cardio || it.time > 0 || it.dist > 0 || (it.reps && it.reps[0] > 0 && it.reps[1] >= it.reps[0]))) fail(tag + ': no prescription for ' + it.id);
      if (!it.cardio && !(it.sets >= 1)) fail(tag + ': no sets for ' + it.id);
      if (it.dist && ex(it.id).equip.every((k) => k === 'floor')) fail(tag + ': distance target on floor work ' + it.id);
    });
    // a superset that lost its last exercise must still rest after the round
    const last = b.items[b.items.length - 1];
    if (!race && last && !last.cardio && !last.rest && !/Warm|Cool|Stretch/.test(b.title)) fail(tag + ': no rest after ' + b.title);
  });
  if (!race) {
    const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
    if (dup.length) fail(tag + ': duplicate ' + dup.join(','));
  }
  (s.missing || []).forEach((m) => { if (E.available(m, OWN)) fail(tag + ': reported as missing but doable – ' + m); });
  const es = ids.map(ex);
  if (need.legs && !es.some(isLegs)) fail(tag + ': no legs');
  if (need.push && !es.some(isPush)) fail(tag + ': no push');
  if (need.back && !es.some(isBack)) fail(tag + ': no back/pull');
  if (need.core && !es.some(isCore)) fail(tag + ': no core');
  return ids;
}
const NEED = {
  F1: { legs: 1, push: 1, back: 1, core: 1 }, F2: { legs: 1, push: 1, back: 1, core: 1 }, F3: { legs: 1, push: 1, back: 1, core: 1 },
  L1: { legs: 1, back: 1, core: 1 }, L2: { legs: 1, core: 1 }, U1: { push: 1, back: 1, core: 1 }, U2: { push: 1, back: 1, core: 1 },
  HX1: { legs: 1 }, HX2: { legs: 1 }, HX3: { legs: 1, back: 1 }
};
let nSess = 0;
GOALS.forEach((goal) => LEVELS.forEach((lvl) => [1, 2, 3, 4].forEach((wk) => Object.keys(P.SESSIONS).forEach((key) => {
  const st = state(goal, lvl, wk), s = P.build(st, key);
  if (s.week !== wk) fail('week setup ' + wk + ' got ' + s.week);
  const ids = checkSession(key + '/' + goal + '/' + lvl + '/w' + wk, s, NEED[key] || {}, s.race || /^HX/.test(key));
  nSess++;
  if (/^[FU]/.test(key) && ids.indexOf('superman') < 0) fail(key + ': back slot should use superman');
  // swap menu: only doable exercises that are not already in the session
  const src = P.get(st, key);
  s.blocks.forEach((b) => b.items.forEach((it) => {
    const alts = P.alternatives(s, it.id, OWN);
    alts.forEach((a) => { if (!E.available(a, OWN)) fail(key + ': alternative needs equipment ' + a); if (ex(it.id).type !== 'cardio' && ids.indexOf(a) >= 0) fail(key + ': alternative already in session ' + a); });
  }));
  if (!src) fail('no source ' + key);
}))));
log('template sessions checked:', nSess);
// the 4-day split still covers everything across the week
['L1', 'U1', 'L2', 'U2'].reduce((acc, k) => acc.concat(...P.build(state('general', 'mid', 1), k).blocks.map((b) => b.items.map((i) => i.id))), []).map(ex)
  .reduce((cov, e, i, all) => { if (i === all.length - 1) { if (!all.some(isLegs) || !all.some(isPush) || !all.some(isBack) || !all.some(isCore)) fail('4-day week coverage'); } return cov; }, 0);

// joint-friendly swaps keep working with only bodyweight
['knee', 'back', 'shoulder', 'wrist'].forEach((lim) => Object.keys(P.SESSIONS).forEach((key) => {
  const s = P.build(state('general', 'mid', 1, [lim]), key);
  const tag = key + '/limit-' + lim;
  checkSession(tag, s, {}, s.race || /^HX/.test(key));
  s.blocks.forEach((b) => b.items.forEach((it) => {
    if (['jump_squat', 'burpee', 'wall_sit'].indexOf(it.id) >= 0 && lim === 'knee' && !it.caution) fail(tag + ': ' + it.id + ' with sore knees');
    if (it.id === 'pike_pushup' && lim === 'shoulder' && !it.caution) fail(tag + ': pike push-up with a sore shoulder');
    if (it.id === 'superman' && lim === 'back' && !it.caution) fail(tag + ': superman with a sore back');
  }));
}));
const bk = P.build(state('general', 'mid', 1, ['back']), 'U1');
if (!bk.blocks.some((b) => b.items.some((i) => i.id === 'prone_y_raise'))) fail('sore back: back slot should fall back to prone Y raise');

// ---------------------------------------------------------------- custom builder
const FOCI = [[], ['hrbet'], ['rame'], ['prsa', 'roke'], ['noge', 'zadnjica'], ['trup'], ['prsa', 'hrbet', 'rame', 'roke'], ['noge', 'prsa', 'hrbet', 'zadnjica', 'rame', 'trup']];
let nB = 0;
['moc', 'mix'].forEach((type) => FOCI.forEach((focus) => [20, 30, 45, 60].forEach((min) => LEVELS.forEach((lvl) => {
  const opts = { type, focus, min, owned: OWN, level: lvl };
  const src = P.generate(opts), st = state('general', lvl, 1);
  st.customs.__t = src;
  const s = P.build(st, '__t'), tag = 'builder ' + type + ' [' + focus + '] ' + min + 'min ' + lvl;
  // full body (default focus, or the app's 'Full body' card): every major pattern once there is time for it
  const full = !focus.length || focus.length >= 4;
  const need = full && min >= 30 ? { legs: 1, push: 1, back: 1, core: 1 } : {};
  const ids = checkSession(tag, s, need, false);
  if (focus.indexOf('hrbet') >= 0 && focus.length <= 4 && !ids.map(ex).some(isBack)) fail(tag + ': back focus without a back exercise');
  if (min <= 20 && full && [isLegs, isPush, isBack, isCore].filter((f) => ids.map(ex).some(f)).length < 2) fail(tag + ': 20 min full body covers too little');
  if (focus.indexOf('rame') >= 0 && ids.indexOf('pike_pushup') < 0 && min >= 30) fail(tag + ': shoulder focus without pike push-up');
  // swapping every exercise once keeps the session valid
  s.blocks.forEach((b) => b.items.forEach((it) => {
    const alts = P.alternatives(src, it.id, OWN);
    if (alts.length && !it.cardio) { P.replaceItem(src, it.id, alts[0]); }
  }));
  st.customs.__t = src;
  checkSession(tag + ' after swaps', P.build(st, '__t'), {}, false);
  nB++;
}))));
['z2', 'hiit', 'mix'].forEach((intensity) => [20, 30, 45, 60].forEach((min) => {
  const src = P.generate({ type: 'kardio', intensity, min, owned: OWN }), st = state('fatloss', 'mid', 1);
  st.customs.__c = src;
  const s = P.build(st, '__c'), tag = 'cardio ' + intensity + ' ' + min;
  checkSession(tag, s, {}, true);
  const main = s.blocks.filter((b) => !/Warm|Cool|Stretch/.test(b.title)).map((b) => b.items[0].id);
  if (main.filter((x, i) => main.indexOf(x) !== i).length) fail(tag + ': same interval movement twice ' + main);
  if (intensity !== 'z2' && main.indexOf('burpee') < 0) fail(tag + ': bodyweight intervals should include burpees');
  if (Math.abs(P.estimateMin(s) - min) > Math.max(6, min * 0.25)) fail(tag + ': length ' + P.estimateMin(s) + ' min');
  nB++;
}));
['full', 'half', 'stations'].forEach((format) => {
  const src = P.generate({ type: 'hyrox', format, owned: OWN }), st = state('hyrox', 'mid', 1);
  st.customs.__h = src;
  checkSession('race ' + format, P.build(st, '__h'), { legs: 1 }, true);
  nB++;
});
log('builder sessions checked:', nB);

// ---------------------------------------------------------------- bodyweight progression
const st = state('general', 'mid', 1);
st.ex.knee_pushup = { reps: [15, 15, 15] };
const sg = P.suggest(st, { id: 'knee_pushup', reps: [8, 15] });
if (sg.harder !== 'pushup' || !/Push-up/.test(sg.why)) fail('knee push-up should progress to push-up: ' + JSON.stringify(sg));
st.ex.glute_bridge = { reps: [12, 12, 12] };
if (P.suggest(st, { id: 'glute_bridge', reps: [8, 12] }).harder !== 'sl_glute_bridge') fail('glute bridge should progress to single-leg');
log('progression:', sg.why);

log(errs.length ? 'ERRORS:\n' + errs.slice(0, 60).join('\n') + (errs.length > 60 ? '\n… ' + errs.length + ' total' : '') : 'no errors');
