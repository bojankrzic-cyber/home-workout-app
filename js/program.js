/*
 * Training program + progression engine.
 *
 * Model (reverse-engineered from Fitbod / Future / premium apps / Apple Fitness+ patterns):
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
      name: 'Lower Body – Strength', short: 'Legs & core', color: '#3ec46d',
      blocks: [
        { title: 'Warm-up', items: [C('bike_z2', 6)] },
        { title: 'Main Lift', items: [S('kb_goblet_squat', 4, [8, 10], 120)] },
        { title: 'Superset B', items: [S('db_rdl', 3, [8, 10], 0), S('dead_bug', 3, [6, 8], 90, { perSide: true })] },
        { title: 'Superset C', items: [S('db_bulgarian', 3, [8, 10], 0), S('back_ext', 3, [12, 15], 75)] },
        { title: 'Core', items: [S('hang_knee_raise', 3, [10, 15], 60)] },
        { title: 'Finisher', items: [I('row_hiit', 6, 30, 30)] },
        { title: 'Cooldown', items: [T('hip_flexor', 1, 40, 10), T('hamstring_bench', 1, 40, 10)] }
      ]
    },
    U1: {
      name: 'Upper Body – Push & Pull', short: 'Chest, back, arms', color: '#5ad1b8',
      blocks: [
        { title: 'Warm-up', items: [C('row_steady', 5)] },
        { title: 'Superset A', items: [S('db_bench', 4, [6, 10], 0), S('pullup', 4, [4, 8], 120)] },
        { title: 'Superset B', items: [S('db_row', 3, [8, 12], 0), S('db_shoulder_press', 3, [8, 12], 90)] },
        { title: 'Triset C', items: [S('k_face_pull', 3, [12, 15], 0), S('db_curl', 3, [10, 12], 0), S('k_pushdown', 3, [10, 12], 60)] },
        { title: 'Core', items: [T('plank', 3, 40, 45)] },
        { title: 'Cooldown', items: [T('dead_hang', 2, 30, 30)] }
      ]
    },
    L2: {
      name: 'Posterior Chain & Conditioning', short: 'Glutes, back, cardio', color: '#f08a5d',
      blocks: [
        { title: 'Warm-up', items: [C('bike_z2', 6)] },
        { title: 'Strength', items: [S('kb_swing', 6, [15, 15], 45)] },
        { title: 'Superset B', items: [S('db_hip_thrust', 4, [8, 12], 0), S('situp', 3, [10, 15], 90)] },
        { title: 'Superset C', items: [S('db_stepup', 3, [8, 10], 0), S('k_pullthrough', 3, [12, 15], 75)] },
        { title: 'Core', items: [S('hang_leg_raise', 3, [6, 10], 60)] },
        { title: 'Finisher', items: [I('bike_hiit', 8, 20, 40)] },
        { title: 'Cooldown', items: [T('hamstring_bench', 1, 40, 10), T('hip_flexor', 1, 40, 10)] }
      ]
    },
    U2: {
      name: 'Upper Body – Volume & Core', short: 'Cables, shoulders, core', color: '#b6c99b',
      blocks: [
        { title: 'Warm-up', items: [C('row_steady', 5)] },
        { title: 'Superset A', items: [S('db_incline', 4, [8, 12], 0), S('k_pulldown', 4, [10, 12], 90)] },
        { title: 'Superset B', items: [S('k_chest_press', 3, [10, 12], 0), S('k_row', 3, [10, 12], 75)] },
        { title: 'Superset C', items: [S('kb_press', 3, [6, 10], 0), S('k_woodchop', 3, [10, 12], 60)] },
        { title: 'Wrap-up', items: [S('pushup', 2, [8, 20], 60), S('bird_dog', 2, [6, 8], 30, { perSide: true })] },
        { title: 'Finisher', items: [I('row_hiit', 5, 60, 60)] },
        { title: 'Cooldown', items: [T('dead_hang', 1, 30, 10)] }
      ]
    },
    F1: {
      name: 'Full Body A – Squat & Press', short: 'Full body', color: '#3ec46d',
      blocks: [
        { title: 'Warm-up', items: [C('bike_z2', 6)] },
        { title: 'Main Lift', items: [S('kb_goblet_squat', 4, [8, 10], 120)] },
        { title: 'Superset B', items: [S('db_bench', 3, [8, 10], 0), S('db_row', 3, [8, 12], 90)] },
        { title: 'Superset C', items: [S('db_rdl', 3, [8, 10], 0), S('k_face_pull', 3, [12, 15], 75)] },
        { title: 'Core', items: [S('hang_knee_raise', 3, [10, 15], 60)] },
        { title: 'Finisher', items: [I('row_hiit', 6, 30, 30)] },
        { title: 'Cooldown', items: [T('hip_flexor', 1, 40, 10), T('hamstring_bench', 1, 40, 10)] }
      ]
    },
    F2: {
      name: 'Full Body B – Hinge & Pull', short: 'Full body', color: '#5ad1b8',
      blocks: [
        { title: 'Warm-up', items: [C('row_steady', 5)] },
        { title: 'Strength', items: [S('kb_swing', 5, [15, 15], 45)] },
        { title: 'Superset B', items: [S('db_incline', 3, [8, 12], 0), S('pullup', 3, [4, 8], 120)] },
        { title: 'Superset C', items: [S('db_bulgarian', 3, [8, 10], 0), S('back_ext', 3, [12, 15], 75)] },
        { title: 'Arms', items: [S('db_curl', 2, [10, 12], 0), S('k_pushdown', 2, [10, 12], 60)] },
        { title: 'Core', items: [T('plank', 2, 45, 45)] },
        { title: 'Finisher', items: [I('bike_hiit', 8, 20, 40)] }
      ]
    },
    F3: {
      name: 'Full Body C – Glutes & Cables', short: 'Full body', color: '#f08a5d',
      blocks: [
        { title: 'Warm-up', items: [C('bike_z2', 6)] },
        { title: 'Superset A', items: [S('db_hip_thrust', 4, [8, 12], 0), S('k_pulldown', 4, [10, 12], 90)] },
        { title: 'Superset B', items: [S('db_stepup', 3, [8, 10], 0), S('k_chest_press', 3, [10, 12], 75)] },
        { title: 'Superset C', items: [S('kb_press', 3, [6, 10], 0), S('k_woodchop', 3, [10, 12], 60)] },
        { title: 'Core', items: [S('hang_leg_raise', 3, [6, 10], 45), S('dead_bug', 2, [6, 8], 30, { perSide: true })] },
        { title: 'Conditioning', items: [C('row_steady', 8)] },
        { title: 'Cooldown', items: [T('hamstring_bench', 1, 40, 10)] }
      ]
    }
  };

  // ---------------------------------------------------------------- hybrid race (home substitutes, race format)
  function D(id, m) { return { id: id, dist: m }; }
  function hxRun(n, min) { return { title: 'Run ' + n + ' (bike)', items: [C('hx_bike_run', min)] }; }
  function hxSt(n, name, item) { return { title: 'Station ' + n + ' · ' + name, items: [item] }; }
  var HX_STATIONS = [
    ['Ski machine', T('k_ski', 1, 240, 0)],
    ['Sled Push', T('bike_sled', 1, 150, 0)],
    ['Sled Pull', T('k_sled_pull', 1, 150, 0)],
    ['Burpee Broad Jumps', S('burpee_bj', 1, [25, 25], 0)],
    ['Rowing 1000 m', D('row_steady', 1000)],
    ['Farmers Carry', T('kb_farmers', 1, 150, 0)],
    ['Sandbag Lunges', S('kb_lunge', 1, [50, 50], 0)],
    ['Wall Balls', S('db_thruster', 1, [50, 50], 0)]
  ];
  function hxRace(stations, runMin) {
    var b = [{ title: 'Warm-up', items: [C('bike_z2', 6)] }];
    stations.forEach(function (st, i) { b.push(hxRun(i + 1, runMin)); b.push(hxSt(i + 1, st[0], JSON.parse(JSON.stringify(st[1])))); });
    b.push({ title: 'Cooldown', items: [C('row_steady', 4)] });
    b.push({ title: 'Stretch', items: [T('hip_flexor', 1, 40, 10)] });
    return b;
  }
  SESSIONS.HX1 = { name: 'Hybrid Race Simulation – Full', short: '8 × (run + station) · for time', color: '#fcb900', race: true, blocks: hxRace(HX_STATIONS, 4) };
  SESSIONS.HX2 = {
    name: 'Hybrid Race Simulation – Half', short: '4 × (run + station) · for time', color: '#fcb900', race: true,
    blocks: hxRace([
      ['Ski machine', T('k_ski', 1, 150, 0)], ['Sled Push', T('bike_sled', 1, 90, 0)],
      ['Burpee Broad Jumps', S('burpee_bj', 1, [15, 15], 0)], ['Wall Balls', S('db_thruster', 1, [30, 30], 0)]
    ], 3)
  };
  SESSIONS.HX3 = {
    name: 'Race Stations – Strength & Technique', short: '3 rounds of all stations', color: '#fcb900',
    blocks: [
      { title: 'Warm-up', items: [C('row_steady', 5)] },
      { title: 'Station Circuit', items: [T('k_ski', 3, 60, 0), T('k_sled_pull', 3, 60, 0), S('kb_lunge', 3, [20, 20], 0), S('db_thruster', 3, [20, 20], 0), T('kb_farmers', 3, 60, 0), S('burpee_bj', 3, [10, 10], 120)] },
      { title: 'Compromised Run', items: [I('hx_bike_run', 4, 60, 30)] },
      { title: 'Cooldown', items: [C('bike_z2', 3)] },
      { title: 'Stretch', items: [T('hamstring_bench', 1, 40, 10)] }
    ]
  };
  // adv = official hybrid race volumes; lower levels scale down (weights scale via progression)
  var HX_SCALE = { beg: 0.6, mid: 0.8, adv: 1 };

  var PLANS = {
    4: { name: '4×/week – Upper / Lower', order: ['L1', 'U1', 'L2', 'U2'], days: [1, 2, 4, 5] },
    3: { name: '3×/week – Full body', order: ['F1', 'F2', 'F3'], days: [1, 3, 5] }
  };
  // Week = settings.days workouts (1–7), settings.trail of them outdoors (Trail: run, walk, ride), the rest in the gym.
  // Gym rotation by count: up to 3 full body, 4 upper/lower, 5+ upper/lower with full-body days added.
  var GYM_ORDER = { 1: ['F1'], 2: ['F1', 'F2'], 3: ['F1', 'F2', 'F3'], 4: ['L1', 'U1', 'L2', 'U2'], 5: ['L1', 'U1', 'F1', 'L2', 'U2'],
    6: ['L1', 'U1', 'F1', 'L2', 'U2', 'F2'], 7: ['L1', 'U1', 'F1', 'L2', 'U2', 'F2', 'F3'] };
  var GYM_DAYS = { 1: [3], 2: [2, 5], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] };
  var TRAIL_PREF = [6, 0, 3, 2, 4, 1, 5];   // outdoors: weekend first
  function counts(s) {
    var total = Math.max(1, Math.min(7, s.days || 5)), trail = Math.max(0, Math.min(total - 1, s.trail == null ? 0 : s.trail));
    return { total: total, trail: trail, gym: total - trail };
  }
  function plan_(state) {
    var s = state.settings, c = counts(s), pref = (s.prefDays || []).slice(), gymDays, trailDays;
    if (pref.length) {
      // picked weekdays: Trail takes the weekend-most ones, the gym the rest
      trailDays = TRAIL_PREF.filter(function (d) { return pref.indexOf(d) >= 0; }).slice(0, c.trail);
      gymDays = pref.filter(function (d) { return trailDays.indexOf(d) < 0; });
    } else {
      gymDays = GYM_DAYS[c.gym].slice();
      trailDays = TRAIL_PREF.filter(function (d) { return gymDays.indexOf(d) < 0; }).slice(0, c.trail);
    }
    return { order: GYM_ORDER[c.gym], days: gymDays, trail: trailDays, gym: c.gym, trailN: c.trail, total: c.total };
  }

  var WEEK_INFO = {
    1: { label: 'Week 1 – Intro', rir: 3, note: 'Stop each set when you could still do about 3 more reps. Technique before load.' },
    2: { label: 'Week 2 – Build', rir: 2, note: '2 reps in reserve. Add load where you hit the top of the range.' },
    3: { label: 'Week 3 – Peak', rir: 1, note: '1 rep in reserve. Hardest week of the block.' },
    4: { label: 'Week 4 – Deload', rir: 4, note: 'Fewer sets, lighter loads. This is where you adapt – don’t skip it.' }
  };

  function blockWeek(state) {
    var start = state.settings.startDate ? new Date(state.settings.startDate) : new Date();
    var days = Math.floor((Date.now() - start.getTime()) / 86400000);
    return (Math.floor(Math.max(0, days) / 7) % 4) + 1;
  }

  function nextSessionKey(state) {
    var plan = plan_(state);
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
    // first time with no history: women start lighter – upper body ~55 %, legs and glutes ~70 % of the default
    // (same movements and progression; only the starting estimate changes, the log takes over after set one)
    if (!h && state.settings.sex === 'f' && ex.unit !== 'bw' && ex.unit !== 's') {
      var lower = ['noge', 'zadnjica'].indexOf((ex.groups || [])[0]) >= 0;
      load = ex.unit === 'stopnja' ? Math.max(1, load - (lower ? 1 : 3)) : load * (lower ? 0.7 : 0.55);
    }
    if (state.settings.level === 'beg' && !h && ex.unit !== 'bw') load = ex.unit === 'stopnja' ? Math.max(1, load - 2) : Math.max(0, load * 0.75);
    var reps = lo, harder = null;
    var why = h ? '' : 'Starting estimate – adjust after the first set';
    if (h && h.reps && h.reps.length) {
      var allTop = h.reps.every(function (r) { return r >= hi; });
      var anyLow = h.reps.some(function (r) { return r < lo; });
      if (allTop) {
        if (HARDER[item.id] && Exercises.BY_ID[HARDER[item.id]]) {
          reps = hi; harder = HARDER[item.id];
          why = '↑ Ready for the next step: try ' + Exercises.BY_ID[harder].name + ' (all sets at ' + hi + ')';
        } else if (ex.unit === 'bw' || !ex.inc) { reps = hi; why = 'All sets maxed – slow the lowering to 3–4 s or add load (backpack/KB)'; }
        else { load = load + ex.inc; reps = lo; why = '↑ Progress: +' + ex.inc + ' ' + incLabel(ex.unit, ex.inc) + ' (all sets at ' + hi + ')'; }
      } else if (anyLow) {
        reps = lo; why = h.fails >= 1 && ex.inc ? '↓ Drop ' + ex.inc + ' ' + incLabel(ex.unit, ex.inc) : 'Same load – aim for ' + lo + '+';
        if (h.fails >= 1 && ex.inc) load = Math.max(0, load - ex.inc);
      } else {
        reps = Math.min(hi, Math.max.apply(null, h.reps) + 1);
        why = 'Same load – add 1 rep';
      }
    }
    if (ex.unit === 'kg') load = round(load, ex.inc >= 2 ? (ex.id.indexOf('kb_') === 0 ? 4 : 1) : 0.5);
    var out = { load: load, reps: reps, why: why };
    if (harder) out.harder = harder;
    return out;
  }
  // Bodyweight progressions: when every set hits the top of the range, the next variant is the way to add load
  var HARDER = { knee_pushup: 'pushup', glute_bridge: 'sl_glute_bridge', bw_squat: 'jump_squat', bw_lunge: 'jump_squat', dead_bug: 'hollow_hold' };

  function incLabel(u, n) { return u === 'stopnja' ? (n === 1 ? 'level' : 'levels') : unitLabel(u); }
  function unitLabel(u) { return { kg: 'kg', stopnja: 'level', bw: '', min: 'min', s: 's' }[u] || ''; }

  // Build the concrete session for the current block week + level
  function get(state, key) { return SESSIONS[key] || (state.customs || {})[key] || null; }

  function owned(state) { return (state.settings && state.settings.equipment) || Exercises.HOME_GYM; }

  // Real hybrid race stations replace home substitutes when the profile owns the equipment
  var STATION = { treadmill_run: { dist: 1000 }, skierg: { dist: 1000 }, sled_push: { dist: 50 }, sled_pull: { dist: 50 }, wall_ball: { reps: [100, 100] } };

  // Joint-friendly swaps: exercises that load a sore joint give way to a gentler option from the same pattern
  var LIMITS = {
    knee: ['box_jump', 'burpee_bj', 'db_bulgarian', 'kb_lunge', 'sandbag_lunge', 'bw_lunge', 'jump_rope', 'high_knees', 'treadmill_run', 'bb_squat', 'wall_ball', 'db_thruster', 'mountain_climber',
      'jump_squat', 'burpee', 'wall_sit'],
    back: ['bb_deadlift', 'bb_squat', 'kb_swing', 'back_ext', 'situp', 'hang_leg_raise', 'burpee_bj', 'sled_pull', 'k_sled_pull',
      'abwheel_rollout', 'susp_fallout', 'ball_slam', 'ball_rot_slam', 'landmine_row', 'superman', 'burpee', 'hollow_hold'],
    // landmine_press is deliberately NOT here: its arc is the shoulder-friendly vertical press
    shoulder: ['db_shoulder_press', 'kb_press', 'bb_bench', 'pullup', 'dead_hang', 'hang_leg_raise', 'hang_knee_raise', 'wall_ball', 'db_thruster', 'pushup', 'skierg', 'k_ski',
      'dips', 'susp_fallout', 'ball_slam', 'pike_pushup', 'burpee'],
    // knee_pushup is deliberately NOT under shoulder: it is the gentler push-up
    wrist: ['pushup', 'plank', 'mountain_climber', 'burpee_bj', 'bb_bench', 'dips', 'lsit', 'abwheel_rollout', 'knee_pushup', 'pike_pushup', 'burpee']
  };
  function avoided(state) {
    var out = {};
    ((state.settings && state.settings.limits) || []).forEach(function (k) { (LIMITS[k] || []).forEach(function (id) { out[id] = 1; }); });
    return out;
  }

  // Swap every exercise the profile cannot do for the best owned alternative (same movement pattern).
  function adapt(src, own, upgrade, avoid) {
    avoid = avoid || {};
    var used = {}, missing = [];
    var blocks = src.blocks.map(function (b) {
      var items = [];
      b.items.forEach(function (it) {
        var id = it.id, pick;
        if (upgrade) {
          var list = Exercises.PATTERNS[Exercises.PATTERN_OF[id]] || [id];
          // race stations repeat (8 runs), so reuse is allowed here
          pick = list.filter(function (x) { return Exercises.available(x, own) && !avoid[x]; })[0] ||
            list.filter(function (x) { return Exercises.available(x, own); })[0] || null;
          if (!pick && Exercises.available(id, own)) pick = id;
        } else {
          pick = Exercises.substitute(id, own, Object.keys(used).filter(function (x) { return x !== id; }));
          // an earlier swap already put this exercise in the session: take the next one from the pattern, never a duplicate
          if (pick && used[pick]) pick = (Exercises.PATTERNS[Exercises.PATTERN_OF[id]] || []).filter(function (x) { return !used[x] && Exercises.available(x, own); })[0] || null;
          if (pick && avoid[pick]) {
            var safe = (Exercises.PATTERNS[Exercises.PATTERN_OF[id]] || []).filter(function (x) { return !avoid[x] && !used[x] && Exercises.available(x, own); })[0];
            if (safe) pick = safe;
          }
        }
        // dropped only to avoid a duplicate (the exercise itself is doable) – not a missing-equipment slot
        if (!pick) { if (!Exercises.available(id, own)) missing.push(id); return; }
        var o = JSON.parse(JSON.stringify(it));
        if (pick !== id) {
          o.id = pick; o.swappedFrom = id;
          if (avoid[id]) o.joint = true;
          var conv = upgrade && src.race && STATION[pick];
          if (conv) { delete o.time; delete o.cardio; o.sets = 1; o.rest = it.rest || 0; if (conv.dist) { delete o.reps; o.dist = conv.dist; } else o.reps = conv.reps.slice(); }
          else if (!o.cardio && !o.time && !o.dist && Exercises.BY_ID[pick].type === 'cardio' && Exercises.BY_ID[pick].unit !== 'kg' && Exercises.BY_ID[pick].unit !== 'bw') {
            // a rep-based slot became a timed cardio movement
            o.time = 45; delete o.reps;
          } else if (o.cardio && o.cardio.rounds && /^bike_hiit|^row_hiit/.test(pick)) {
            o.cardio.work = pick === 'bike_hiit' ? 20 : 30; o.cardio.easy = pick === 'bike_hiit' ? 40 : 30;
          } else if (o.cardio && o.cardio.rounds && Exercises.BY_ID[pick].iv) {
            o.cardio.work = Exercises.BY_ID[pick].iv[0]; o.cardio.easy = Exercises.BY_ID[pick].iv[1];
          }
          if (o.reps && !o.dist && Exercises.BY_ID[pick].unit === 's') { o.time = (PRESET[pick] && PRESET[pick].time) || 40; delete o.reps; }
          // a distance target needs a machine with a monitor – floor work gets the equivalent time instead
          if (o.dist && !STATION[pick] && Exercises.BY_ID[pick].equip.every(function (k) { return k === 'floor'; })) {
            o.time = Math.round(o.dist * (Exercises.BY_ID[id].secPerM || 0.27) / 10) * 10; delete o.dist;
            o.sets = o.sets || 1; o.rest = o.rest || 0;
          }
          // a bodyweight move standing in for a loaded lift uses its own rep range (8 supermans or 15 jump squats make no sense)
          var pre = PRESET[pick];
          if (!upgrade && o.reps && pre && pre.reps && Exercises.BY_ID[pick].unit === 'bw' &&
            (Exercises.BY_ID[id].unit !== 'bw' || Exercises.PATTERN_OF[id] !== Exercises.PATTERN_OF[pick])) o.reps = pre.reps.slice();
          if (o.perSide && !Exercises.BY_ID[pick].perSide && !(PRESET[pick] && PRESET[pick].perSide)) delete o.perSide;
          if (!o.perSide && PRESET[pick] && PRESET[pick].perSide && o.reps) o.perSide = true;
        }
        if (avoid[o.id]) o.caution = true;   // no gentler option with this equipment – flag it instead
        used[pick] = 1;
        items.push(o);
      });
      // the exercise that closed a superset round was dropped: the new last one takes over its rest
      var last = items[items.length - 1], srcLast = b.items[b.items.length - 1];
      if (!upgrade && last && !last.cardio && !last.rest && (srcLast.rest || items.length === 1)) last.rest = srcLast.rest || 90;
      return { title: b.title, items: items };
    }).filter(function (b) { return b.items.length; });
    return { blocks: blocks, missing: missing };
  }

  function build(state, key) {
    var src = get(state, key);
    if (!src) { key = nextSessionKey(state); src = SESSIONS[key]; }
    var week = blockWeek(state);
    var lvl = state.settings.level;
    var ad = adapt(src, owned(state), src.race || /^HX/.test(key) || (src.opts && src.opts.type === 'hyrox'), avoided(state));
    var goal = state.settings.goal || 'general';
    var conditioning = goal === 'fatloss' || goal === 'endurance' || goal === 'hyrox';
    var blocks = ad.blocks.map(function (b) {
      return {
        title: b.title,
        items: b.items.map(function (it) {
          var o = JSON.parse(JSON.stringify(it));
          if (o.sets && !src.race) {
            if (lvl === 'beg') o.sets = Math.max(Math.min(2, o.sets), o.sets - 1);
            if (lvl === 'adv' && /Glavni|Main|Superset A|Moč|Strength/.test(b.title)) o.sets += 1;
            if (week === 4) o.sets = Math.max(1, Math.ceil(o.sets * 0.6));
          }
          if (o.cardio && o.cardio.rounds) {
            if (lvl === 'beg') o.cardio.rounds = Math.max(3, o.cardio.rounds - 2);
            if (week === 4) o.cardio.rounds = Math.max(3, Math.ceil(o.cardio.rounds * 0.6));
          }
          // the profile's goal shapes the prescription (race simulations stay at race standard)
          if (!src.race) {
            var main = /Glavni|Main|Superset A|Moč|Strength/.test(b.title);
            if (o.reps && goal === 'strength' && main && Exercises.COMPOUND.indexOf(o.id) >= 0) {
              o.reps = [Math.max(3, o.reps[0] - 3), Math.max(5, o.reps[1] - 3)];
              if (o.rest) o.rest += 30;
            }
            if (o.reps && goal === 'endurance' && !main) o.reps = [o.reps[0] + 3, o.reps[1] + 5];
            if (o.rest && conditioning) o.rest = Math.max(30, Math.round(o.rest * 0.75 / 15) * 15);
            if (o.cardio && o.cardio.rounds && conditioning) o.cardio.rounds += 2;
            if (o.cardio && o.cardio.min && goal === 'endurance') o.cardio.min = Math.round(o.cardio.min * 1.25);
          }
          if (src.race) {
            var k = HX_SCALE[lvl] || 1;
            if (o.reps) { var n = Math.max(5, Math.round(o.reps[0] * k / 5) * 5); o.reps = [n, n]; }
            if (o.time) o.time = Math.round(o.time * k / 10) * 10;
            if (o.cardio && o.cardio.min && /^(Run|Tek)/.test(b.title)) o.cardio.min = Math.max(2, Math.round(o.cardio.min * k));
            if (o.dist) { var stp = o.dist >= 500 ? 100 : 10; o.dist = Math.max(stp, Math.round(o.dist * k / stp) * stp); }
          }
          // no cardio machine: a 6-min "steady" warm-up would become 6 min of high knees – easy intervals instead (≈4 min)
          if (/Warm|Ogrev/.test(b.title) && o.swappedFrom && o.cardio && o.cardio.min && Exercises.BY_ID[o.id].equip.indexOf('floor') >= 0) o.cardio = { rounds: 4, work: 20, easy: 40 };
          if (o.reps) o.sug = suggest(state, o);
          return o;
        })
      };
    });
    // preferred session length: trim accessory sets first, then main-lift sets, never warm-up or cooldown
    var cap = state.settings.sessionMin, trimmed = false;
    if (cap && !src.race) {
      for (var guard = 0; guard < 40 && estimateMin({ blocks: blocks }) > cap + 3; guard++) {
        var best = null;
        [/^(?!.*(Main|Glavni|Warm|Ogrev|Cool|Ohlaj|Stretch|Raztez))/, /Main|Glavni|Strength|Moč/].some(function (re, pass) {
          blocks.forEach(function (b) {
            if (!re.test(b.title)) return;
            b.items.forEach(function (it) { if (it.sets > (pass ? 2 : 1) && (!best || it.sets > best.sets)) best = it; });
          });
          return !!best;
        });
        if (!best) break;
        best.sets--; trimmed = true;
      }
    }
    // names follow the equipment actually used: no cable machine → no "Cables" in the title
    var ids = [].concat.apply([], blocks.map(function (b) { return b.items.map(function (it) { return it.id; }); }));
    var cables = ids.some(function (id) { return /^k_/.test(id); }), name = src.name, short = src.short;
    if (!cables) {
      name = name.replace(/ & Cables\b/, '');
      short = (short || '').replace(/^Cables, (\w)/, function (m, c) { return c.toUpperCase(); });
    }
    return { key: key, name: name, short: short, color: src.color, custom: !!src.custom, race: !!src.race, missing: ad.missing, week: week, weekInfo: WEEK_INFO[week], blocks: blocks, goal: goal, trimmed: trimmed ? cap : 0 };
  }

  // Flatten to an ordered list of steps (supersets interleaved by round)
  function steps(session) {
    var out = [];
    session.blocks.forEach(function (b, bi) {
      var items = b.items;
      if (items.length === 1 && items[0].cardio) {
        var it = items[0], c = it.cardio;
        if (c.min) out.push({ kind: 'time', id: it.id, item: it, block: b.title, sec: c.min * 60, set: 1, sets: 1, rest: 0, label: c.min + ' min steady' });
        else for (var r = 1; r <= c.rounds; r++) {
          var warm = /Warm|Ogrev/.test(b.title);   // warm-up intervals are brisk, not "HARD"
          out.push({ kind: 'time', id: it.id, item: it, block: b.title, sec: c.work, set: r, sets: c.rounds, rest: 0, label: (warm ? 'Brisk ' : 'HARD ') + c.work + ' s', hard: !warm, interval: true });
          out.push({ kind: 'time', id: it.id, item: it, block: b.title, sec: c.easy, set: r, sets: c.rounds, rest: 0, label: 'Easy ' + c.easy + ' s', easy: true, interval: true });
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
            out.push({ kind: 'time', id: it.id, item: it, block: b.title, sec: perSide ? it.time * 2 : it.time, set: s, sets: it.sets, rest: restAfter, tag: lbl, label: it.time + (perSide ? ' s/side' : ' s') });
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
  // exercises for extra equipment never appear in a template session – give them sensible defaults
  var EXTRA_PRESET = {
    susp_row: S('susp_row', 3, [8, 12], 90), susp_pushup: S('susp_pushup', 3, [8, 12], 90), susp_squat: S('susp_squat', 3, [10, 15], 75),
    susp_fallout: S('susp_fallout', 3, [6, 10], 60), abwheel_rollout: S('abwheel_rollout', 3, [6, 10], 60),
    ball_slam: S('ball_slam', 3, [10, 15], 60), ball_rot_slam: S('ball_rot_slam', 3, [6, 8], 60, { perSide: true }), rope_waves: T('rope_waves', 4, 30, 30),
    roll_tspine: T('roll_tspine', 1, 60, 10), roll_quads: T('roll_quads', 1, 60, 10),
    dips: S('dips', 3, [6, 10], 90), lsit: T('lsit', 3, 15, 45),
    landmine_press: S('landmine_press', 3, [8, 10], 75, { perSide: true }), landmine_row: S('landmine_row', 3, [8, 10], 90),
    // cable station (e.g. Technogym Kinesis Personal) extras
    k_fly: S('k_fly', 3, [10, 15], 60), k_shoulder_press: S('k_shoulder_press', 3, [8, 12], 75), k_curl: S('k_curl', 3, [10, 12], 60),
    k_squat: S('k_squat', 3, [10, 12], 75), k_crunch: S('k_crunch', 3, [12, 15], 45),
    k_pallof: S('k_pallof', 3, [8, 10], 45, { perSide: true }), k_lift: S('k_lift', 3, [8, 10], 45, { perSide: true }),
    k_row_1arm: S('k_row_1arm', 3, [10, 12], 60, { perSide: true }), k_press_1arm: S('k_press_1arm', 3, [10, 12], 60, { perSide: true }),
    k_deadbug: S('k_deadbug', 3, [6, 8], 45, { perSide: true }),
    // wall bars
    chinup_neutral: S('chinup_neutral', 3, [5, 8], 90), vkr_knee_raise: S('vkr_knee_raise', 3, [10, 15], 60),
    wb_decline_pushup: S('wb_decline_pushup', 3, [6, 12], 75), wb_leg_raise: S('wb_leg_raise', 3, [8, 12], 60),
    // bodyweight only
    knee_pushup: S('knee_pushup', 3, [8, 15], 60), pike_pushup: S('pike_pushup', 3, [6, 10], 75), superman: S('superman', 3, [10, 12], 60),
    prone_y_raise: S('prone_y_raise', 3, [10, 12], 45), side_plank: T('side_plank', 2, 30, 30), wall_sit: T('wall_sit', 3, 40, 60),
    jump_squat: S('jump_squat', 3, [8, 12], 75), burpee: S('burpee', 3, [8, 12], 60), hollow_hold: T('hollow_hold', 3, 25, 45),
    sl_glute_bridge: S('sl_glute_bridge', 3, [8, 12], 60, { perSide: true }), hamstring_floor: T('hamstring_floor', 1, 40, 10)
  };
  Object.keys(EXTRA_PRESET).forEach(function (k) { if (!PRESET[k]) PRESET[k] = EXTRA_PRESET[k]; });
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
    var focus = (opts.focus && opts.focus.length) ? opts.focus : ['noge', 'prsa', 'hrbet', 'trup', 'zadnjica', 'rame'];
    var lower = focus.some(function (f) { return LOWER.indexOf(f) >= 0; });
    if (opts.type === 'kardio') return cardioSession(opts, min);
    if (opts.type === 'hyrox') {
      var key = { full: 'HX1', half: 'HX2', stations: 'HX3' }[opts.format || 'half'];
      var copy = JSON.parse(JSON.stringify(SESSIONS[key]));
      copy.custom = true; copy.opts = opts;
      return copy;
    }

    var cardioMin = opts.type === 'mix' ? Math.max(6, Math.round(min * 0.3)) : 0;
    var head = [{ title: 'Warm-up', items: [C(lower ? 'bike_z2' : 'row_steady', min <= 30 ? 4 : 5)] }];
    var tail = [];
    if (cardioMin) tail.push({ title: 'Cardio', items: [lower ? I('bike_hiit', cardioMin, 20, 40) : I('row_hiit', cardioMin, 30, 30)] });
    tail.push({ title: 'Cooldown', items: lower ? [T('hip_flexor', 1, 40, 10), T('hamstring_bench', 1, 40, 10)] : [T('dead_hang', 1, 30, 10)] });

    // add exercises in priority order while the estimated session still fits the chosen duration
    var order = strengthOrder(focus, opts.exclude || [], opts.owned || Exercises.HOME_GYM);
    var sets = min <= 30 ? 2 : 3;
    // build() gives beginners one set less and advanced lifters one more on the main block – budget with the sets they will actually do
    function realBlocks(bl) {
      return bl.map(function (b) {
        var main = /Main|Superset A/.test(b.title);
        return { title: b.title, items: b.items.map(function (it) {
          var n = opts.level === 'beg' ? Math.max(Math.min(2, it.sets), it.sets - 1) : opts.level === 'adv' && main ? it.sets + 1 : it.sets;
          return Object.assign({}, it, { sets: n });
        }) };
      });
    }
    // an exercise that no longer fits is skipped, a shorter one further down the list may still fit (e.g. core)
    var best = null, picked = [];
    for (var n = 0; n < order.length; n++) {
      var items = sortForSession(picked.concat(order[n]).map(function (id) { return prescribe(id, sets); }));
      var cand = { blocks: head.concat(groupBlocks(items), tail) };
      var probe = { blocks: head.concat(realBlocks(groupBlocks(items)), tail) };
      if (best && estimateMin(probe) > min + 1) continue;
      picked.push(order[n]); best = cand;
    }
    return {
      name: (opts.type === 'mix' ? 'Strength + Cardio: ' : 'Strength: ') + focus.map(function (f) { return Exercises.FOCUS[f].name; }).join(', '),
      short: min + ' min · custom', color: '#f08a5d', custom: true, opts: opts, blocks: best.blocks
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
        out.push({ title: ea.type === 'core' ? 'Core' : ea.compound ? 'Main Lift' : 'Accessory', items: [a] }); i += 1;
      }
    }
    return out;
  }

  var MACHINES = {
    bike: { z2: 'bike_z2', hiit: 'bike_hiit', work: 20, easy: 40, name: 'Bike' },
    rower: { z2: 'row_steady', hiit: 'row_hiit', work: 30, easy: 30, name: 'Rower' },
    treadmill: { z2: 'treadmill_run', hiit: 'treadmill_run', work: 30, easy: 60, name: 'Treadmill' },
    skierg: { z2: 'skierg', hiit: 'skierg', work: 30, easy: 30, name: 'Ski machine' },
    rope: { z2: 'jump_rope', hiit: 'jump_rope', work: 40, easy: 20, name: 'Jump Rope' },
    floor: { z2: 'high_knees', hiit: 'high_knees', work: 30, easy: 30, name: 'Bodyweight', circuit: ['burpee', 'mountain_climber', 'jump_squat'] },
    airbike: { z2: 'airbike_z2', hiit: 'airbike_sprint', work: 20, easy: 40, name: 'Air bike' },
    // conditioning tools: intervals only (no Zone 2 on ropes or slams)
    ropes: { z2: null, hiit: 'rope_waves', work: 30, easy: 30, name: 'Battle ropes', hiitOnly: true },
    slamball: { z2: null, hiit: 'ball_slam', work: 30, easy: 30, name: 'Slam ball', hiitOnly: true }
  };
  function cardioMachines(own) {
    var m = ['bike', 'rower', 'treadmill', 'skierg', 'rope', 'airbike', 'ropes', 'slamball'].filter(function (k) { return own.indexOf(k) >= 0; });
    return m.length ? m : ['floor'];
  }

  function cardioSession(opts, min) {
    var own = opts.owned || Exercises.HOME_GYM;
    var avail = cardioMachines(own);
    var inten = opts.intensity || 'mix';
    // machines that can do steady work (warm-up, cooldown, Zone 2)
    var steadyM = avail.filter(function (k) { return !MACHINES[k].hiitOnly; });
    if (!steadyM.length) steadyM = ['floor'];
    var machines = opts.machine && opts.machine !== 'all' && avail.indexOf(opts.machine) >= 0 ? [opts.machine] : (inten === 'z2' ? steadyM : avail).slice(0, 2);
    function easyOf(k) { return MACHINES[k].hiitOnly ? MACHINES[steadyM[0]].z2 : MACHINES[k].z2; }
    var blocks = [{ title: 'Warm-up', items: [C(easyOf(machines[0]), 5)] }];
    var main = Math.max(6, min - 9);
    var per = Math.round(main / machines.length);
    machines.forEach(function (mc) {
      var M = MACHINES[mc];
      var label = machines.length > 1 ? ' – ' + M.name : '';
      var rounds = Math.max(3, Math.round(per * 60 / (M.work + M.easy)));
      // ropes / slams are brutal on the grip and shoulders: cap the number of rounds
      if (M.hiitOnly) blocks.push({ title: 'Intervals' + label, items: [I(M.hiit, Math.min(10, rounds), M.work, M.easy)] });
      else if (M.circuit && inten !== 'z2') {
        // bodyweight: Zone 2 first (mix), then short interval blocks of different moves
        var ivMin = inten === 'hiit' ? per : per - Math.max(3, Math.round(per / 2));
        if (inten !== 'hiit') blocks.push({ title: 'Zone 2' + label, items: [C(M.z2, per - ivMin)] });
        var nB = Math.max(1, Math.min(M.circuit.length, Math.round(ivMin / 5)));
        M.circuit.slice(0, nB).forEach(function (id) {
          blocks.push({ title: 'Intervals – ' + Exercises.BY_ID[id].name, items: [I(id, Math.max(3, Math.round(ivMin * 60 / nB / (M.work + M.easy))), M.work, M.easy)] });
        });
      }
      else if (inten === 'z2') blocks.push({ title: 'Zone 2' + label, items: [C(M.z2, per)] });
      else if (inten === 'hiit') blocks.push({ title: 'Intervals' + label, items: [I(M.hiit, rounds, M.work, M.easy)] });
      else {
        var half = Math.max(3, Math.round(per / 2));
        blocks.push({ title: 'Zone 2' + label, items: [C(M.z2, half)] });
        blocks.push({ title: 'Intervals' + label, items: [I(M.hiit, Math.max(3, Math.round((per - half) * 60 / (M.work + M.easy))), M.work, M.easy)] });
      }
    });
    blocks.push({ title: 'Cooldown', items: [C(easyOf(machines[machines.length - 1]), 3)] });
    blocks.push({ title: 'Stretch', items: [T('hamstring_bench', 1, 40, 10)] });
    var iName = { z2: 'Zone 2', hiit: 'Intervals', mix: 'Zone 2 + Intervals' }[machines.every(function (k) { return MACHINES[k].hiitOnly; }) ? 'hiit' : inten];
    return { name: 'Cardio: ' + machines.map(function (k) { return MACHINES[k].name; }).join(' + ') + ' – ' + iName, short: min + ' min · custom', color: '#5ad1b8', custom: true, opts: opts, blocks: blocks };
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
        if (it.cardio && Exercises.BY_ID[newId].type === 'cardio') {
          var c = JSON.parse(JSON.stringify(it)); c.id = newId;
          if (c.cardio.rounds) {
            var iv = Exercises.BY_ID[newId].iv;
            c.cardio.work = iv ? iv[0] : newId === 'bike_hiit' ? 20 : 30; c.cardio.easy = iv ? iv[1] : newId === 'bike_hiit' ? 40 : 30;
          }
          return c;
        }
        var n = prescribe(newId, it.sets);
        n.rest = it.rest;
        if (n.perSide === undefined && it.perSide && !Exercises.BY_ID[newId].perSide) delete n.perSide;
        return n;
      });
    });
  }

  // any exercise from the picker: added before the cooldown / stretch, prescribed like the library would
  function itemFor(id) {
    var e = Exercises.BY_ID[id];
    var it = e.type === 'cardio' ? (e.iv ? I(id, 8, e.iv[0], e.iv[1]) : e.id.indexOf('hiit') > 0 ? I(id, 8, e.id === 'bike_hiit' ? 20 : 30, e.id === 'bike_hiit' ? 40 : 30) : C(id, 10)) : prescribe(id, 3);
    if (!it.cardio) it.rest = it.time ? 30 : (e.compound ? 90 : 60);
    return it;
  }
  function isCool(title) { return /Cool|Stretch|Ohlaj|Raztez/i.test(title || ''); }
  function addItem(src, id) {
    var at = src.blocks.length;
    while (at > 0 && isCool(src.blocks[at - 1].title)) at--;
    src.blocks.splice(at, 0, { title: 'Extra', items: [itemFor(id)] });
  }
  // "Cherry on top" finisher: 3 sets for the abs, something not already in the session, with the owned gear
  var BONUS = ['hang_leg_raise', 'vkr_knee_raise', 'wb_leg_raise', 'k_crunch', 'abwheel_rollout', 'situp', 'hang_knee_raise', 'hollow_hold', 'dead_bug', 'k_pallof', 'side_plank', 'plank'];
  function bonusFor(state, used) {
    var own = owned(state), avoid = avoided(state);
    var id = BONUS.filter(function (x) { return Exercises.available(x, own) && used.indexOf(x) < 0 && !avoid[x]; })[0];
    if (!id) return null;
    var it = prescribe(id, 3); it.rest = it.time ? 30 : 45; it.sets = 3;
    return { name: 'Bonus', short: '', custom: true, blocks: [{ title: 'Bonus', items: [it] }] };
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
    var it = e.type === 'cardio' ? (e.iv ? I(id, 8, e.iv[0], e.iv[1]) : e.id.indexOf('hiit') > 0 ? I(id, 8, e.id === 'bike_hiit' ? 20 : 30, e.id === 'bike_hiit' ? 40 : 30) : C(id, 10)) : prescribe(id, 3);
    if (!it.cardio) it.rest = it.time ? 30 : 90;
    return { name: e.name, short: 'Single exercise', color: '#3ec46d', custom: true, blocks: [{ title: 'Exercise', items: [it] }] };
  }

  global.Program = {
    SESSIONS: SESSIONS, PLANS: PLANS, plan: plan_, counts: counts, WEEK_INFO: WEEK_INFO,
    HX_KEYS: ['HX1', 'HX2', 'HX3'],
    MACHINES: MACHINES, cardioMachines: cardioMachines, owned: owned,
    get: get, build: build, steps: steps, generate: generate, alternatives: alternatives,
    replaceItem: replaceItem, removeItem: removeItem, addItem: addItem, bonusFor: bonusFor, isCool: isCool, single: single, nextSessionKey: nextSessionKey, blockWeek: blockWeek,
    suggest: suggest, estimateMin: estimateMin, unitLabel: unitLabel, groupLetter: groupLetter
  };
})(window);
