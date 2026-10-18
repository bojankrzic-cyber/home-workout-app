/*
 * Training program + progression engine.
 *
 * Model (reverse-engineered from Fitbod / Future / Peloton / Apple Fitness+ patterns):
 *  - Session rotation instead of fixed weekdays: next session = next in sequence, missed days don't break the plan.
 *  - 4-week blocks: W1–W3 progressive effort (RIR 3 → 2 → 1), W4 deload (-40 % sets, RIR 4).
 *  - Double progression per exercise: hit top of rep range on all sets → load goes up next time.
 *  - Supersets (A1/A2) of non-competing muscle groups to fit 45–60 min.
 */
(function (global) {
  'use strict';

  // item helpers: s = sets, r = [lo, hi] reps, t = seconds, rest = seconds after set / superset round
  function S(id, s, r, rest, extra) { return Object.assign({ id: id, sets: s, reps: r, rest: rest }, extra || {}); }
  function T(id, s, sec, rest, extra) { return Object.assign({ id: id, sets: s, time: sec, rest: rest }, extra || {}); }
  function C(id, min) { return { id: id, cardio: { min: min } }; }
  function I(id, rounds, work, easy) { return { id: id, cardio: { rounds: rounds, work: work, easy: easy } }; }

  var SESSIONS = {
    L1: {
      name: 'Spodnji del – moč', short: 'Noge & trup', color: '#3ec46d',
      blocks: [
        { title: 'Ogrevanje', items: [C('bike_z2', 6)] },
        { title: 'Glavni del', items: [S('kb_goblet_squat', 4, [8, 10], 120)] },
        { title: 'Superset B', items: [S('db_rdl', 3, [8, 10], 0), S('dead_bug', 3, [6, 8], 90, { perSide: true })] },
        { title: 'Superset C', items: [S('db_bulgarian', 3, [8, 10], 0), S('back_ext', 3, [12, 15], 75)] },
        { title: 'Trup', items: [S('hang_knee_raise', 3, [10, 15], 60)] },
        { title: 'Finisher', items: [I('row_hiit', 6, 30, 30)] },
        { title: 'Ohlajanje', items: [T('hip_flexor', 1, 40, 10), T('hamstring_bench', 1, 40, 10)] }
      ]
    },
    U1: {
      name: 'Zgornji del – potisk & poteg', short: 'Prsa, hrbet, roke', color: '#5ad1b8',
      blocks: [
        { title: 'Ogrevanje', items: [C('row_steady', 5)] },
        { title: 'Superset A', items: [S('db_bench', 4, [6, 10], 0), S('pullup', 4, [4, 8], 120)] },
        { title: 'Superset B', items: [S('db_row', 3, [8, 12], 0), S('db_shoulder_press', 3, [8, 12], 90)] },
        { title: 'Triset C', items: [S('k_face_pull', 3, [12, 15], 0), S('db_curl', 3, [10, 12], 0), S('k_pushdown', 3, [10, 12], 60)] },
        { title: 'Trup', items: [T('plank', 3, 40, 45)] },
        { title: 'Ohlajanje', items: [T('dead_hang', 2, 30, 30)] }
      ]
    },
    L2: {
      name: 'Zadnja veriga & kondicija', short: 'Zadnjica, hrbet, srce', color: '#f08a5d',
      blocks: [
        { title: 'Ogrevanje', items: [C('bike_z2', 6)] },
        { title: 'Moč', items: [S('kb_swing', 6, [15, 15], 45)] },
        { title: 'Superset B', items: [S('db_hip_thrust', 4, [8, 12], 0), S('situp', 3, [10, 15], 90)] },
        { title: 'Superset C', items: [S('db_stepup', 3, [8, 10], 0), S('k_pullthrough', 3, [12, 15], 75)] },
        { title: 'Trup', items: [S('hang_leg_raise', 3, [6, 10], 60)] },
        { title: 'Finisher', items: [I('bike_hiit', 8, 20, 40)] },
        { title: 'Ohlajanje', items: [T('hamstring_bench', 1, 40, 10), T('hip_flexor', 1, 40, 10)] }
      ]
    },
    U2: {
      name: 'Zgornji del – volumen & trup', short: 'Kinesis, rame, trup', color: '#b6c99b',
      blocks: [
        { title: 'Ogrevanje', items: [C('row_steady', 5)] },
        { title: 'Superset A', items: [S('db_incline', 4, [8, 12], 0), S('k_pulldown', 4, [10, 12], 90)] },
        { title: 'Superset B', items: [S('k_chest_press', 3, [10, 12], 0), S('k_row', 3, [10, 12], 75)] },
        { title: 'Superset C', items: [S('kb_press', 3, [6, 10], 0), S('k_woodchop', 3, [10, 12], 60)] },
        { title: 'Zaključek', items: [S('pushup', 2, [8, 20], 60), S('bird_dog', 2, [6, 8], 30, { perSide: true })] },
        { title: 'Finisher', items: [I('row_hiit', 5, 60, 60)] },
        { title: 'Ohlajanje', items: [T('dead_hang', 1, 30, 10)] }
      ]
    },
    F1: {
      name: 'Celo telo A – počep & potisk', short: 'Celo telo', color: '#3ec46d',
      blocks: [
        { title: 'Ogrevanje', items: [C('bike_z2', 6)] },
        { title: 'Glavni del', items: [S('kb_goblet_squat', 4, [8, 10], 120)] },
        { title: 'Superset B', items: [S('db_bench', 3, [8, 10], 0), S('db_row', 3, [8, 12], 90)] },
        { title: 'Superset C', items: [S('db_rdl', 3, [8, 10], 0), S('k_face_pull', 3, [12, 15], 75)] },
        { title: 'Trup', items: [S('hang_knee_raise', 3, [10, 15], 60)] },
        { title: 'Finisher', items: [I('row_hiit', 6, 30, 30)] },
        { title: 'Ohlajanje', items: [T('hip_flexor', 1, 40, 10), T('hamstring_bench', 1, 40, 10)] }
      ]
    },
    F2: {
      name: 'Celo telo B – zgib & poteg', short: 'Celo telo', color: '#5ad1b8',
      blocks: [
        { title: 'Ogrevanje', items: [C('row_steady', 5)] },
        { title: 'Moč', items: [S('kb_swing', 5, [15, 15], 45)] },
        { title: 'Superset B', items: [S('db_incline', 3, [8, 12], 0), S('pullup', 3, [4, 8], 120)] },
        { title: 'Superset C', items: [S('db_bulgarian', 3, [8, 10], 0), S('back_ext', 3, [12, 15], 75)] },
        { title: 'Roke', items: [S('db_curl', 2, [10, 12], 0), S('k_pushdown', 2, [10, 12], 60)] },
        { title: 'Trup', items: [T('plank', 2, 45, 45)] },
        { title: 'Finisher', items: [I('bike_hiit', 8, 20, 40)] }
      ]
    },
    F3: {
      name: 'Celo telo C – zadnjica & Kinesis', short: 'Celo telo', color: '#f08a5d',
      blocks: [
        { title: 'Ogrevanje', items: [C('bike_z2', 6)] },
        { title: 'Superset A', items: [S('db_hip_thrust', 4, [8, 12], 0), S('k_pulldown', 4, [10, 12], 90)] },
        { title: 'Superset B', items: [S('db_stepup', 3, [8, 10], 0), S('k_chest_press', 3, [10, 12], 75)] },
        { title: 'Superset C', items: [S('kb_press', 3, [6, 10], 0), S('k_woodchop', 3, [10, 12], 60)] },
        { title: 'Trup', items: [S('hang_leg_raise', 3, [6, 10], 45), S('dead_bug', 2, [6, 8], 30, { perSide: true })] },
        { title: 'Kondicija', items: [C('row_steady', 8)] },
        { title: 'Ohlajanje', items: [T('hamstring_bench', 1, 40, 10)] }
      ]
    }
  };

  // ---------------------------------------------------------------- HYROX (home substitutes, race format)
  function D(id, m) { return { id: id, dist: m }; }
  function hxRun(n, min) { return { title: 'Tek ' + n + ' (kolo)', items: [C('hx_bike_run', min)] }; }
  function hxSt(n, name, item) { return { title: 'Postaja ' + n + ' · ' + name, items: [item] }; }
  var HX_STATIONS = [
    ['SkiErg', T('k_ski', 1, 240, 0)],
    ['Sled push', T('bike_sled', 1, 150, 0)],
    ['Sled pull', T('k_sled_pull', 1, 150, 0)],
    ['Burpee broad jumps', S('burpee_bj', 1, [25, 25], 0)],
    ['Veslanje 1000 m', D('row_steady', 1000)],
    ['Farmers carry', T('kb_farmers', 1, 150, 0)],
    ['Sandbag lunges', S('kb_lunge', 1, [50, 50], 0)],
    ['Wall balls', S('db_thruster', 1, [50, 50], 0)]
  ];
  function hxRace(stations, runMin) {
    var b = [{ title: 'Ogrevanje', items: [C('bike_z2', 6)] }];
    stations.forEach(function (st, i) { b.push(hxRun(i + 1, runMin)); b.push(hxSt(i + 1, st[0], JSON.parse(JSON.stringify(st[1])))); });
    b.push({ title: 'Ohlajanje', items: [C('row_steady', 4)] });
    b.push({ title: 'Raztezanje', items: [T('hip_flexor', 1, 40, 10)] });
    return b;
  }
  SESSIONS.HX1 = { name: 'HYROX simulacija – celotna', short: '8 × (tek + postaja) · na čas', color: '#fcb900', race: true, blocks: hxRace(HX_STATIONS, 4) };
  SESSIONS.HX2 = {
    name: 'HYROX simulacija – polovica', short: '4 × (tek + postaja) · na čas', color: '#fcb900', race: true,
    blocks: hxRace([
      ['SkiErg', T('k_ski', 1, 150, 0)], ['Sled push', T('bike_sled', 1, 90, 0)],
      ['Burpee broad jumps', S('burpee_bj', 1, [15, 15], 0)], ['Wall balls', S('db_thruster', 1, [30, 30], 0)]
    ], 3)
  };
  SESSIONS.HX3 = {
    name: 'HYROX postaje – moč & tehnika', short: '3 krogi vseh postaj', color: '#fcb900',
    blocks: [
      { title: 'Ogrevanje', items: [C('row_steady', 5)] },
      { title: 'Krog postaj', items: [T('k_ski', 3, 60, 0), T('k_sled_pull', 3, 60, 0), S('kb_lunge', 3, [20, 20], 0), S('db_thruster', 3, [20, 20], 0), T('kb_farmers', 3, 60, 0), S('burpee_bj', 3, [10, 10], 120)] },
      { title: 'Kompromitiran tek', items: [I('hx_bike_run', 4, 60, 30)] },
      { title: 'Ohlajanje', items: [C('bike_z2', 3)] },
      { title: 'Raztezanje', items: [T('hamstring_bench', 1, 40, 10)] }
    ]
  };
  // adv = official HYROX volumes; lower levels scale down (weights scale via progression)
  var HX_SCALE = { beg: 0.6, mid: 0.8, adv: 1 };

  var PLANS = {
    4: { name: '4× tedensko – Upper / Lower', order: ['L1', 'U1', 'L2', 'U2'], days: [1, 2, 4, 5] },
    3: { name: '3× tedensko – Celo telo', order: ['F1', 'F2', 'F3'], days: [1, 3, 5] }
  };

  var WEEK_INFO = {
    1: { label: 'Teden 1 – Uvajanje', rir: 3, note: 'Pusti 3 ponovitve v rezervi. Tehnika pred težo.' },
    2: { label: 'Teden 2 – Gradnja', rir: 2, note: '2 ponovitvi v rezervi. Dodaj težo, kjer si dosegel zgornjo mejo.' },
    3: { label: 'Teden 3 – Vrh', rir: 1, note: '1 ponovitev v rezervi. Najtežji teden bloka.' },
    4: { label: 'Teden 4 – Razbremenitev', rir: 4, note: 'Manj serij, lažje. Telo se prilagodi – ne preskoči.' }
  };

  function blockWeek(state) {
    var start = state.settings.startDate ? new Date(state.settings.startDate) : new Date();
    var days = Math.floor((Date.now() - start.getTime()) / 86400000);
    return (Math.floor(Math.max(0, days) / 7) % 4) + 1;
  }

  function nextSessionKey(state) {
    var plan = PLANS[state.settings.days];
    var done = state.log.filter(function (l) { return plan.order.indexOf(l.session) >= 0; });
    if (!done.length) return plan.order[0];
    var last = done[done.length - 1].session;
    return plan.order[(plan.order.indexOf(last) + 1) % plan.order.length];
  }

  function round(x, step) { return Math.round(x / step) * step; }

  // Suggested load + reps for next exposure of an exercise (double progression)
  function suggest(state, item) {
    var ex = Exercises.BY_ID[item.id];
    var h = state.ex[item.id];
    var lo = item.reps ? item.reps[0] : 0, hi = item.reps ? item.reps[1] : 0;
    var load = h && h.load !== undefined ? h.load : (ex.load || 0);
    if (state.settings.level === 'beg' && !h && ex.unit !== 'bw') load = ex.unit === 'stopnja' ? Math.max(1, load - 2) : Math.max(0, load * 0.75);
    var reps = lo;
    var why = h ? '' : 'Začetna ocena – prilagodi po prvi seriji';
    if (h && h.reps && h.reps.length) {
      var allTop = h.reps.every(function (r) { return r >= hi; });
      var anyLow = h.reps.some(function (r) { return r < lo; });
      if (allTop) {
        if (ex.unit === 'bw' || !ex.inc) { reps = hi; why = 'Vse serije na vrhu – upočasni spust na 3–4 s ali dodaj težo (nahrbtnik/KB)'; }
        else { load = load + ex.inc; reps = lo; why = '↑ Napredek: +' + ex.inc + ' ' + incLabel(ex.unit) + ' (vse serije na ' + hi + ')'; }
      } else if (anyLow) {
        reps = lo; why = h.fails >= 1 && ex.inc ? '↓ Zmanjšaj za ' + ex.inc + ' ' + incLabel(ex.unit) : 'Ostani na isti teži – cilj ' + lo + '+';
        if (h.fails >= 1 && ex.inc) load = Math.max(0, load - ex.inc);
      } else {
        reps = Math.min(hi, Math.max.apply(null, h.reps) + 1);
        why = 'Ista teža – dodaj 1 ponovitev';
      }
    }
    if (ex.unit === 'kg') load = round(load, ex.inc >= 2 ? (ex.id.indexOf('kb_') === 0 ? 4 : 1) : 0.5);
    return { load: load, reps: reps, why: why };
  }

  function incLabel(u) { return u === 'stopnja' ? 'stopnjo' : unitLabel(u); }
  function unitLabel(u) { return { kg: 'kg', stopnja: 'stopnje', bw: '', min: 'min', s: 's' }[u] || ''; }

  // Build the concrete session for the current block week + level
  function get(state, key) { return SESSIONS[key] || (state.customs || {})[key] || null; }

  function owned(state) { return (state.settings && state.settings.equipment) || Exercises.HOME_GYM; }

  // Real HYROX stations replace home substitutes when the profile owns the equipment
  var STATION = { treadmill_run: { dist: 1000 }, skierg: { dist: 1000 }, sled_push: { dist: 50 }, sled_pull: { dist: 50 }, wall_ball: { reps: [100, 100] } };

  // Swap every exercise the profile cannot do for the best owned alternative (same movement pattern).
  function adapt(src, own, upgrade) {
    var used = {}, missing = [];
    var blocks = src.blocks.map(function (b) {
      var items = [];
      b.items.forEach(function (it) {
        var id = it.id, pick;
        if (upgrade) {
          var list = Exercises.PATTERNS[Exercises.PATTERN_OF[id]] || [id];
          // race stations repeat (8 runs), so reuse is allowed here
          pick = list.filter(function (x) { return Exercises.available(x, own); })[0] || null;
          if (!pick && Exercises.available(id, own)) pick = id;
        } else {
          pick = Exercises.substitute(id, own, Object.keys(used).filter(function (x) { return x !== id; }));
        }
        if (!pick) { missing.push(id); return; }
        var o = JSON.parse(JSON.stringify(it));
        if (pick !== id) {
          o.id = pick; o.swappedFrom = id;
          var conv = upgrade && src.race && STATION[pick];
          if (conv) { delete o.time; delete o.cardio; o.sets = 1; o.rest = it.rest || 0; if (conv.dist) { delete o.reps; o.dist = conv.dist; } else o.reps = conv.reps.slice(); }
          else if (!o.cardio && !o.time && !o.dist && Exercises.BY_ID[pick].type === 'cardio' && Exercises.BY_ID[pick].unit !== 'kg' && Exercises.BY_ID[pick].unit !== 'bw') {
            // a rep-based slot became a timed cardio movement
            o.time = 45; delete o.reps;
          } else if (o.cardio && o.cardio.rounds && /^bike_hiit|^row_hiit/.test(pick)) {
            o.cardio.work = pick === 'bike_hiit' ? 20 : 30; o.cardio.easy = pick === 'bike_hiit' ? 40 : 30;
          }
          if (o.reps && !o.dist && Exercises.BY_ID[pick].unit === 's') { o.time = 40; delete o.reps; }
        }
        used[pick] = 1;
        items.push(o);
      });
      return { title: b.title, items: items };
    }).filter(function (b) { return b.items.length; });
    return { blocks: blocks, missing: missing };
  }

  function build(state, key) {
    var src = get(state, key);
    if (!src) { key = nextSessionKey(state); src = SESSIONS[key]; }
    var week = blockWeek(state);
    var lvl = state.settings.level;
    var ad = adapt(src, owned(state), src.race || /^HX/.test(key) || (src.opts && src.opts.type === 'hyrox'));
    var blocks = ad.blocks.map(function (b) {
      return {
        title: b.title,
        items: b.items.map(function (it) {
          var o = JSON.parse(JSON.stringify(it));
          if (o.sets && !src.race) {
            if (lvl === 'beg') o.sets = Math.max(Math.min(2, o.sets), o.sets - 1);
            if (lvl === 'adv' && /Glavni|Superset A|Moč/.test(b.title)) o.sets += 1;
            if (week === 4) o.sets = Math.max(1, Math.ceil(o.sets * 0.6));
          }
          if (o.cardio && o.cardio.rounds) {
            if (lvl === 'beg') o.cardio.rounds = Math.max(3, o.cardio.rounds - 2);
            if (week === 4) o.cardio.rounds = Math.max(3, Math.ceil(o.cardio.rounds * 0.6));
          }
          if (src.race) {
            var k = HX_SCALE[lvl] || 1;
            if (o.reps) { var n = Math.max(5, Math.round(o.reps[0] * k / 5) * 5); o.reps = [n, n]; }
            if (o.time) o.time = Math.round(o.time * k / 10) * 10;
            if (o.cardio && o.cardio.min && /^Tek/.test(b.title)) o.cardio.min = Math.max(2, Math.round(o.cardio.min * k));
            if (o.dist) { var stp = o.dist >= 500 ? 100 : 10; o.dist = Math.max(stp, Math.round(o.dist * k / stp) * stp); }
          }
          if (o.reps) o.sug = suggest(state, o);
          return o;
        })
      };
    });
    return { key: key, name: src.name, short: src.short, color: src.color, custom: !!src.custom, race: !!src.race, missing: ad.missing, week: week, weekInfo: WEEK_INFO[week], blocks: blocks };
  }

  // Flatten to an ordered list of steps (supersets interleaved by round)
  function steps(session) {
    var out = [];
    session.blocks.forEach(function (b, bi) {
      var items = b.items;
      if (items.length === 1 && items[0].cardio) {
        var it = items[0], c = it.cardio;
        if (c.min) out.push({ kind: 'time', id: it.id, item: it, block: b.title, sec: c.min * 60, set: 1, sets: 1, rest: 0, label: c.min + ' min enakomerno' });
        else for (var r = 1; r <= c.rounds; r++) {
          out.push({ kind: 'time', id: it.id, item: it, block: b.title, sec: c.work, set: r, sets: c.rounds, rest: 0, label: 'MOČNO ' + c.work + ' s', hard: true });
          out.push({ kind: 'time', id: it.id, item: it, block: b.title, sec: c.easy, set: r, sets: c.rounds, rest: 0, label: 'Lahkotno ' + c.easy + ' s', easy: true });
        }
        return;
      }
      var maxSets = Math.max.apply(null, items.map(function (i) { return i.sets || 1; }));
      for (var s = 1; s <= maxSets; s++) {
        items.forEach(function (it, ii) {
          if ((it.sets || 1) < s) return;
          var last = ii === items.length - 1 || items.slice(ii + 1).every(function (n) { return (n.sets || 1) < s; });
          var restAfter = last ? (it.rest || 0) : (items.length > 1 ? 15 : it.rest);
          var ex = Exercises.BY_ID[it.id];
          var gl = groupLetter(b.title, bi);
          var lbl = items.length > 1 && gl ? gl + (ii + 1) : '';
          var perSide = it.perSide || ex.perSide;
          if (it.dist) {
            out.push({ kind: 'dist', id: it.id, item: it, block: b.title, dist: it.dist, set: s, sets: it.sets || 1, rest: restAfter, tag: lbl, label: it.dist + ' m' });
          } else if (it.cardio) {
            out.push({ kind: 'time', id: it.id, item: it, block: b.title, sec: (it.cardio.min || 1) * 60, set: 1, sets: 1, rest: restAfter, label: (it.cardio.min || 1) + ' min' });
          } else if (it.time) {
            out.push({ kind: 'time', id: it.id, item: it, block: b.title, sec: perSide ? it.time * 2 : it.time, set: s, sets: it.sets, rest: restAfter, tag: lbl, label: it.time + ' s' + (perSide ? ' / stran' : '') });
          } else {
            out.push({ kind: 'reps', id: it.id, item: it, block: b.title, set: s, sets: it.sets, rest: restAfter, tag: lbl, perSide: perSide });
          }
        });
      }
    });
    return out;
  }

  // "Superset B" -> "B"; otherwise derive from block position
  function groupLetter(title, bi) {
    var mm = /(Superset|Triset)\s+([A-Z])/.exec(title);
    return mm ? mm[2] : '';
  }

  function estimateMin(session) {
    var sec = 0;
    steps(session).forEach(function (st) {
      if (st.kind === 'time') sec += st.sec + st.rest + (st.easy || st.hard ? 0 : 8);
      else if (st.kind === 'dist') sec += st.dist * (Exercises.BY_ID[st.id].secPerM || 0.27) + st.rest + 10;
      else sec += (st.item.reps[1] * (Exercises.BY_ID[st.id].secPerRep || 4) * (st.perSide ? 2 : 1)) + st.rest + 10;
    });
    return Math.round(sec / 60);
  }


  // ===================================================================== custom session builder
  // Default prescription per exercise: first use in a template session, else by type.
  var PRESET = {};
  Object.keys(SESSIONS).forEach(function (k) {
    if (/^HX/.test(k)) return;
    SESSIONS[k].blocks.forEach(function (b) {
      b.items.forEach(function (it) { if (!PRESET[it.id] && !it.cardio) PRESET[it.id] = it; });
    });
  });
  function prescribe(id, sets) {
    var e = Exercises.BY_ID[id], base = PRESET[id];
    var o = base ? JSON.parse(JSON.stringify(base)) : (e.unit === 's' ? T(id, 2, 40, 45) : S(id, 3, e.compound ? [8, 10] : [10, 12], 60));
    if (o.sets && sets) o.sets = sets;
    delete o.rest;
    return o;
  }

  var LOWER = ['noge', 'zadnjica'];

  // opts = { type: 'moc'|'kardio'|'mix', focus: [group..], min: 20..60, machine: 'bike'|'rower'|'both', intensity: 'z2'|'hiit'|'mix', exclude: [id] }
  function generate(opts) {
    var min = opts.min || 45;
    var focus = (opts.focus && opts.focus.length) ? opts.focus : ['noge', 'zadnjica', 'prsa', 'hrbet', 'rame', 'trup'];
    var lower = focus.some(function (f) { return LOWER.indexOf(f) >= 0; });
    if (opts.type === 'kardio') return cardioSession(opts, min);
    if (opts.type === 'hyrox') {
      var key = { full: 'HX1', half: 'HX2', stations: 'HX3' }[opts.format || 'half'];
      var copy = JSON.parse(JSON.stringify(SESSIONS[key]));
      copy.custom = true; copy.opts = opts;
      return copy;
    }

    var cardioMin = opts.type === 'mix' ? Math.max(6, Math.round(min * 0.3)) : 0;
    var head = [{ title: 'Ogrevanje', items: [C(lower ? 'bike_z2' : 'row_steady', min <= 30 ? 4 : 5)] }];
    var tail = [];
    if (cardioMin) tail.push({ title: 'Kardio', items: [lower ? I('bike_hiit', cardioMin, 20, 40) : I('row_hiit', cardioMin, 30, 30)] });
    tail.push({ title: 'Ohlajanje', items: lower ? [T('hip_flexor', 1, 40, 10), T('hamstring_bench', 1, 40, 10)] : [T('dead_hang', 1, 30, 10)] });

    // add exercises in priority order while the estimated session still fits the chosen duration
    var order = strengthOrder(focus, opts.exclude || [], opts.owned || Exercises.HOME_GYM);
    var sets = min <= 30 ? 2 : 3;
    // beginners get one set less in build(), so budget with the sets they will actually do
    var realSets = opts.level === 'beg' ? Math.max(2, sets - 1) : opts.level === 'adv' ? sets + 1 : sets;
    var best = null;
    for (var n = 1; n <= order.length; n++) {
      var items = sortForSession(order.slice(0, n).map(function (id) { return prescribe(id, sets); }));
      var cand = { blocks: head.concat(groupBlocks(items), tail) };
      var probe = { blocks: head.concat(groupBlocks(items.map(function (it) { return Object.assign({}, it, { sets: realSets }); })), tail) };
      if (best && estimateMin(probe) > min + 1) break;
      best = cand;
    }
    return {
      name: (opts.type === 'mix' ? 'Moč + kardio: ' : 'Moč: ') + focus.map(function (f) { return Exercises.FOCUS[f].name; }).join(', '),
      short: min + ' min · po meri', color: '#f08a5d', custom: true, opts: opts, blocks: best.blocks
    };
  }

  // Round-robin over the chosen focus groups: exercises whose primary group matches first, compound before isolation.
  function strengthOrder(focus, exclude, own) {
    var pool = Exercises.LIST.filter(function (e) {
      return (e.type === 'strength' || e.type === 'core') && e.groups[0] !== 'kardio' && exclude.indexOf(e.id) < 0 && Exercises.available(e.id, own);
    });
    function rank(e, f) {
      var pos = e.groups.indexOf(f);
      var pl = Exercises.PATTERNS[Exercises.PATTERN_OF[e.id]] || [];
      // tie-breaks: main lifts first (COMPOUND is ordered barbell → KB/DB → bodyweight), then pattern preference
      var ci = Exercises.COMPOUND.indexOf(e.id);
      var pref = (pl.indexOf(e.id) < 0 ? 0.5 : pl.indexOf(e.id) * 0.1) + (ci < 0 ? 0.3 : ci * 0.01);
      return (pos === 0 ? 0 : 10 + pos) + (e.compound ? 0 : 3) + (e.type === 'core' && f !== 'trup' ? 20 : 0) + pref;
    }
    var order = [], used = {};
    for (var round = 0; round < 12; round++) {
      var added = false;
      focus.forEach(function (f) {
        var c = pool.filter(function (e) { return !used[e.id] && e.groups.indexOf(f) >= 0; })
          .sort(function (a, b) { return rank(a, f) - rank(b, f); })[0];
        if (c) { used[c.id] = 1; order.push(c.id); added = true; }
      });
      if (!added) break;
    }
    return order;
  }

  // keep priority order, but core work goes to the end of the session
  function sortForSession(items) {
    var core = items.filter(function (it) { return Exercises.BY_ID[it.id].type === 'core'; });
    return items.filter(function (it) { return Exercises.BY_ID[it.id].type !== 'core'; }).concat(core);
  }

  // Pair neighbours into supersets when they train different primary groups.
  function groupBlocks(items) {
    var out = [], i = 0, letter = 0;
    items = items.map(function (it) { return Object.assign({}, it); });
    while (i < items.length) {
      var a = items[i], b = items[i + 1];
      var ea = Exercises.BY_ID[a.id], eb = b && Exercises.BY_ID[b.id];
      var heavyPair = b && ea.equip.indexOf('barbell') >= 0 && eb.equip.indexOf('barbell') >= 0; // two barbell lifts never share a superset
      if (b && ea.groups[0] !== eb.groups[0] && !heavyPair) {
        var name = 'Superset ' + String.fromCharCode(65 + letter++);
        a.rest = 0; b.rest = ea.compound || eb.compound ? 90 : 60;
        out.push({ title: name, items: [a, b] }); i += 2;
      } else {
        a.rest = ea.compound ? 120 : 60;
        out.push({ title: ea.type === 'core' ? 'Trup' : ea.compound ? 'Glavna vaja' : 'Dodatna vaja', items: [a] }); i += 1;
      }
    }
    return out;
  }

  var MACHINES = {
    bike: { z2: 'bike_z2', hiit: 'bike_hiit', work: 20, easy: 40, name: 'kolo' },
    rower: { z2: 'row_steady', hiit: 'row_hiit', work: 30, easy: 30, name: 'veslač' },
    treadmill: { z2: 'treadmill_run', hiit: 'treadmill_run', work: 30, easy: 60, name: 'tekalna steza' },
    skierg: { z2: 'skierg', hiit: 'skierg', work: 30, easy: 30, name: 'SkiErg' },
    rope: { z2: 'jump_rope', hiit: 'jump_rope', work: 40, easy: 20, name: 'kolebnica' },
    floor: { z2: 'high_knees', hiit: 'high_knees', work: 30, easy: 30, name: 'lastna teža' }
  };
  function cardioMachines(own) {
    var m = ['bike', 'rower', 'treadmill', 'skierg', 'rope'].filter(function (k) { return own.indexOf(k) >= 0; });
    return m.length ? m : ['floor'];
  }

  function cardioSession(opts, min) {
    var own = opts.owned || Exercises.HOME_GYM;
    var avail = cardioMachines(own);
    var machines = opts.machine && opts.machine !== 'all' && avail.indexOf(opts.machine) >= 0 ? [opts.machine] : avail.slice(0, 2);
    var inten = opts.intensity || 'mix';
    var blocks = [{ title: 'Ogrevanje', items: [C(MACHINES[machines[0]].z2, 5)] }];
    var main = Math.max(6, min - 9);
    var per = Math.round(main / machines.length);
    machines.forEach(function (mc) {
      var M = MACHINES[mc];
      var label = machines.length > 1 ? ' – ' + M.name : '';
      var rounds = Math.max(3, Math.round(per * 60 / (M.work + M.easy)));
      if (inten === 'z2') blocks.push({ title: 'Cona 2' + label, items: [C(M.z2, per)] });
      else if (inten === 'hiit') blocks.push({ title: 'Intervali' + label, items: [I(M.hiit, rounds, M.work, M.easy)] });
      else {
        var half = Math.max(3, Math.round(per / 2));
        blocks.push({ title: 'Cona 2' + label, items: [C(M.z2, half)] });
        blocks.push({ title: 'Intervali' + label, items: [I(M.hiit, Math.max(3, Math.round((per - half) * 60 / (M.work + M.easy))), M.work, M.easy)] });
      }
    });
    blocks.push({ title: 'Ohlajanje', items: [C(MACHINES[machines[machines.length - 1]].z2, 3)] });
    blocks.push({ title: 'Raztezanje', items: [T('hamstring_bench', 1, 40, 10)] });
    var iName = { z2: 'cona 2', hiit: 'intervali', mix: 'cona 2 + intervali' }[inten];
    return { name: 'Kardio: ' + machines.map(function (k) { return MACHINES[k].name; }).join(' + ') + ' – ' + iName, short: min + ' min · po meri', color: '#5ad1b8', custom: true, opts: opts, blocks: blocks };
  }

  // Exercises that can replace `id` (share its primary group, same kind), excluding ones already in the session
  var CARDIO_TWIN = { bike_z2: 'row_steady', row_steady: 'bike_z2', bike_hiit: 'row_hiit', row_hiit: 'bike_hiit' };
  function alternatives(src, id, own) {
    own = own || Exercises.HOME_GYM;
    var e = Exercises.BY_ID[id];
    if (Exercises.BY_ID[id].type === 'cardio' && Exercises.PATTERN_OF[id]) {
      return (Exercises.PATTERNS[Exercises.PATTERN_OF[id]] || []).filter(function (x) { return x !== id && Exercises.available(x, own); });
    }
    var inUse = {};
    src.blocks.forEach(function (b) { b.items.forEach(function (it) { inUse[it.id] = 1; }); });
    return Exercises.LIST.filter(function (x) {
      return !inUse[x.id] && x.groups[0] === e.groups[0] && (x.type === 'cardio') === (e.type === 'cardio') && x.type !== 'mobility' && Exercises.available(x.id, own);
    }).map(function (x) { return x.id; });
  }

  function replaceItem(src, id, newId) {
    src.blocks.forEach(function (b) {
      b.items = b.items.map(function (it) {
        if (it.id !== id) return it;
        if (it.cardio) {
          var c = JSON.parse(JSON.stringify(it)); c.id = newId;
          if (c.cardio.rounds) { c.cardio.work = newId === 'bike_hiit' ? 20 : 30; c.cardio.easy = newId === 'bike_hiit' ? 40 : 30; }
          return c;
        }
        var n = prescribe(newId, it.sets);
        n.rest = it.rest;
        if (n.perSide === undefined && it.perSide && !Exercises.BY_ID[newId].perSide) delete n.perSide;
        return n;
      });
    });
  }

  function removeItem(src, id) {
    src.blocks.forEach(function (b) { b.items = b.items.filter(function (it) { return it.id !== id; }); });
    src.blocks = src.blocks.filter(function (b) { return b.items.length; });
    // a superset reduced to one exercise needs its own rest
    src.blocks.forEach(function (b) { if (b.items.length === 1 && !b.items[0].cardio && !b.items[0].rest) b.items[0].rest = 90; });
  }

  // Single exercise session from the library
  function single(id) {
    var e = Exercises.BY_ID[id];
    var it = e.type === 'cardio' ? (e.id.indexOf('hiit') > 0 ? I(id, 8, e.id === 'bike_hiit' ? 20 : 30, e.id === 'bike_hiit' ? 40 : 30) : C(id, 10)) : prescribe(id, 3);
    if (!it.cardio) it.rest = it.time ? 30 : 90;
    return { name: e.name, short: 'Posamezna vaja', color: '#3ec46d', custom: true, blocks: [{ title: 'Vaja', items: [it] }] };
  }

  global.Program = {
    SESSIONS: SESSIONS, PLANS: PLANS, WEEK_INFO: WEEK_INFO,
    HX_KEYS: ['HX1', 'HX2', 'HX3'],
    MACHINES: MACHINES, cardioMachines: cardioMachines, owned: owned,
    get: get, build: build, steps: steps, generate: generate, alternatives: alternatives,
    replaceItem: replaceItem, removeItem: removeItem, single: single, nextSessionKey: nextSessionKey, blockWeek: blockWeek,
    suggest: suggest, estimateMin: estimateMin, unitLabel: unitLabel, groupLetter: groupLetter
  };
})(window);
