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
      name: 'Spodnji del – moč', short: 'Noge & trup', color: '#c6ff3d',
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
      name: 'Zgornji del – potisk & poteg', short: 'Prsa, hrbet, roke', color: '#38e1ff',
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
      name: 'Zadnja veriga & kondicija', short: 'Zadnjica, hrbet, srce', color: '#ffb547',
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
      name: 'Zgornji del – volumen & trup', short: 'Kinesis, rame, trup', color: '#b48cff',
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
      name: 'Celo telo A – počep & potisk', short: 'Celo telo', color: '#c6ff3d',
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
      name: 'Celo telo B – zgib & poteg', short: 'Celo telo', color: '#38e1ff',
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
      name: 'Celo telo C – zadnjica & Kinesis', short: 'Celo telo', color: '#ffb547',
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
  function build(state, key) {
    var src = SESSIONS[key];
    var week = blockWeek(state);
    var lvl = state.settings.level;
    var blocks = src.blocks.map(function (b) {
      return {
        title: b.title,
        items: b.items.map(function (it) {
          var o = JSON.parse(JSON.stringify(it));
          if (o.sets) {
            if (lvl === 'beg') o.sets = Math.max(2, o.sets - 1);
            if (lvl === 'adv' && /Glavni|Superset A|Moč/.test(b.title)) o.sets += 1;
            if (week === 4) o.sets = Math.max(1, Math.ceil(o.sets * 0.6));
          }
          if (o.cardio && o.cardio.rounds) {
            if (lvl === 'beg') o.cardio.rounds = Math.max(3, o.cardio.rounds - 2);
            if (week === 4) o.cardio.rounds = Math.max(3, Math.ceil(o.cardio.rounds * 0.6));
          }
          if (o.reps) o.sug = suggest(state, o);
          return o;
        })
      };
    });
    return { key: key, name: src.name, short: src.short, color: src.color, week: week, weekInfo: WEEK_INFO[week], blocks: blocks };
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
          var lbl = items.length > 1 ? groupLetter(b.title, bi) + (ii + 1) : '';
          var perSide = it.perSide || ex.perSide;
          if (it.time) {
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
    return mm ? mm[2] : String.fromCharCode(64 + Math.max(1, bi));
  }

  function estimateMin(session) {
    var sec = 0;
    steps(session).forEach(function (st) {
      if (st.kind === 'time') sec += st.sec + st.rest + (st.easy || st.hard ? 0 : 8);
      else sec += (st.item.reps[1] * 4 * (st.perSide ? 2 : 1)) + st.rest + 10;
    });
    return Math.round(sec / 60);
  }

  global.Program = {
    SESSIONS: SESSIONS, PLANS: PLANS, WEEK_INFO: WEEK_INFO,
    build: build, steps: steps, nextSessionKey: nextSessionKey, blockWeek: blockWeek,
    suggest: suggest, estimateMin: estimateMin, unitLabel: unitLabel, groupLetter: groupLetter
  };
})(window);
