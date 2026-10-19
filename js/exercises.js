/*
 * Exercise library — every exercise uses only the home equipment:
 * exercise bike, water rower, kettlebells, dumbbells, ab & back-extension bench,
 * adjustable weight bench, Cable station, wall pull-up / leg-raise station.
 *
 * anim.frames: looping keyframes, each { d: seconds to next frame, l: phase label, p: pose }.
 * Pose fields are documented in figure.js.
 */
(function (global) {
  'use strict';

  function m(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }
  var FOOT = ['fN', 0, -6];
  function stand(x) { return m({ t: 180, lN: [0, 0], aN: [0, 0], pin: FOOT }, x || {}); }

  // Equipment catalogue. `icon` is drawn by Figure.icon with the same renderer as the animations.
  var EQUIP = {
    bike: { name: 'Exercise bike', group: 'kardio', desc: 'Warm-up, Zone 2, intervals, race runs', icon: { vb: [-82, -134, 196, 146], scene: [{ type: 'bike', sx: -28, sy: -96, cx: 0, cy: -32, bx: 38, by: -112 }] } },
    rower: { name: 'Rower', group: 'kardio', desc: 'Technique, intervals, 1000 m', icon: { vb: [-118, -86, 268, 98], scene: [{ type: 'rower', fx: 60 }] } },
    treadmill: { name: 'Treadmill', group: 'kardio', desc: 'Running, race 1 km', icon: { vb: [-76, -160, 196, 172], scene: [{ type: 'treadmill', x0: -64, x1: 70 }] } },
    skierg: { name: 'Ski machine', group: 'kardio', desc: 'Race ski, intervals', icon: { vb: [-56, -232, 116, 244], scene: [{ type: 'skierg', x: 0 }] } },
    db: { name: 'Dumbbells', group: 'utezi', desc: 'Presses, rows, RDLs, thrusters', icon: { vb: [-64, -96, 128, 108], noFloor: true, props: [{ t: 'db', x: -4, y: -26 }, { t: 'db', x: 10, y: -66, k: 0.75 }] } },
    kb: { name: 'Kettlebells', group: 'utezi', desc: 'Swings, goblet squats, carries', icon: { vb: [-70, -82, 140, 94], props: [{ t: 'kb', x: -26, y: -28 }, { t: 'kb', x: 32, y: -22, k: 0.75 }] } },
    barbell: { name: 'Olympic barbell + rack', group: 'utezi', desc: 'Squats, deadlifts, barbell presses', icon: { vb: [-100, -92, 200, 104], props: [{ t: 'barbell', x: 0, y: -34 }] } },
    sandbag: { name: 'Sandbag', group: 'utezi', desc: 'Race sandbag lunges, carries', icon: { vb: [-64, -72, 128, 84], props: [{ t: 'bag', x: 0, y: -20 }] } },
    wallball: { name: 'Wall ball (med ball)', group: 'utezi', desc: 'Race wall balls (needs a wall)', icon: { vb: [-50, -72, 100, 84], props: [{ t: 'ball', x: 0, y: -30 }] } },
    bench: { name: 'Adjustable weight bench', group: 'klopi', desc: 'Flat / incline bench, support', icon: { vb: [-82, -86, 180, 98], scene: [{ type: 'bench', x: -62, len: 118 }] } },
    tria: { name: 'Ab & back-extension bench', group: 'klopi', desc: 'Sit-ups and back extensions', icon: { vb: [-56, -92, 176, 104], scene: [{ type: 'tria_abs', x: -40 }] } },
    wall: { name: 'Wall station: pull-up bar + leg raise', group: 'klopi', desc: 'Pull-ups, leg raises, hangs', icon: { vb: [-92, -252, 160, 264], scene: [{ type: 'wall', x: -48, y: -226, bx: 46 }] } },
    box: { name: 'Plyo box', group: 'klopi', desc: 'Box jumps, step-ups', icon: { vb: [-60, -74, 120, 86], scene: [{ type: 'box', x: -32, w: 64, h: 54 }] } },
    kinesis: { name: 'Cable station', group: 'kabli', desc: 'Cable exercises, resistance 0–20', icon: { vb: [-62, -222, 124, 234], scene: [{ type: 'kinesis', x: 0, pulleys: [[-24, -186], [-24, -112], [-24, -36]] }] } },
    bands: { name: 'Resistance bands', group: 'kabli', desc: 'Rows, triceps, warm-ups', icon: { vb: [-62, -76, 124, 88], noFloor: true, props: [{ t: 'band', x: 0, y: -34 }] } },
    sled: { name: 'Sled', group: 'hyrox', desc: 'Race sled push and pull', icon: { vb: [-60, -124, 150, 136], scene: [{ type: 'sled', x: -24 }] } },
    rope: { name: 'Jump rope', group: 'hyrox', desc: 'Conditioning, warm-ups', icon: { vb: [-62, -110, 124, 122], noFloor: true, props: [{ t: 'rope', x: 0, y: -56 }] } },
    suspension: { name: 'Suspension trainer', group: 'tools', desc: 'Rows, presses, assisted squats, core (needs an anchor)', icon: { vb: [-60, -254, 120, 196], noFloor: true, scene: [{ type: 'susp', x: 0, y: -226, hang: 150 }] } },
    abwheel: { name: 'Ab wheel', group: 'tools', desc: 'Rollouts – anti-extension core', icon: { vb: [-70, -82, 140, 94], props: [{ t: 'wheel', x: 0, y: -38 }] } },
    dip: { name: 'Dip station / parallettes', group: 'tools', desc: 'Dips, L-sits', icon: { vb: [-74, -140, 148, 152], scene: [{ type: 'dipbars', x0: -50, x1: 50, y: -118 }] } },
    landmine: { name: 'Landmine attachment', group: 'utezi', desc: 'Landmine press and row (needs the barbell)', icon: { vb: [-104, -112, 210, 124], scene: [{ type: 'landmine', x: 82, end: [-74, -92], ext: 16, plate: -30, pr: 26 }] } },
    slamball: { name: 'Slam ball', group: 'hyrox', desc: 'Slams – power and conditioning', icon: { vb: [-50, -72, 100, 84], props: [{ t: 'slam', x: 0, y: -30 }] } },
    ropes: { name: 'Battle ropes', group: 'hyrox', desc: 'Waves – conditioning intervals', icon: { vb: [-74, -62, 148, 74], props: [{ t: 'ropes', x: 0, y: -26 }] } },
    airbike: { name: 'Air bike', group: 'kardio', desc: 'Fan bike – arms + legs, sprints and steady', icon: { vb: [-78, -132, 202, 144], scene: [{ type: 'airbike', sx: -28, sy: -96, cx: 0, cy: -32, fx: 82, fy: -66, fr: 34, px: 28, py: -42, pa: 184, pl: 76, sw: 11, still: 40 }] } },
    roller: { name: 'Foam roller', group: 'mob', desc: 'Upper back and quad release', icon: { vb: [-66, -54, 132, 66], props: [{ t: 'roller', x: -6, y: -17 }] } },
    floor: { name: 'Bodyweight', group: 'telo', desc: 'Always available', always: true, icon: { vb: [-60, -196, 120, 208], pose: { t: 180, lN: [0, 0], aN: [0, 0], pin: ['fN', 0, -6] }, focus: ['torso'] } }
  };
  var EQUIP_GROUPS = [
    { id: 'kardio', name: 'Cardio machines' },
    { id: 'utezi', name: 'Free weights' },
    { id: 'klopi', name: 'Benches, wall & boxes' },
    { id: 'kabli', name: 'Cables & bands' },
    { id: 'hyrox', name: 'Race & conditioning' },
    { id: 'tools', name: 'Bodyweight trainers' },
    { id: 'mob', name: 'Mobility & recovery' }
  ];
  var HOME_GYM = ['bike', 'rower', 'kb', 'db', 'tria', 'bench', 'kinesis', 'wall'];

  // ---------------------------------------------------------------- cardio
  var BIKE = { type: 'bike', sx: -28, sy: -96, cx: 0, cy: -32, bx: 38, by: -112 };
  function bikeAnim(period) {
    return {
      scene: [BIKE], period: period, label: 'Smooth, even pedal stroke',
      focus: ['thigh', 'shin'],
      fn: function (u) {
        var a = 180 - u * 360;
        var pN = Figure.add([BIKE.cx, BIKE.cy], a, 17), pF = Figure.add([BIKE.cx, BIKE.cy], a + 180, 17);
        var tilt = 8 * Math.sin(u * Math.PI * 2);
        return {
          r: [-28, -102], t: 150, hd: 18,
          lN: [0, 0, 98 + tilt], lF: [0, 0, 98 - tilt],
          ik: { fN: [pN[0] - 5, pN[1] - 7], fF: [pF[0] - 5, pF[1] - 7], hN: [BIKE.bx, BIKE.by], hF: [BIKE.bx - 2, BIKE.by + 1] },
          x: { crank: a }
        };
      }
    };
  }

  var FX = 60;
  function rowPose(hipX, t, hand) {
    return {
      r: [hipX, -32], t: t, hd: t > 180 ? -12 : 12,
      lN: [0, 0, 150], lF: [0, 0, 150],
      ik: { fN: [FX - 8, -26], fF: [FX - 9, -26], hN: hand, hF: [hand[0] - 1, hand[1] + 1] }
    };
  }
  var ROW_ANIM = {
    scene: [{ type: 'rower', fx: FX }],
    focus: ['thigh', 'torso', 'upper'],
    frames: [
      { d: 0.42, l: 'Legs drive', p: rowPose(FX - 60, 155, [FX + 6, -56]) },
      { d: 0.42, l: 'Lean back, arms pull', p: rowPose(FX - 89, 160, [FX - 22, -58]) },
      { d: 0.18, l: 'Finish', p: rowPose(FX - 91, 198, [FX - 86, -62]) },
      { d: 0.55, l: 'Arms away', p: rowPose(FX - 91, 198, [FX - 86, -62]) },
      { d: 0.75, l: 'Body over, slow recovery', p: rowPose(FX - 89, 160, [FX - 24, -57]) }
    ]
  };

  // ------------------------------------------------------------ kettlebell
  var swingTop = stand({ t: 184, aN: [86, 86], kb: 90, hd: -4 });
  var swingBot = stand({ t: 112, lN: [26, -8], aN: [-22, -22], kb: -22, hd: 22 });

  var gobTop = stand({ aN: [16, 158], kb: 0 });
  var gobBot = stand({ t: 150, lN: [100, -35], aN: [12, 152], kb: 0, hd: 10 });

  var dlTop = stand({ aN: [0, 0], kb: 0 });
  var dlBot = stand({ t: 120, lN: [75, -25], aN: [-10, -10], kb: 0, hd: 22 });

  var pressRack = stand({ aN: [22, 172], aF: [8, 30], kb: 210 });
  var pressTop = stand({ t: 182, aN: [178, 178], aF: [8, 30], kb: 200 });

  // ------------------------------------------------------------ dumbbells
  var BENCH_FLAT = { type: 'bench', x: -62, len: 118 };
  function benchPose(arms) {
    return { r: [20, -58], t: -90, aN: arms, aF: [arms[0] - 4, arms[1] - 4], lN: [0, 0, 90], ik: { fN: [64, -6], fF: [60, -6] } };
  }

  var BENCH_INC = { type: 'bench', x: 0, incline: 42 };
  function incPose(arms) {
    return { r: [8, -56], t: 228, hd: -20, aN: arms, aF: [arms[0] - 3, arms[1] - 3], ik: { fN: [62, -6], fF: [58, -6] } };
  }

  var BENCH_SEAT = { type: 'bench', x: 0, incline: 80 };
  function seatPose(arms) {
    return { r: [10, -57], t: 188, hd: -8, aN: arms, aF: [arms[0] - 3, arms[1] - 3], ik: { fN: [58, -6], fF: [54, -6] } };
  }

  var BENCH_ROW = { type: 'bench', x: -46, len: 130, h: 40 };
  function rowDb(arm) {
    return {
      r: [10, -92], t: 98, hd: -12, aN: arm, aF: [-3, -3],
      lF: [0, -90, -150], ik: { fN: [16, -6] }
    };
  }

  var rdlTop = stand({ aN: [0, 0], hd: 0 });
  var rdlBot = stand({ t: 110, lN: [40, 0], aN: [-10, -10], hd: 25 });

  var BSS_BENCH = { type: 'bench', x: -150, len: 108 };
  function bss(hip) { return { r: hip, t: 176, aN: [0, 0], lF: [0, 0, -105], ik: { fN: [20, -6], fF: [-54, -56] } }; }

  var thrustBench = { type: 'bench', x: -130, len: 112, h: 40 };
  function thrust(t, hand) {
    return { t: t, hd: t < -100 ? 25 : 40, pin: ['sho', -24, -54], lN: [0, 0, 90], ik: { fN: [70, -6], fF: [66, -6], hN: hand, hF: [hand[0] - 3, hand[1]] } };
  }

  var STEP_BENCH = { type: 'bench', x: 22, len: 115 };
  function step(hip, far) { return { r: hip, t: 176, aN: [0, 0], ik: { fN: [44, -52], fF: far } }; }

  // ------------------------------------------------------------ kinesis
  var K_BEHIND = { type: 'kinesis', x: -70, pulleys: [[-50, -138]] };
  var K_FRONT_MID = { type: 'kinesis', x: 110, pulleys: [[92, -112]] };
  var K_FRONT_HIGH = { type: 'kinesis', x: 100, pulleys: [[82, -205]] };
  var K_FRONT_FACE = { type: 'kinesis', x: 110, pulleys: [[92, -150]] };
  var K_PUSH = { type: 'kinesis', x: 70, pulleys: [[52, -200]] };
  var K_LOW_BEHIND = { type: 'kinesis', x: -110, pulleys: [[-92, -20]] };
  var K_HIGH_BEHIND = { type: 'kinesis', x: -80, pulleys: [[-62, -205]] };
  function cab(k) { return [{ from: k.pulleys[0], to: ['hN', 'hF'] }]; }

  function split(x) { return m({ t: 174, lN: [12, -4], lF: [-16, -16, 62], aN: [0, 0], pin: ['fN', 16, -6] }, x); }
  function kneel(x) {
    return m({ r: [0, -53], t: 178, lN: [90, 0, 70], lF: [0, -90, -160] }, x);
  }

  // ------------------------------------------------------------ wall
  var WALL = { type: 'wall', x: -48, y: -226, bx: 46 };
  var BAR = ['hN', 30, -226];
  function hang(x) { return m({ t: 180, hd: -14, aN: [180, 180], aF: [178, 178], lN: [4, 0, 50], pin: BAR }, x); }

  // ------------------------------------------------------------ ab & back-extension bench
  var TRIA_BACK = { type: 'tria_back', x: 2, y: -86 };
  function backExt(t) {
    return { r: [-2, -84], t: t, hd: t > 100 ? 10 : 25, aN: [t - 160, t - 30], lN: [0, 0, -30], ik: { fN: [-56, -18], fF: [-58, -18] } };
  }

  var TRIA_ABS = { type: 'tria_abs', x: -40 };
  function situp(t) {
    return { r: [12, -57], t: t, hd: -18, aN: [t - 160, t - 30], lN: [0, 0, 60], ik: { fN: [68, -64], fF: [66, -64] } };
  }

  // ------------------------------------------------------------ floor
  var PUSH_FEET = ['fN', -85, -6];
  function pushPose(t, hand) {
    return { t: t, hd: -6, lN: [t - 180, t - 180, 15], pin: PUSH_FEET, ik: { hN: hand, hF: [hand[0] - 3, hand[1]] } };
  }

  function deadBug(aN, aF, lN, lF) { return { r: [0, -13], t: -90, hd: 0, aN: aN, aF: aF, lN: lN, lF: lF }; }
  var DB_REST_ARM = [180, 180], DB_REST_LEG = [180, 90, 170];

  function quad(aN, aF, lN, lF) { return { r: [0, -51], t: 99, hd: -20, aN: aN, aF: aF, lN: lN, lF: lF }; }

  // ------------------------------------------------------------ bodyweight-only helpers
  // knee push-up: knees pinned on the floor, thighs in line with the torso, hands fixed
  function kneePush(t) { return { t: t, hd: -6, pin: ['kN', -40, -6], lN: [t - 180, -115, -100], ik: { hN: [46, -5], hF: [43, -5] } }; }
  // pike push-up: feet and hands fixed, hips high; smaller t = head closer to the floor
  function pike(k) {
    return { r: [-20 + 12 * k, -84 + 10 * k], t: 60 - 30 * k, hd: -16 * k, lN: [0, 0, 90], ik: { hN: [10, -5], hF: [7, -5], fN: [-64, -6], fF: [-66, -6] } };
  }
  // face down on the floor; chest / legs / arms lift 0..1
  function prone(chest, legs, arms) {
    var a = arms === undefined ? legs : arms;
    return { r: [0, -11], t: 90 + 9 * chest, hd: -3 * chest, aN: [90 + 18 * a, 90 + 18 * a], aF: [88 + 18 * a, 88 + 18 * a], lN: [-90 - 9 * legs, -90 - 9 * legs, -80 - 6 * legs], lF: [-90 - 8 * legs, -90 - 8 * legs, -80 - 6 * legs] };
  }
  // side plank seen from the front: forearm on the floor, top arm to the ceiling
  function sidePlank(t, l) { return { t: t, hd: -6, lN: [l, l, 15], aN: [-2, 92], aF: [176, 178], pin: PUSH_FEET }; }
  var WALL_PLAIN = { type: 'wallplain', x: -32 };
  function wallSit(k, breathe) {
    return { r: [-21, -82 + 32 * k], t: breathe ? 179 : 180, hd: breathe ? -2 : 0, aN: [24, 156], aF: [20, 152], ik: { fN: [24, -6], fF: [21, -6] } };
  }
  function hollow(k) { return { r: [0, -13], t: -103 - 2 * k, hd: -20, aN: [-114 - 2 * k, -114 - 2 * k], aF: [-112 - 2 * k, -112 - 2 * k], lN: [101 + k, 101 + k, 112], lF: [101 + k, 101 + k, 112] }; }
  // single-leg bridge: the free leg stays straight – level with the working thigh at the bottom, in line with the body at the top
  function slBridge(k) {
    var t = k ? -62 : -88;
    var p = { t: t, hd: k ? -26 : 0, pin: ['sho', -42, -11], aN: [k ? 96 : 92, k ? 96 : 92], lN: [0, 0, 80], ik: { fN: [52, -6] } };
    var la = k ? t + 180 : Figure.solve(p).ang.lN[0];
    p.lF = [la, la, la + 40];
    return p;
  }
  function seatFold(k) {
    return { r: [0, -11], t: k ? 116 : 174, hd: k ? 8 : 0, lN: [90, 90, 172], ik: k ? { hN: [84, -16], hF: [81, -16] } : { hN: [38, -20], hF: [35, -20] } };
  }


  // ------------------------------------------------------------ hybrid race substitutes
  // Standing heavy climb on the bike (sled-push substitute): hips out of the saddle, bob with the stroke
  function bikeStandAnim(period) {
    return {
      scene: [BIKE], period: period, label: 'Out of the saddle, heavy – drive',
      focus: ['thigh', 'glute'],
      fn: function (u) {
        var a = 180 - u * 360;
        var pN = Figure.add([BIKE.cx, BIKE.cy], a, 17), pF = Figure.add([BIKE.cx, BIKE.cy], a + 180, 17);
        var bob = Math.abs(Math.cos(u * Math.PI * 2));
        return {
          r: [3 + 2 * Math.sin(u * Math.PI * 4), -115 + 9 * bob], t: 136, hd: 28,
          lN: [0, 0, 100], lF: [0, 0, 100],
          ik: { fN: [pN[0] - 5, pN[1] - 7], fF: [pF[0] - 5, pF[1] - 7], hN: [BIKE.bx + 2, BIKE.by + 2], hF: [BIKE.bx, BIKE.by + 3] },
          x: { crank: a }
        };
      }
    };
  }

  // Farmer's carry: walking cycle in place (treadmill view), bells hang at the sides
  var carryAnim = {
    hold: { N: 'kb', F: 'kb' }, focus: ['fore', 'torso', 'glute'], period: 1.1, label: 'Walk tall, shoulders down',
    fn: function (u) {
      function foot(ph) {
        ph = ((ph % 1) + 1) % 1;
        if (ph < 0.6) { var k = ph / 0.6; return [22 - 44 * k, -6]; }
        var q = (ph - 0.6) / 0.4; return [-22 + 44 * q, -6 - 14 * Math.sin(q * Math.PI)];
      }
      var bob = 2 * Math.cos(u * Math.PI * 4);
      var sw = 6 * Math.sin(u * Math.PI * 2);
      return {
        r: [0, -91 + bob], t: 182, hd: -4, aN: [sw * 0.4, sw * 0.4], aF: [-sw * 0.4, -sw * 0.4], kb: 0,
        lN: [0, 0, 72], lF: [0, 0, 72],
        ik: { fN: foot(u), fF: foot(u + 0.5) }
      };
    }
  };

  function lungeP(hip, fN, fF) {
    return { r: hip, t: 178, hd: -4, aN: [16, 158], kb: 0, lN: [0, 0, fN[0] < 0 ? 20 : 72], lF: [0, 0, fF[0] < 0 ? 20 : 72], ik: { fN: fN, fF: fF } };
  }

  var thrRack = stand({ aN: [22, 174] });
  var thrBot = stand({ t: 152, lN: [100, -35], aN: [26, 176], hd: 8 });
  var thrTop = stand({ t: 182, aN: [178, 178] });

  var K_SKI = { type: 'kinesis', x: 110, pulleys: [[92, -205]] };
  var K_SLED = { type: 'kinesis', x: 120, pulleys: [[102, -70]] };
  function sled(aN, aF) { return { t: 196, hd: -14, lN: [34, -12, 74], lF: [10, -26, 50], aN: aN, aF: aF, pin: ['fN', 26, -6] }; }


  // ------------------------------------------------------------ extra equipment (profiles can own more than the home gym)
  var TREAD = { type: 'treadmill', x0: -64, x1: 70 };
  function runFoot(ph, stride, base, lift) {
    ph = ((ph % 1) + 1) % 1;
    if (ph < 0.42) { var k = ph / 0.42; return [stride - 2 * stride * k, base]; }
    var q = (ph - 0.42) / 0.58; return [-stride + 2 * stride * q, base - lift * Math.sin(q * Math.PI)];
  }
  var treadAnim = {
    scene: [TREAD], focus: ['thigh', 'shin'], period: 0.72, label: 'Short quick steps, land under hips',
    fn: function (u) {
      var sw = Math.sin(u * Math.PI * 2);
      return {
        r: [0, -107 + 3 * Math.cos(u * Math.PI * 4)], t: 173, hd: -6,
        aN: [-34 * sw, -34 * sw + 95], aF: [34 * sw, 34 * sw + 95],
        lN: [0, 0, 78], lF: [0, 0, 78],
        ik: { fN: runFoot(u, 26, -24, 30), fF: runFoot(u + 0.5, 26, -24, 30) },
        x: { belt: u * 144, bx0: TREAD.x0 }
      };
    }
  };

  var SKI = { type: 'skierg', x: 96 };
  var SLED_P = { type: 'sled', x: 30 };
  var sledPushAnim = {
    scene: [SLED_P], focus: ['thigh', 'glute'], period: 1.3, label: 'Stay low, drive with full feet',
    fn: function (u) {
      return {
        r: [-48, -80 + 2 * Math.cos(u * Math.PI * 4)], t: 124, hd: 30,
        lN: [0, 0, 60], lF: [0, 0, 60],
        ik: { fN: runFoot(u, 32, -6, 16).map(function (v, i) { return i ? v : v - 36; }), fF: runFoot(u + 0.5, 32, -6, 16).map(function (v, i) { return i ? v : v - 36; }), hN: [16, -110], hF: [14, -110] },
        x: { mv: u * 80 }
      };
    }
  };
  var SLED_R = { type: 'sled', x: 120, rope: true };

  var TARGET = { type: 'target', x: 74, y: -232 };
  function wb(p, ball) { var o = stand(p); if (ball) o.x = { ball: ball }; return o; }

  var RACK = { type: 'rack', x: -46, y: -150 };
  var BOX = { type: 'box', x: 36, w: 56, h: 52 };
  var ANCHOR_MID = { type: 'anchor', x: 104, y: -112 };
  var ANCHOR_HIGH = { type: 'anchor', x: 64, y: -200 };
  function band(a) { return [{ from: [a.x, a.y], to: ['hN', 'hF'], cls: 'p-band', w: 4 }]; }

  // ------------------------------------------------------------ more equipment: geometry helpers
  // Poses below are solved at load time with the figure engine, so hands stay on straps / bars / balls
  // and strap lengths stay constant through the movement.
  var RD = Math.PI / 180;
  function dv(a) { return [Math.sin(a * RD), Math.cos(a * RD)]; }
  function pa(p, a, l) { var v = dv(a); return [p[0] + v[0] * l, p[1] + v[1] * l]; }
  function dst(a, b) { return Math.hypot(b[0] - a[0], b[1] - a[1]); }
  function sol(p) { return Figure.solve(p); }
  function hmid(p) { var j = sol(p); return [(j.hN[0] + j.hF[0]) / 2, (j.hN[1] + j.hF[1]) / 2]; }
  function bisect(f, lo, hi) {
    var flo = f(lo);
    for (var i = 0; i < 50; i++) { var md = (lo + hi) / 2, fm = f(md); if ((fm < 0) === (flo < 0)) { lo = md; flo = fm; } else hi = md; }
    return (lo + hi) / 2;
  }
  // intersection of circle(c1, r1) and circle(c2, r2); pick 'hi' (upper), 'lo' (lower) or 'fwd' (larger x)
  function meet(c1, r1, c2, r2, pick) {
    var dx = c2[0] - c1[0], dy = c2[1] - c1[1], L0 = Math.hypot(dx, dy), ux = dx / L0, uy = dy / L0;
    var D = Math.max(Math.abs(r1 - r2) + 0.01, Math.min(r1 + r2 - 0.01, L0));
    var a = (r1 * r1 - r2 * r2 + D * D) / (2 * D), h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
    var px = c1[0] + ux * a, py = c1[1] + uy * a;
    var A = [px - uy * h, py + ux * h], B = [px + uy * h, py - ux * h];
    if (pick === 'fwd') return A[0] > B[0] ? A : B;
    return (pick === 'hi') === (A[1] < B[1]) ? A : B;
  }
  function withHands(p, hN, dF) { p.ik = m(p.ik || {}, { hN: hN, hF: [hN[0] - (dF || 2), hN[1] + 1] }); return p; }

  // --- suspension trainer: body is a straight plank pivoting on the feet
  function plankBody(t, foot, x) { return m({ t: t, hd: 0, lN: [t - 180, t - 180, foot], pin: ['fN', 0, -6] }, x || {}); }
  var SUSP_FRONT = { type: 'susp', x: 14, y: -224 };
  var SUSP_BACK = { type: 'susp', x: -70, y: -224 };
  var SUSP_SQ = { type: 'susp', x: 118, y: -224 };
  function strap(o) { return [{ from: [o.x, o.y], to: ['hN', 'hF'], cls: 'p-strap', w: 3.2, strap: true }]; }
  // inverted row: arms long toward the anchor -> chest to the hands, strap length unchanged
  var suspRow = (function () {
    var A = [SUSP_FRONT.x, SUSP_FRONT.y];
    function reach(t) { var j = sol(plankBody(t, 140)), u = dst(j.sho, A); return [j.sho[0] + (A[0] - j.sho[0]) * 55 / u, j.sho[1] + (A[1] - j.sho[1]) * 55 / u]; }
    function chest(t) { var j = sol(plankBody(t, 140)); return pa(pa(j.sho, t + 180, 14), t - 90, 12); }
    var t0 = 232, Ls = dst(A, reach(t0));
    var t1 = bisect(function (t) { return dst(A, chest(t)) - Ls; }, 182, t0);
    return {
      long: withHands(plankBody(t0, 140, { hd: -10 }), reach(t0)),
      pull: withHands(plankBody(t1, 140, { hd: -8 }), chest(t1))
    };
  })();
  // chest press facing away: arms forward at chest height -> hands by the chest, body leans further in
  var suspPress = (function () {
    var A = [SUSP_BACK.x, SUSP_BACK.y];
    function top(t) { var j = sol(plankBody(t, 90)); return pa(j.sho, t - 82, 55); }
    function low(t) { var j = sol(plankBody(t, 90)); return pa(pa(j.sho, t + 180, 12), t - 90, 16); }
    var t0 = 146, Ls = dst(A, top(t0));
    var t1 = bisect(function (t) { return dst(A, low(t)) - Ls; }, 100, t0);
    return {
      top: withHands(plankBody(t0, 90, { hd: -6 }), top(t0)),
      low: withHands(plankBody(t1, 90, { hd: -6, bd: { aN: 1, aF: 1 } }), low(t1))
    };
  })();
  // fallout (anti-extension): arms sweep overhead while the body leans forward on the straps
  var suspFall = (function () {
    var A = [SUSP_BACK.x, SUSP_BACK.y];
    var t0 = 166, j0 = sol(plankBody(t0, 78)), h0 = pa(j0.sho, 62, 56), Ls = dst(A, h0);
    var t1 = 128, j1 = sol(plankBody(t1, 78)), h1 = meet(j1.sho, 56, A, Ls, 'fwd');
    return { up: withHands(plankBody(t0, 78, { hd: -6 }), h0), out: withHands(plankBody(t1, 78, { hd: -10 }), h1) };
  })();
  // assisted squat: hands on the handles, straps stay taut while the hips sit back
  var suspSquat = (function () {
    var A = [SUSP_SQ.x, SUSP_SQ.y];
    var top = stand({ t: 178, hd: -4 }), jt = sol(top), ht = [jt.sho[0] + 34, jt.sho[1] + 16], Ls = dst(A, ht);
    var bot = stand({ t: 160, lN: [104, -40, 70], hd: 4 }), jb = sol(bot), hb = meet(jb.sho, 55, A, Ls, 'hi');
    return { top: withHands(top, ht), bot: withHands(bot, hb) };
  })();

  // --- ab wheel: knees pinned, the wheel rolls along the floor under the hands
  function rollout(th, t, ext) {
    var p = { t: t, hd: -4, lN: [th, -90, -94], pin: ['kN', 0, -8] }, j = sol(p);
    var dy = -9 - j.sho[1];
    var hx = ext ? j.sho[0] + Math.sqrt(Math.max(0, 56 * 56 - dy * dy)) : j.sho[0] + 6;
    return withHands(p, [hx, -9], 1);
  }

  // --- slam ball: ball positions solved from the hands, floor contact at y = -13
  // every key frame carries explicit hand targets so poses blend cleanly (ik and joint angles never mix)
  function slam(p, ball) {
    if (!p.ik || !p.ik.hN) { var j = sol(p); p.ik = m(p.ik || {}, { hN: j.hN, hF: j.hF }); }
    p.x = { sball: ball || [hmid(p)[0] + 2, hmid(p)[1] - 6] };
    return p;
  }

  // rotational slam: front foot pinned, back foot pivots (heel up) as the hips turn into the slam
  function rotSlamFrames(front, tag) {
    var back = front === 'N' ? 'F' : 'N';
    function P(x, ball, heel) {
      var o = { t: x.t, hd: x.hd, pin: ['f' + front, 0, -6] };
      o['l' + front] = x.lf; o['l' + back] = [0, 0, heel ? 56 : 72];
      if (x.a) { o.aN = x.a; o.aF = [x.a[0] - 2, x.a[1] - 2]; }
      o.ik = m(x.ik || {}, {}); o.ik['f' + back] = [-34, heel ? -10 : -6];
      return slam(o, ball);
    }
    return [
      { d: 0.3, l: 'Ball overhead' + tag, p: P({ t: 186, hd: -10, lf: [6, 0, 70], a: [186, 182] }, null, false) },
      { d: 0.12, l: 'Rotate & SLAM', p: P({ t: 134, hd: 14, lf: [44, -14, 76], a: [112, 124] }, null, true) },
      { d: 0.3, l: 'Outside the front foot', p: P({ t: 114, hd: 20, lf: [56, -24, 76], ik: { hN: [50, -34], hF: [52, -33] } }, [54, -13], true) },
      { d: 0.5, l: 'Pick up, flat back', p: P({ t: 126, hd: 18, lf: [96, -38, 70], ik: { hN: [50, -16], hF: [58, -15] } }, [54, -13], false) }
    ];
  }
  // --- landmine: bar end follows an arc around the floor pivot
  function lmArc(P, L, y) { var s2 = (P[1] - y) / L; return [P[0] - L * Math.sqrt(1 - s2 * s2), y]; }
  var lmPress = (function () {
    var rack = split({ t: 172, hd: -4, aF: [4, 20] }), j0 = sol(rack);
    var h0 = [j0.sho[0] + 14, j0.sho[1] + 10], L = 210;
    var phi = Math.asin((-9 - h0[1]) / L), P = [h0[0] + L * Math.cos(phi), -9];
    var lock = split({ t: 166, hd: -8, aF: [4, 20] }), j1 = sol(lock), h1 = meet(j1.sho, 55, P, L, 'hi');
    rack.ik = { hN: h0 }; lock.ik = { hN: h1 };
    return { rack: rack, lock: lock, scene: { type: 'landmine', x: P[0], grip: 'hN', ext: 10, plate: -24 } };
  })();
  var lmRow = (function () {
    var hang = stand({ t: 124, lN: [42, -16, 72], hd: 22 }), j0 = sol(hang), h0 = [j0.sho[0] + 4, j0.sho[1] + 55], L = 200;
    var phi = Math.asin((-9 - h0[1]) / L), P = [h0[0] - L * Math.cos(phi), -9];
    var top = stand({ t: 128, lN: [42, -16, 72], hd: 20 }), j1 = sol(top), h1 = meet(j1.sho, 24, P, L, 'lo');
    withHands(hang, h0, 3); withHands(top, h1, 3); top.bd = { aN: 1, aF: 1 };
    return { hang: hang, top: top, scene: { type: 'landmine', x: P[0], grip: 'mid', ext: 26, plate: 14, pr: 19 } };
  })();

  // --- foam roller: roller centre on the floor at y = -8; the body rolls over it, the roller travels half as far
  function supineRoll(c0, f0, f, t, footX) {
    var nrm = function (tt) { var a = dv(tt + 90); return a[1] < 0 ? a : dv(tt - 90); };
    var cx = c0 - 50 * dv(t)[0] * (f - f0), C = [cx, -8], rt = 11.6 + 2 * f, n = nrm(t);
    var S = [C[0] + n[0] * (8 + rt), C[1] + n[1] * (8 + rt)], hip = pa(S, t, -f * 50);
    var p = { r: hip, t: t, hd: -16, lN: [0, 0, 92], ik: { fN: [footX, -6], fF: [footX - 3, -6] }, x: { roll: C } };
    var j = sol(p), hd = pa(j.head, t + 90, 0);
    p.ik.hN = [hd[0] + 2, hd[1] + 2]; p.ik.hF = [hd[0] + 4, hd[1] + 1];
    return p;
  }
  function proneRoll(c0, g0, g, shoY) {
    function off(t, gg) {
      var n = dv(t + 90)[1] > 0 ? dv(t + 90) : dv(t - 90), rth = 11 - 3.6 * gg + 1;
      var P = pa([0, shoY], t, -(50 + 44 * gg));
      return [P[0] + n[0] * (rth + 8), P[1] + n[1] * (rth + 8)];
    }
    function tOf(gg) { return bisect(function (t) { return off(t, gg)[1] + 8; }, 92, 140); }
    var t = tOf(g), o = off(t, g), o0 = off(tOf(g0), g0);
    var cx = c0 - (o[0] - o0[0]), sho = [cx - o[0], shoY];
    var a = Math.acos(Math.min(1, (-5 - shoY) / 30)) / RD;
    return { r: pa(sho, t, -50), t: t, hd: -8, aN: [a, 90], aF: [a - 2, 88], lN: [t - 180, t - 180, t - 186], x: { roll: [cx, -8] } };
  }

  // --- dip station
  var DIPS = { type: 'dipbars', x0: -64, x1: 64, y: -132 };
  function dip(t, aN, lN) { return { t: t, hd: -8, aN: aN, aF: [aN[0] - 2, aN[1]], lN: lN, lF: [lN[0] - 6, lN[1] - 4, lN[2]], pin: ['hN', 0, DIPS.y - 1] }; }

  // --- battle ropes
  var ROPE_ANCHOR = { type: 'ropeanchor', x: 196 };

  // --- air bike: pedals + arm levers linked
  var AIR = { type: 'airbike', sx: -28, sy: -96, cx: 0, cy: -32, fx: 82, fy: -66, fr: 34, px: 28, py: -42, pa: 184, pl: 76, sw: 11 };
  function airAnim(period, label) {
    return {
      scene: [AIR], period: period, label: label, focus: ['thigh', 'upper'],
      fn: function (u) {
        var a = 180 - u * 360;
        var pN = Figure.add([AIR.cx, AIR.cy], a, 17), pF = Figure.add([AIR.cx, AIR.cy], a + 180, 17);
        var tilt = 8 * Math.sin(u * Math.PI * 2);
        return {
          r: [-28, -102], t: 154 + 2 * Math.sin(u * Math.PI * 4), hd: 16,
          lN: [0, 0, 98 + tilt], lF: [0, 0, 98 - tilt],
          ik: { fN: [pN[0] - 5, pN[1] - 7], fF: [pF[0] - 5, pF[1] - 7], hN: Figure.airGrip(AIR, a, 'N'), hF: Figure.airGrip(AIR, a, 'F') },
          x: { crank: a }
        };
      }
    };
  }

  // ======================================================================
  var LIST = [
    // ---------------------------------------------------------------- CARDIO
    {
      id: 'bike_z2', name: 'Bike – warm-up / Zone 2', equip: ['bike'], type: 'cardio', unit: 'min',
      muscles: 'Cardio, legs', tempo: '80–90 RPM',
      cues: ['Saddle at hip height – slight knee bend at the bottom', 'Shoulders relaxed, torso leaning ~30°', 'Pace: you can still talk in full sentences (RPE 4–5)'],
      mistakes: ['Saddle too low (knee pain)', 'Hips rocking on the saddle'],
      anim: bikeAnim(0.75)
    },
    {
      id: 'bike_hiit', name: 'Bike – intervals', equip: ['bike'], type: 'cardio', unit: 'min',
      muscles: 'Cardio, legs', tempo: '100+ RPM on sprints',
      cues: ['Sprint 20 s all-out, 40 s easy', 'Add resistance so cadence stays under 110', 'Quiet upper body, power from the hips'],
      mistakes: ['Too little resistance – spinning with no force', 'Holding your breath'],
      anim: bikeAnim(0.55)
    },
    {
      id: 'row_steady', name: 'Rowing – technique / steady', equip: ['rower'], type: 'cardio', unit: 'min',
      muscles: 'Legs, back, arms', tempo: '20–24 strokes/min',
      cues: ['Sequence: LEGS → BODY → ARMS, return ARMS → BODY → LEGS', '1:2 ratio – fast drive, slow recovery', 'Shins vertical at the catch, back flat'],
      mistakes: ['Pulling with the arms before the legs', 'Leaning back too far at the finish'],
      anim: ROW_ANIM, speed: 0.95
    },
    {
      id: 'row_hiit', name: 'Rowing – intervals', equip: ['rower'], type: 'cardio', unit: 'min',
      muscles: 'Full body, heart', tempo: '26–30 strokes/min on intervals',
      cues: ['30 s hard, 30 s easy', 'Power comes from the leg drive, not the arms', 'Watch your 500 m split – keep it steady across sets'],
      mistakes: ['High stroke rate with no power', 'Rounding the back at the catch'],
      anim: ROW_ANIM, speed: 1.25
    },

    // ------------------------------------------------------------ KETTLEBELL
    {
      id: 'kb_swing', name: 'Kettlebell swing', equip: ['kb'], type: 'strength', unit: 'kg', load: 16, inc: 4,
      muscles: 'Glutes, hamstrings, core', tempo: 'Explosive',
      cues: ['Hinge, DON\'T squat – hips go back', 'Explosive hip drive, glutes squeezed at the top', 'Arms are just ropes – KB to chest height', 'Exhale at the top, abs braced'],
      mistakes: ['Lifting with the arms', 'Rounded back at the bottom', 'Leaning back at the top'],
      anim: {
        scene: [], hold: { N: 'kb' }, focus: ['glute', 'thigh'],
        frames: [
          { d: 0.55, l: 'Hinge – hips back', p: swingTop },
          { d: 0.12, l: 'Bottom', p: swingBot },
          { d: 0.5, l: 'HIP DRIVE', p: swingBot },
          { d: 0.15, l: 'Top – squeeze glutes', p: swingTop }
        ]
      }
    },
    {
      id: 'kb_goblet_squat', name: 'Goblet squat', equip: ['kb'], type: 'strength', unit: 'kg', load: 16, inc: 4,
      muscles: 'Quads, glutes, core', tempo: '3-1-1',
      cues: ['KB at the chest, elbows down', 'Knees track over toes, heels stay down', 'Lower for 3 s, brief pause at the bottom', 'Chest up'],
      mistakes: ['Heels lifting', 'Knees caving in', 'Shallow squat'],
      anim: {
        hold: { N: 'kb' }, focus: ['thigh', 'glute'],
        frames: [
          { d: 2.2, l: 'Lower for 3 s', p: gobTop },
          { d: 0.5, l: 'Pause at bottom', p: gobBot },
          { d: 1.0, l: 'Drive up', p: gobBot },
          { d: 0.6, l: 'Stand tall', p: gobTop }
        ]
      }
    },
    {
      id: 'kb_deadlift', name: 'Kettlebell deadlift', equip: ['kb'], type: 'strength', unit: 'kg', load: 24, inc: 4,
      muscles: 'Glutes, hamstrings, back', tempo: '2-0-1',
      cues: ['KB between the feet, feet slightly wider than hips', 'Hips back, neutral spine, shoulder blades "in your back pockets"', 'Push the floor away and lock out the hips'],
      mistakes: ['Rounded back', 'Pulling with the arms'],
      anim: {
        hold: { N: 'kb' }, focus: ['glute', 'thigh', 'torso'],
        frames: [
          { d: 1.6, l: 'Lower – hips back', p: dlTop },
          { d: 0.4, l: 'Brace your back', p: dlBot },
          { d: 1.0, l: 'Push the floor away', p: dlBot },
          { d: 0.6, l: 'Top', p: dlTop }
        ]
      }
    },
    {
      id: 'kb_press', name: 'Single-arm kettlebell overhead press', equip: ['kb'], type: 'strength', unit: 'kg', load: 12, inc: 4, perSide: true,
      muscles: 'Shoulders, triceps, core', tempo: '1-1-2',
      cues: ['Start in the rack position – KB on the forearm, wrist straight', 'Squeeze glutes and abs, ribs down', 'Press straight up, biceps by the ear'],
      mistakes: ['Excessive lower-back arch', 'Bent wrist'],
      anim: {
        hold: { N: 'kb' }, focus: ['upper', 'fore'],
        frames: [
          { d: 0.9, l: 'Drive up', p: pressRack },
          { d: 0.5, l: 'Lock out', p: pressTop },
          { d: 1.6, l: 'Controlled down', p: pressTop },
          { d: 0.4, l: 'Rack', p: pressRack }
        ]
      }
    },

    // ------------------------------------------------------------ DUMBBELLS
    {
      id: 'db_bench', name: 'Dumbbell bench press', equip: ['db', 'bench'], type: 'strength', unit: 'kg', load: 16, inc: 2,
      muscles: 'Chest, triceps, front delts', tempo: '3-1-1',
      cues: ['Shoulder blades back and down, slight arch', 'Elbows ~45° from the torso', 'Lower for 3 s to chest level, press up and slightly together'],
      mistakes: ['Elbows flared out to 90°', 'Bouncing the weights off the chest'],
      anim: {
        scene: [BENCH_FLAT], hold: { N: 'db', F: 'db' }, focus: ['torso', 'upper'],
        frames: [
          { d: 2.2, l: 'Lower for 3 s', p: benchPose([172, 172]) },
          { d: 0.4, l: 'Pause', p: benchPose([62, 178]) },
          { d: 0.9, l: 'Press', p: benchPose([62, 178]) },
          { d: 0.5, l: 'Top', p: benchPose([172, 172]) }
        ]
      }
    },
    {
      id: 'db_incline', name: 'Incline dumbbell press', equip: ['db', 'bench'], type: 'strength', unit: 'kg', load: 14, inc: 2,
      muscles: 'Upper chest, shoulders, triceps', tempo: '3-0-1',
      cues: ['Backrest at ~30–45°', 'Press straight up over the upper chest', 'Shoulder blades pinned to the bench'],
      mistakes: ['Incline too steep (turns into a shoulder press)', 'Hips lifting off the bench'],
      anim: {
        scene: [BENCH_INC], hold: { N: 'db', F: 'db' }, focus: ['torso', 'upper'],
        frames: [
          { d: 2.2, l: 'Lower', p: incPose([178, 178]) },
          { d: 0.3, l: 'Bottom', p: incPose([28, 182]) },
          { d: 0.9, l: 'Press', p: incPose([28, 182]) },
          { d: 0.5, l: 'Top', p: incPose([178, 178]) }
        ]
      }
    },
    {
      id: 'db_row', name: 'Single-arm dumbbell row', equip: ['db', 'bench'], type: 'strength', unit: 'kg', load: 20, inc: 2, perSide: true,
      muscles: 'Lats, rhomboids, biceps', tempo: '1-1-2',
      cues: ['Knee and hand on the bench, back flat as a table', 'Drive the elbow toward the hip (not the shoulder)', 'Squeeze the shoulder blade at the top, then lower slowly'],
      mistakes: ['Twisting the torso', 'Pulling with the biceps'],
      anim: {
        scene: [BENCH_ROW], hold: { N: 'db' }, focus: ['torso', 'upper'],
        frames: [
          { d: 0.9, l: 'Drive elbow to hip', p: rowDb([0, 0]) },
          { d: 0.5, l: 'Squeeze shoulder blade', p: rowDb([-100, 10]) },
          { d: 1.5, l: 'Controlled down', p: rowDb([-100, 10]) },
          { d: 0.3, l: 'Extend', p: rowDb([0, 0]) }
        ]
      }
    },
    {
      id: 'db_rdl', name: 'Dumbbell Romanian deadlift', equip: ['db'], type: 'strength', unit: 'kg', load: 20, inc: 2,
      muscles: 'Hamstrings, glutes, back', tempo: '3-0-1',
      cues: ['Knees slightly bent and locked in place', 'Weights slide down the thighs, hips go back', 'Lower to a hamstring stretch (below the knees), then drive the hips forward'],
      mistakes: ['Squatting instead of hinging', 'Rounded back', 'Weights drifting away from the legs'],
      anim: {
        hold: { N: 'db', F: 'db' }, focus: ['thigh', 'glute'],
        frames: [
          { d: 2.4, l: 'Hips back for 3 s', p: rdlTop },
          { d: 0.3, l: 'Stretch', p: rdlBot },
          { d: 1.0, l: 'Hips forward', p: rdlBot },
          { d: 0.5, l: 'Top – squeeze', p: rdlTop }
        ]
      }
    },
    {
      id: 'db_bulgarian', name: 'Bulgarian split squat', equip: ['db', 'bench'], type: 'strength', unit: 'kg', load: 10, inc: 2, perSide: true,
      muscles: 'Quads, glutes', tempo: '2-1-1',
      cues: ['Rear foot laces-down on the bench', 'Drop straight down – back knee toward the floor', 'Weight on the front heel, torso slightly forward'],
      mistakes: ['Front foot too close to the bench', 'Knee caving in'],
      anim: {
        scene: [BSS_BENCH], hold: { N: 'db', F: 'db' }, focus: ['thigh', 'glute'],
        frames: [
          { d: 1.8, l: 'Lower', p: bss([-12, -86]) },
          { d: 0.4, l: 'Bottom', p: bss([-24, -52]) },
          { d: 1.0, l: 'Drive through the heel', p: bss([-24, -52]) },
          { d: 0.4, l: 'Up', p: bss([-12, -86]) }
        ]
      }
    },
    {
      id: 'db_shoulder_press', name: 'Seated dumbbell shoulder press', equip: ['db', 'bench'], type: 'strength', unit: 'kg', load: 12, inc: 2,
      muscles: 'Shoulders, triceps', tempo: '2-0-1',
      cues: ['Backrest near upright, back against the pad', 'Dumbbells start at ear height', 'Press up and slightly in, don\'t snap the lockout'],
      mistakes: ['Back coming off the pad', 'Partial range of motion'],
      anim: {
        scene: [BENCH_SEAT], hold: { N: 'db', F: 'db' }, focus: ['upper'],
        frames: [
          { d: 0.9, l: 'Press', p: seatPose([22, 176]) },
          { d: 0.4, l: 'Top', p: seatPose([176, 178]) },
          { d: 1.8, l: 'Controlled down', p: seatPose([176, 178]) },
          { d: 0.3, l: 'Bottom', p: seatPose([22, 176]) }
        ]
      }
    },
    {
      id: 'db_curl', name: 'Dumbbell biceps curl', equip: ['db'], type: 'strength', unit: 'kg', load: 10, inc: 2,
      muscles: 'Biceps, forearms', tempo: '1-1-2',
      cues: ['Elbows pinned to your sides, not drifting forward', 'Palms up at the top', 'Lower for 2 s to full extension'],
      mistakes: ['Swinging with the torso', 'Half reps'],
      anim: {
        hold: { N: 'db', F: 'db' }, focus: ['upper', 'fore'],
        frames: [
          { d: 0.9, l: 'Curl', p: stand({ aN: [2, 2] }) },
          { d: 0.5, l: 'Squeeze', p: stand({ aN: [10, 155] }) },
          { d: 1.8, l: 'Slowly down', p: stand({ aN: [10, 155] }) },
          { d: 0.2, l: '', p: stand({ aN: [2, 2] }) }
        ]
      }
    },
    {
      id: 'db_hip_thrust', name: 'Dumbbell hip thrust', equip: ['db', 'bench'], type: 'strength', unit: 'kg', load: 20, inc: 2,
      muscles: 'Glutes, hamstrings', tempo: '1-2-2',
      cues: ['Bottom of the shoulder blades on the bench edge', 'Shins vertical at the top, chin tucked', 'Squeeze glutes 2 s at the top – ribs down'],
      mistakes: ['Overarching the lower back', 'Pushing through the toes instead of the heels'],
      anim: {
        scene: [thrustBench], hold: { N: 'db' }, focus: ['glute', 'thigh'],
        frames: [
          { d: 0.9, l: 'Drive hips up', p: thrust(-128, [6, -40]) },
          { d: 1.2, l: 'Squeeze 2 s', p: thrust(-92, [16, -66]) },
          { d: 1.6, l: 'Slowly down', p: thrust(-92, [16, -66]) },
          { d: 0.2, l: '', p: thrust(-128, [6, -40]) }
        ]
      }
    },
    {
      id: 'db_stepup', name: 'Dumbbell step-up', equip: ['db', 'bench'], type: 'strength', unit: 'kg', load: 8, inc: 2, perSide: true,
      muscles: 'Quads, glutes, balance', tempo: '1-0-2',
      cues: ['Whole foot on the bench', 'Drive through the top heel – the bottom leg doesn\'t help', 'Step back down under control'],
      mistakes: ['Pushing off the bottom leg', 'Knee caving in'],
      anim: {
        scene: [STEP_BENCH], hold: { N: 'db', F: 'db' }, focus: ['thigh', 'glute'],
        frames: [
          { d: 1.1, l: 'Drive through the heel', p: step([0, -88], [-4, -6]) },
          { d: 0.4, l: 'Top', p: step([36, -134], [60, -96]) },
          { d: 0.8, l: 'Controlled down', p: step([36, -134], [60, -96]) },
          { d: 0.8, l: '', p: step([14, -106], [4, -26]) }
        ]
      }
    },

    // ------------------------------------------------------------ KINESIS
    {
      id: 'k_chest_press', name: 'Cable – standing chest press', equip: ['kinesis'], type: 'strength', unit: 'stopnja', load: 8, inc: 1,
      muscles: 'Chest, triceps, core', tempo: '1-1-2',
      cues: ['Back to the machine, split stance', 'Handles at chest height, elbows ~45°', 'Press forward and slightly in, torso stays still'],
      mistakes: ['Leaning forward', 'Shoulders shrugging toward the ears'],
      anim: {
        scene: [K_BEHIND], cables: cab(K_BEHIND), hold: { N: 'handle', F: 'handle' }, focus: ['torso', 'upper'],
        frames: [
          { d: 0.9, l: 'Press', p: split({ aN: [-68, 90] }) },
          { d: 0.4, l: 'Squeeze', p: split({ aN: [86, 88] }) },
          { d: 1.6, l: 'Controlled return', p: split({ aN: [86, 88] }) },
          { d: 0.2, l: '', p: split({ aN: [-68, 90] }) }
        ]
      }
    },
    {
      id: 'k_row', name: 'Cable – standing row', equip: ['kinesis'], type: 'strength', unit: 'stopnja', load: 8, inc: 1,
      muscles: 'Back, rear delts, biceps', tempo: '1-1-2',
      cues: ['Facing the machine, soft knees', 'Shoulder blades back first, then elbows', 'Squeeze 1 s at the end, chest proud'],
      mistakes: ['Rocking the torso back', 'Shoulders rolling forward at the end'],
      anim: {
        scene: [K_FRONT_MID], cables: cab(K_FRONT_MID), hold: { N: 'handle', F: 'handle' }, focus: ['torso', 'upper'],
        frames: [
          { d: 0.9, l: 'Pull', p: split({ t: 172, aN: [80, 82] }) },
          { d: 0.5, l: 'Squeeze shoulder blades', p: split({ t: 178, aN: [-62, 86] }) },
          { d: 1.6, l: 'Extend slowly', p: split({ t: 178, aN: [-62, 86] }) },
          { d: 0.2, l: '', p: split({ t: 172, aN: [80, 82] }) }
        ]
      }
    },
    {
      id: 'k_pulldown', name: 'Cable – half-kneeling pulldown', equip: ['kinesis'], type: 'strength', unit: 'stopnja', load: 9, inc: 1,
      muscles: 'Lats, biceps', tempo: '1-1-2',
      cues: ['Half-kneeling, glutes squeezed, torso upright', 'Drive the elbows down to your sides', 'Full extension at the top – stretch through the lats'],
      mistakes: ['Leaning back', 'Shoulders stuck by the ears'],
      anim: {
        scene: [K_FRONT_HIGH], cables: cab(K_FRONT_HIGH), hold: { N: 'handle', F: 'handle' }, focus: ['torso', 'upper'],
        frames: [
          { d: 0.9, l: 'Elbows down', p: kneel({ aN: [158, 158] }) },
          { d: 0.4, l: 'Squeeze', p: kneel({ aN: [-8, 168] }) },
          { d: 1.6, l: 'Slowly up', p: kneel({ aN: [-8, 168] }) },
          { d: 0.3, l: 'Stretch', p: kneel({ aN: [158, 158] }) }
        ]
      }
    },
    {
      id: 'k_face_pull', name: 'Cable – face pull', equip: ['kinesis'], type: 'strength', unit: 'stopnja', load: 5, inc: 1,
      muscles: 'Rear delts, rotator cuff, mid-back', tempo: '1-2-2',
      cues: ['Handles at face height', 'Pull toward the forehead, elbows high and wide', 'Rotate the hands out at the end (double-biceps pose)'],
      mistakes: ['Level too heavy – pulling with the biceps', 'Elbows dropping'],
      anim: {
        scene: [K_FRONT_FACE], cables: cab(K_FRONT_FACE), hold: { N: 'handle', F: 'handle' }, focus: ['upper'],
        frames: [
          { d: 0.9, l: 'Pull to face', p: split({ t: 176, aN: [92, 92] }) },
          { d: 0.9, l: 'Rotate out, hold', p: split({ t: 178, aN: [-92, 172] }) },
          { d: 1.6, l: 'Slowly back', p: split({ t: 178, aN: [-92, 172] }) },
          { d: 0.2, l: '', p: split({ t: 176, aN: [92, 92] }) }
        ]
      }
    },
    {
      id: 'k_pushdown', name: 'Cable – triceps pushdown', equip: ['kinesis'], type: 'strength', unit: 'stopnja', load: 6, inc: 1,
      muscles: 'Triceps', tempo: '1-1-2',
      cues: ['Elbows pinned to your sides', 'Fully extend and squeeze 1 s', 'Up only to 90°'],
      mistakes: ['Elbows drifting forward', 'Helping with the shoulder / torso'],
      anim: {
        scene: [K_PUSH], cables: cab(K_PUSH), hold: { N: 'handle', F: 'handle' }, focus: ['upper'],
        frames: [
          { d: 0.8, l: 'Extend', p: stand({ t: 172, aN: [10, 140] }) },
          { d: 0.5, l: 'Squeeze', p: stand({ t: 172, aN: [8, 10] }) },
          { d: 1.5, l: 'Slowly up', p: stand({ t: 172, aN: [8, 10] }) },
          { d: 0.2, l: '', p: stand({ t: 172, aN: [10, 140] }) }
        ]
      }
    },
    {
      id: 'k_pullthrough', name: 'Cable – cable pull-through', equip: ['kinesis'], type: 'strength', unit: 'stopnja', load: 10, inc: 1,
      muscles: 'Glutes, hamstrings', tempo: '2-0-1',
      cues: ['Back to the machine, cable between the legs', 'Hips back, back flat, arms just hold', 'Extend the hips and squeeze the glutes'],
      mistakes: ['Pulling with the arms', 'Squatting instead of hinging'],
      anim: {
        scene: [K_LOW_BEHIND], cables: cab(K_LOW_BEHIND), hold: { N: 'handle', F: 'handle' }, focus: ['glute', 'thigh'],
        frames: [
          { d: 1.5, l: 'Hips back', p: stand({ aN: [8, 8] }) },
          { d: 0.3, l: 'Stretch', p: stand({ t: 108, lN: [36, -4], aN: [-30, -30], hd: 25 }) },
          { d: 0.9, l: 'Extend hips', p: stand({ t: 108, lN: [36, -4], aN: [-30, -30], hd: 25 }) },
          { d: 0.5, l: 'Squeeze', p: stand({ aN: [8, 8] }) }
        ]
      }
    },
    {
      id: 'k_woodchop', name: 'Cable – high-to-low woodchop', equip: ['kinesis'], type: 'core', unit: 'stopnja', load: 6, inc: 1, perSide: true,
      muscles: 'Obliques, core', tempo: '1-0-2',
      cues: ['Side-on to the machine, arms extended', 'Rotate through hips and torso diagonally down', 'Slow return – resist the rotation'],
      mistakes: ['Moving with the arms only', 'Rounded back at the bottom'],
      anim: {
        scene: [K_HIGH_BEHIND], cables: cab(K_HIGH_BEHIND), hold: { N: 'handle', F: 'handle' }, focus: ['torso'],
        frames: [
          { d: 0.8, l: 'Chop diagonally', p: stand({ t: 188, aN: [-140, -140], hd: -10 }) },
          { d: 0.3, l: 'Bottom', p: stand({ t: 160, lN: [28, -16], aN: [42, 42], hd: 10 }) },
          { d: 1.5, l: 'Controlled return', p: stand({ t: 160, lN: [28, -16], aN: [42, 42], hd: 10 }) },
          { d: 0.2, l: '', p: stand({ t: 188, aN: [-140, -140], hd: -10 }) }
        ]
      }
    },

    // ------------------------------------------------------------ WALL
    {
      id: 'pullup', name: 'Pull-up', equip: ['wall'], type: 'strength', unit: 'bw', load: 0, inc: 0,
      muscles: 'Lats, biceps, core', tempo: '1-1-3',
      cues: ['Start from a dead hang, set the shoulder blades first', 'Pull your chest to the bar, chin over the bar', 'Lower for 3 s – if you can\'t pull up yet, do negatives only'],
      mistakes: ['Kipping with the legs', 'Half reps'],
      anim: {
        scene: [WALL], focus: ['torso', 'upper'],
        frames: [
          { d: 1.0, l: 'Pull', p: hang({ lN: [12, -6, 40] }) },
          { d: 0.4, l: 'Chin over bar', p: hang({ t: 184, hd: -8, aN: [36, 170], aF: [33, 168], lN: [22, -10, 40] }) },
          { d: 2.2, l: 'Lower for 3 s', p: hang({ t: 184, hd: -8, aN: [36, 170], aF: [33, 168], lN: [22, -10, 40] }) },
          { d: 0.5, l: 'Full hang', p: hang({ lN: [12, -6, 40] }) }
        ]
      }
    },
    {
      id: 'hang_knee_raise', name: 'Hanging knee raise', equip: ['wall'], type: 'core', unit: 'bw', load: 0, inc: 0,
      muscles: 'Lower abs, hip flexors', tempo: '1-1-2',
      cues: ['Active hang – shoulders away from the ears', 'Raise knees above hip height, tuck the pelvis', 'Lower under control, no swinging'],
      mistakes: ['Body swinging', 'Knees only to 90°'],
      anim: {
        scene: [WALL], focus: ['torso', 'thigh'],
        frames: [
          { d: 0.9, l: 'Knees up', p: hang({}) },
          { d: 0.4, l: 'Tuck pelvis', p: hang({ t: 188, lN: [118, 12, 50] }) },
          { d: 1.6, l: 'Slowly down', p: hang({ t: 188, lN: [118, 12, 50] }) },
          { d: 0.3, l: '', p: hang({}) }
        ]
      }
    },
    {
      id: 'hang_leg_raise', name: 'Hanging leg raise', equip: ['wall'], type: 'core', unit: 'bw', load: 0, inc: 0,
      muscles: 'Abs, hip flexors', tempo: '1-1-3',
      cues: ['Legs straight, toes pointed', 'Raise to horizontal or higher', 'Lower for 3 s, don\'t swing'],
      mistakes: ['Swinging', 'Bent knees (turns into a knee raise)'],
      anim: {
        scene: [WALL], focus: ['torso', 'thigh'],
        frames: [
          { d: 1.0, l: 'Legs up', p: hang({}) },
          { d: 0.4, l: 'Hold', p: hang({ t: 190, lN: [98, 96, 160] }) },
          { d: 2.0, l: 'Lower for 3 s', p: hang({ t: 190, lN: [98, 96, 160] }) },
          { d: 0.3, l: '', p: hang({}) }
        ]
      }
    },
    {
      id: 'dead_hang', name: 'Dead hang + scapular pulls', equip: ['wall'], type: 'mobility', unit: 's',
      muscles: 'Shoulders, grip, spine', tempo: 'Slow',
      cues: ['Relax into the hang – decompress the spine', 'Then lift your body 2–3 cm using only the shoulder blades', 'Breathe deeply'],
      mistakes: ['Holding your breath', 'Bending the elbows'],
      anim: {
        scene: [WALL], focus: ['upper', 'torso'],
        frames: [
          { d: 1.4, l: 'Passive hang', p: hang({}) },
          { d: 1.0, l: 'Shoulder blades down', p: hang({ aN: [180, 180], pin: ['hN', 30, -230], t: 182 }) },
          { d: 1.4, l: 'Hold', p: hang({ aN: [180, 180], pin: ['hN', 30, -230], t: 182 }) },
          { d: 1.0, l: 'Relax', p: hang({}) }
        ]
      }
    },

    // ------------------------------------------------------------ AB & BACK-EXTENSION BENCH
    {
      id: 'back_ext', name: 'Back extension (45° bench)', equip: ['tria'], type: 'strength', unit: 'kg', load: 0, inc: 2.5,
      muscles: 'Spinal erectors, glutes, hamstrings', tempo: '2-1-2',
      cues: ['Pad just below the hip bones', 'Lower with a flat back, then squeeze the glutes', 'Up only to a straight line – no overextension'],
      mistakes: ['Hyperextending at the top', 'Jerky movement'],
      anim: {
        scene: [TRIA_BACK], focus: ['torso', 'glute'],
        frames: [
          { d: 1.8, l: 'Lower', p: backExt(141) },
          { d: 0.3, l: 'Bottom', p: backExt(30) },
          { d: 1.4, l: 'Squeeze glutes, up', p: backExt(30) },
          { d: 0.8, l: 'Straight line – hold', p: backExt(141) }
        ]
      }
    },
    {
      id: 'situp', name: 'Decline sit-up (ab bench)', equip: ['tria'], type: 'core', unit: 'bw', load: 0, inc: 2.5,
      muscles: 'Abs', tempo: '1-1-2',
      cues: ['Feet hooked under the rollers', 'Curl up one vertebra at a time, chin to chest', 'Lower slowly, don\'t flop onto the pad'],
      mistakes: ['Pulling on the neck', 'Jerking up with the hip flexors'],
      anim: {
        scene: [TRIA_ABS], focus: ['torso'],
        frames: [
          { d: 1.0, l: 'Curl up', p: situp(282) },
          { d: 0.4, l: 'Squeeze', p: situp(150) },
          { d: 1.6, l: 'Slowly down', p: situp(150) },
          { d: 0.3, l: '', p: situp(282) }
        ]
      }
    },

    // ------------------------------------------------------------ BODYWEIGHT
    {
      id: 'pushup', name: 'Push-up', equip: ['floor'], type: 'strength', unit: 'bw', load: 0, inc: 0, secPerRep: 3,
      muscles: 'Chest, triceps, core', tempo: '2-0-1',
      cues: ['Hands under shoulders, body in a straight plank', 'Elbows back at ~45°', 'Chest to just above the floor, then press'],
      mistakes: ['Sagging hips', 'Head jutting forward'],
      anim: {
        focus: ['torso', 'upper'],
        frames: [
          { d: 1.5, l: 'Lower', p: pushPose(114.6, [40, -5]) },
          { d: 0.2, l: 'Bottom', p: pushPose(97, [44, -5]) },
          { d: 0.8, l: 'Press', p: pushPose(97, [44, -5]) },
          { d: 0.4, l: '', p: pushPose(114.6, [40, -5]) }
        ]
      }
    },
    {
      id: 'plank', name: 'Forearm plank', equip: ['floor'], type: 'core', unit: 's',
      muscles: 'Abs, core', tempo: 'Static hold',
      cues: ['Elbows under shoulders', 'Squeeze glutes and abs – ribs toward the pelvis', 'Breathe steadily'],
      mistakes: ['Hips sagging or piked', 'Holding your breath'],
      anim: {
        focus: ['torso'],
        frames: [
          { d: 2, l: 'Inhale', p: { t: 101, hd: -6, lN: [-79, -79, 15], aN: [-2, 92], pin: PUSH_FEET } },
          { d: 2, l: 'Exhale – brace', p: { t: 102.5, hd: -6, lN: [-77.5, -77.5, 15], aN: [-3, 92], pin: PUSH_FEET } }
        ]
      }
    },
    {
      id: 'dead_bug', name: 'Dead bug', equip: ['floor'], type: 'core', unit: 'bw', load: 0, inc: 0,
      muscles: 'Deep core', tempo: '2-1-2',
      cues: ['Lower back pressed into the floor the whole time', 'Extend opposite arm and leg, exhale', 'Slow – quality over quantity'],
      mistakes: ['Lower back lifting', 'Too fast'],
      anim: {
        focus: ['torso'],
        frames: [
          { d: 1.4, l: 'Extend opposite limbs', p: deadBug(DB_REST_ARM, DB_REST_ARM, DB_REST_LEG, DB_REST_LEG) },
          { d: 0.6, l: 'Exhale', p: deadBug([-96, -96], DB_REST_ARM, DB_REST_LEG, [94, 94, 160]) },
          { d: 1.4, l: 'Return', p: deadBug([-96, -96], DB_REST_ARM, DB_REST_LEG, [94, 94, 160]) },
          { d: 1.4, l: 'Other side', p: deadBug(DB_REST_ARM, DB_REST_ARM, DB_REST_LEG, DB_REST_LEG) },
          { d: 0.6, l: 'Exhale', p: deadBug(DB_REST_ARM, [-96, -96], [94, 94, 160], DB_REST_LEG) },
          { d: 1.4, l: 'Return', p: deadBug(DB_REST_ARM, [-96, -96], [94, 94, 160], DB_REST_LEG) }
        ]
      }
    },
    {
      id: 'bird_dog', name: 'Bird dog', equip: ['floor'], type: 'core', unit: 'bw', load: 0, inc: 0,
      muscles: 'Core, back, glutes', tempo: '2-2-2',
      cues: ['On all fours, back flat as a table', 'Extend opposite arm and leg – keep the pelvis level', 'Hold 2 s, then switch'],
      mistakes: ['Pelvis rotating', 'Arched back'],
      anim: {
        focus: ['torso', 'glute'],
        frames: [
          { d: 1.2, l: 'Extend', p: quad([0, 0], [0, 0], [0, -90, -160], [0, -90, -160]) },
          { d: 1.4, l: 'Hold', p: quad([92, 92], [0, 0], [0, -90, -160], [-88, -88, -30]) },
          { d: 1.2, l: 'Return', p: quad([92, 92], [0, 0], [0, -90, -160], [-88, -88, -30]) },
          { d: 1.2, l: 'Other side', p: quad([0, 0], [0, 0], [0, -90, -160], [0, -90, -160]) },
          { d: 1.4, l: 'Hold', p: quad([0, 0], [92, 92], [-88, -88, -30], [0, -90, -160]) },
          { d: 1.2, l: 'Return', p: quad([0, 0], [92, 92], [-88, -88, -30], [0, -90, -160]) }
        ]
      }
    },

    // ------------------------------------------------------------ MOBILITY
    {
      id: 'hip_flexor', name: 'Half-kneeling hip flexor stretch', equip: ['floor'], type: 'mobility', unit: 's', perSide: true,
      muscles: 'Hip flexors, quads', tempo: 'Breathe',
      cues: ['Back knee down, squeeze the glute on that side', 'Tuck the pelvis under, then shift hips slightly forward', 'Same-side arm up and slightly overhead'],
      mistakes: ['Arched lower back', 'Front knee far past the toes'],
      anim: {
        focus: ['thigh', 'glute'],
        frames: [
          { d: 2.2, l: 'Hips forward – inhale', p: kneel({ r: [-4, -53], aN: [0, 0], ik: { fN: [42, -8], fF: [-46, -8] } }) },
          { d: 2.2, l: 'Stretch – exhale', p: kneel({ r: [10, -48], t: 186, aN: [176, 176], ik: { fN: [42, -8], fF: [-46, -8] } }) }
        ]
      }
    },
    {
      id: 'hamstring_bench', name: 'Hamstring stretch (heel on bench)', equip: ['bench'], type: 'mobility', unit: 's', perSide: true,
      muscles: 'Hamstrings, calves, lower back', tempo: 'Breathe',
      cues: ['Heel on the bench, toes up, soft knee', 'Hinge at the hips with a flat back – chest toward the foot', 'Sink a little deeper on each exhale'],
      mistakes: ['Rounded back', 'Bouncing'],
      anim: {
        scene: [{ type: 'bench', x: 50, len: 100 }], focus: ['thigh'],
        frames: [
          { d: 2.4, l: 'Inhale – lengthen spine', p: { r: [0, -92], t: 176, hd: 0, aN: [6, 6], lN: [0, 0, 175], ik: { fN: [80, -54], fF: [-5, -6] } } },
          { d: 2.4, l: 'Exhale – hinge forward', p: { r: [-4, -91], t: 128, hd: 15, aN: [62, 66], lN: [0, 0, 175], ik: { fN: [80, -54], fF: [-5, -6] } } }
        ]
      }
    },

    // ------------------------------------------------------------ hybrid race (substitutes on home equipment)
    {
      id: 'hx_bike_run', name: 'Bike – run substitute (race)', equip: ['bike'], type: 'cardio', unit: 'min',
      muscles: 'Cardio, legs', tempo: '90–100 RPM · RPE 7',
      cues: ['A pace you can hold for all 8 rounds – not a sprint', 'Medium resistance: at 95 RPM breathing is fast but controlled', 'Ease off for the last 20 s and get ready for the station'],
      mistakes: ['First round too fast', 'Holding your breath at the station right after the bike'],
      anim: bikeAnim(0.62)
    },
    {
      id: 'k_ski', name: 'Cable – ski pull (race)', equip: ['kinesis'], type: 'cardio', unit: 'stopnja', load: 6, inc: 1,
      muscles: 'Lats, core, triceps, glutes', tempo: 'Rhythmic, ~40 pulls/min',
      cues: ['High pulley in front, handles overhead', 'Pull with a hip hinge and abs – hands finish by the hips', 'Soft knees, drive from the hips like on a ski machine'],
      mistakes: ['Pulling with the arms only', 'Rounded back at the bottom'],
      anim: {
        scene: [K_SKI], cables: cab(K_SKI), hold: { N: 'handle', F: 'handle' }, focus: ['torso', 'upper'],
        frames: [
          { d: 0.55, l: 'PULL – hip hinge', p: stand({ t: 184, aN: [160, 160], hd: -6 }) },
          { d: 0.15, l: 'Hands by hips', p: stand({ t: 128, lN: [30, -14], aN: [-22, -22], hd: 22 }) },
          { d: 0.8, l: 'Up – extend', p: stand({ t: 128, lN: [30, -14], aN: [-22, -22], hd: 22 }) }
        ]
      }
    },
    {
      id: 'bike_sled', name: 'Bike – heavy standing climb (Sled Push substitute)', equip: ['bike'], type: 'cardio', unit: 'min',
      muscles: 'Quads, glutes, heart', tempo: '55–65 RPM · heavy resistance',
      cues: ['Resistance high enough to drop cadence below 65', 'Out of the saddle, weight over the pedals, torso leaning like on a sled push', 'Power from the hips – hands only for balance'],
      mistakes: ['Resistance too low – spinning with no force', 'Rocking the bike with the torso'],
      anim: bikeStandAnim(1.05)
    },
    {
      id: 'k_sled_pull', name: 'Cable – hand-over-hand sled pull', equip: ['kinesis'], type: 'cardio', unit: 'stopnja', load: 12, inc: 1, repsPerCycle: 2,
      muscles: 'Back, biceps, grip, glutes', tempo: 'Alternating, fast',
      cues: ['Low pulley in front, athletic stance, hips back', 'Alternate pulling left and right hand to the hip', 'Lean back, weight in the heels'],
      mistakes: ['Standing upright – pulling with the arms only', 'Rounded back'],
      anim: {
        scene: [K_SLED], cables: cab(K_SLED), hold: { N: 'handle', F: 'handle' }, focus: ['upper', 'torso'],
        frames: [
          { d: 0.42, l: 'Right to hip', p: sled([84, 88], [-60, 70]) },
          { d: 0.42, l: 'Left to hip', p: sled([-60, 70], [84, 88]) }
        ]
      }
    },
    {
      id: 'burpee_bj', name: 'Burpee broad jump (race)', equip: ['floor'], type: 'cardio', unit: 'bw', load: 0, inc: 0, secPerRep: 6,
      muscles: 'Full body, heart', tempo: 'Steady',
      cues: ['Chest to the floor, then feet under you', 'Two-foot jump forward – soft landing in a quarter squat', 'At home: walk back to the start, keep a steady rhythm'],
      mistakes: ['Jumping too far and losing rhythm', 'Landing with locked knees'],
      anim: {
        focus: ['thigh', 'torso'],
        frames: [
          { d: 0.35, l: 'Down', p: { pin: ['fN', 0, -6], t: 180, lN: [0, 0], ik: { hN: [6, -86], hF: [4, -86] } } },
          { d: 0.25, l: 'Hands down', p: { pin: ['fN', 0, -6], t: 125, hd: 15, lN: [95, -35], ik: { hN: [34, -5], hF: [31, -5] } } },
          { d: 0.35, l: 'Jump feet back', p: { pin: ['fN', -78, -6], t: 112, hd: -5, lN: [-68, -68, 15], ik: { hN: [34, -5], hF: [31, -5] } } },
          { d: 0.3, l: 'Chest to floor', p: { pin: ['fN', -78, -6], t: 96, hd: -5, lN: [-84, -84, 15], ik: { hN: [38, -5], hF: [35, -5] } } },
          { d: 0.3, l: 'Feet under body', p: { pin: ['fN', 0, -6], t: 125, hd: 15, lN: [95, -35], ik: { hN: [34, -5], hF: [31, -5] } } },
          { d: 0.3, l: 'JUMP forward', p: { pin: ['fN', 0, -6], t: 140, hd: 10, lN: [70, -30], ik: { hN: [-20, -60], hF: [-22, -60] } } },
          { d: 0.35, l: 'Flight', p: { pin: ['fN', 52, -40], t: 168, hd: -4, lN: [30, -20, 110], ik: { hN: [110, -150], hF: [107, -150] } } },
          { d: 0.6, l: 'Soft landing', p: { pin: ['fN', 95, -6], t: 140, hd: 10, lN: [75, -30], ik: { hN: [125, -70], hF: [122, -70] } } },
          { d: 0.6, l: 'Back to start', p: { pin: ['fN', 95, -6], t: 180, lN: [0, 0], ik: { hN: [101, -86], hF: [99, -86] } } }
        ]
      }
    },
    {
      id: 'kb_farmers', name: 'Kettlebell farmers carry (race)', equip: ['kb'], type: 'cardio', unit: 'kg', load: 16, inc: 4,
      muscles: 'Grip, core, shoulders, legs', tempo: 'Quick short steps',
      cues: ['Two KBs at your sides, shoulders down and back', 'Quick short steps, eyes forward', 'Don\'t stop – if your grip fades, slow down'],
      mistakes: ['Leaning to one side', 'Shoulders up by the ears'],
      anim: carryAnim
    },
    {
      id: 'kb_lunge', name: 'Goblet walking lunge (Sandbag Lunges substitute)', equip: ['kb'], type: 'strength', unit: 'kg', load: 12, inc: 4, repsPerCycle: 2, secPerRep: 2.5,
      muscles: 'Quads, glutes, core', tempo: 'Steady',
      cues: ['KB held at the chest (goblet)', 'Back knee touches the floor, torso upright', 'Alternate legs without stopping'],
      mistakes: ['Step too short – knee far past the toes', 'Torso collapsing forward'],
      anim: {
        hold: { N: 'kb' }, focus: ['thigh', 'glute'],
        frames: [
          { d: 0.7, l: 'Step forward', p: lungeP([0, -92], [6, -6], [-6, -6]) },
          { d: 0.25, l: 'Knee to floor', p: lungeP([-6, -50], [36, -6], [-44, -10]) },
          { d: 0.7, l: 'Drive back up', p: lungeP([-6, -50], [36, -6], [-44, -10]) },
          { d: 0.7, l: 'Other leg', p: lungeP([0, -92], [-6, -6], [6, -6]) },
          { d: 0.25, l: 'Knee to floor', p: lungeP([-6, -50], [-44, -10], [36, -6]) },
          { d: 0.7, l: 'Drive back up', p: lungeP([-6, -50], [-44, -10], [36, -6]) }
        ]
      }
    },
    {
      id: 'db_thruster', name: 'Dumbbell thruster (Wall Balls substitute)', equip: ['db'], type: 'strength', unit: 'kg', load: 8, inc: 2, secPerRep: 3,
      muscles: 'Legs, shoulders, heart', tempo: 'Fluid, no pause',
      cues: ['Dumbbells on the shoulders, elbows forward', 'Squat to parallel, explode out of the bottom', 'Leg drive sends the weights overhead – one fluid movement'],
      mistakes: ['Splitting the squat and press', 'Heels lifting'],
      anim: {
        hold: { N: 'db', F: 'db' }, focus: ['thigh', 'upper'],
        frames: [
          { d: 0.9, l: 'Squat', p: thrRack },
          { d: 0.1, l: 'Bottom', p: thrBot },
          { d: 0.55, l: 'EXPLODE up', p: thrBot },
          { d: 0.4, l: 'Overhead', p: thrTop },
          { d: 0.5, l: 'Back to shoulders', p: thrTop }
        ]
      }
    },

    // ------------------------------------------------------------ EXTRA EQUIPMENT
    {
      id: 'treadmill_run', name: 'Treadmill run', equip: ['treadmill'], type: 'cardio', unit: 'min', secPerM: 0.33,
      muscles: 'Cardio, legs', tempo: 'Cadence 170–180 steps/min',
      cues: ['Tall posture, slight lean from the ankles', 'Short quick steps – feet land under the hips', 'Arms swing front to back, not across the body'],
      mistakes: ['Overstriding and heel striking', 'Holding the handrails'],
      anim: treadAnim
    },
    {
      id: 'skierg', name: 'Ski machine', equip: ['skierg'], type: 'cardio', unit: 'min', secPerM: 0.28,
      muscles: 'Back, core, triceps, glutes', tempo: '35–45 pulls/min',
      cues: ['Handles overhead, arms slightly bent', 'Pull with a hip hinge and abs, not just the arms', 'Recovery: arms up first, then hips'],
      mistakes: ['Squatting instead of hinging', 'Pull stops short above the knees'],
      anim: {
        scene: [SKI], cables: [{ from: [SKI.x - 8, -208], to: ['hN', 'hF'] }], hold: { N: 'handle', F: 'handle' }, focus: ['torso', 'upper'],
        frames: [
          { d: 0.5, l: 'PULL', p: stand({ t: 184, aN: [158, 158], hd: -6 }) },
          { d: 0.15, l: 'Hands by hips', p: stand({ t: 126, lN: [32, -16], aN: [-24, -24], hd: 22 }) },
          { d: 0.8, l: 'Up – arms, then hips', p: stand({ t: 126, lN: [32, -16], aN: [-24, -24], hd: 22 }) }
        ]
      }
    },
    {
      id: 'sled_push', name: 'Sled push', equip: ['sled'], type: 'cardio', unit: 'kg', load: 50, inc: 10, secPerM: 2.4,
      muscles: 'Quads, glutes, calves, core', tempo: 'Short powerful steps',
      cues: ['Arms extended on the high handles, body at ~45°', 'Drive through the balls of the feet, knees forward', 'Don\'t stop – restarting costs the most'],
      mistakes: ['Standing too upright', 'Steps too long'],
      anim: sledPushAnim
    },
    {
      id: 'sled_pull', name: 'Sled pull', equip: ['sled'], type: 'cardio', unit: 'kg', load: 50, inc: 10, secPerM: 2.4, repsPerCycle: 2,
      muscles: 'Back, biceps, grip, glutes', tempo: 'Hand over hand',
      cues: ['Athletic stance, hips back, weight in the heels', 'Pull hand over hand to the hip', 'Pile the rope in the box behind you'],
      mistakes: ['Pulling with locked knees', 'Rounded back'],
      anim: {
        scene: [SLED_R], hold: { N: 'handle', F: 'handle' }, focus: ['upper', 'torso'],
        frames: [
          { d: 0.42, l: 'Right to hip', p: sled([84, 88], [-60, 70]) },
          { d: 0.42, l: 'Left to hip', p: sled([-60, 70], [84, 88]) }
        ]
      }
    },
    {
      id: 'wall_ball', name: 'Wall ball', equip: ['wallball', 'wall'], type: 'cardio', unit: 'kg', load: 6, inc: 3, secPerRep: 2.6,
      muscles: 'Legs, shoulders, heart', tempo: 'Fluid – catch and drop straight into the squat',
      cues: ['Ball under the chin, elbows under the ball', 'Squat below parallel, explode up and throw to the target', 'Catch and flow straight into the next squat'],
      mistakes: ['Throwing with the arms only', 'Catching with arms locked overhead'],
      anim: {
        scene: [TARGET], hold: { N: 'ball' }, focus: ['thigh', 'upper'],
        frames: [
          { d: 0.7, l: 'Squat', p: wb({ aN: [22, 166] }) },
          { d: 0.1, l: 'Bottom', p: wb({ t: 152, lN: [102, -36], aN: [26, 170], hd: 8 }) },
          { d: 0.45, l: 'EXPLODE', p: wb({ t: 152, lN: [102, -36], aN: [26, 170], hd: 8 }) },
          { d: 0.35, l: 'Throw to target', p: wb({ t: 182, aN: [160, 168], hd: -16 }, [24, -206]) },
          { d: 0.35, l: '', p: wb({ t: 182, aN: [140, 160], hd: -20 }, [60, -232]) },
          { d: 0.12, l: 'Catch', p: wb({ t: 180, aN: [60, 140], hd: -8 }, [28, -132]) }
        ]
      }
    },
    {
      id: 'sandbag_lunge', name: 'Sandbag lunges', equip: ['sandbag'], type: 'strength', unit: 'kg', load: 10, inc: 5, repsPerCycle: 2, secPerRep: 2.5,
      muscles: 'Quads, glutes, core', tempo: 'Steady',
      cues: ['Sandbag across the shoulders behind the neck', 'Back knee touches the floor', 'Torso upright, alternate legs without stopping'],
      mistakes: ['Bag sliding onto the neck', 'Torso collapsing forward'],
      anim: {
        hold: { N: 'bag' }, focus: ['thigh', 'glute'],
        frames: [
          { d: 0.7, l: 'Step forward', p: m(lungeP([0, -92], [6, -6], [-6, -6]), { aN: [-36, 150], aF: [-30, 155] }) },
          { d: 0.25, l: 'Knee to floor', p: m(lungeP([-6, -50], [36, -6], [-44, -10]), { aN: [-36, 150], aF: [-30, 155] }) },
          { d: 0.7, l: 'Drive back up', p: m(lungeP([-6, -50], [36, -6], [-44, -10]), { aN: [-36, 150], aF: [-30, 155] }) },
          { d: 0.7, l: 'Other leg', p: m(lungeP([0, -92], [-6, -6], [6, -6]), { aN: [-36, 150], aF: [-30, 155] }) },
          { d: 0.25, l: 'Knee to floor', p: m(lungeP([-6, -50], [-44, -10], [36, -6]), { aN: [-36, 150], aF: [-30, 155] }) },
          { d: 0.7, l: 'Drive back up', p: m(lungeP([-6, -50], [-44, -10], [36, -6]), { aN: [-36, 150], aF: [-30, 155] }) }
        ]
      }
    },
    {
      id: 'bb_squat', name: 'Barbell back squat', equip: ['barbell'], type: 'strength', unit: 'kg', load: 40, inc: 5,
      muscles: 'Quads, glutes, core', tempo: '3-1-1',
      cues: ['Bar on the upper traps, elbows under the bar', 'Breathe into the belly and brace, knees track the toes', 'Below parallel, drive through the whole foot'],
      mistakes: ['Heels lifting', 'Hips rising before the chest'],
      anim: {
        scene: [RACK], hold: { N: 'bar' }, focus: ['thigh', 'glute'],
        frames: [
          { d: 2.2, l: 'Lower for 3 s', p: stand({ aN: [-46, 168], hd: 0 }) },
          { d: 0.4, l: 'Bottom', p: stand({ t: 140, lN: [100, -34], aN: [-26, 186], hd: 18 }) },
          { d: 1.1, l: 'Drive up', p: stand({ t: 140, lN: [100, -34], aN: [-26, 186], hd: 18 }) },
          { d: 0.6, l: 'Top', p: stand({ aN: [-46, 168] }) }
        ]
      }
    },
    {
      id: 'bb_deadlift', name: 'Barbell deadlift', equip: ['barbell'], type: 'strength', unit: 'kg', load: 60, inc: 5,
      muscles: 'Glutes, hamstrings, back', tempo: '1-0-2',
      cues: ['Bar over mid-foot, shins touching it', 'Brace your back and "break" the bar off the floor', 'Bar slides up the legs, squeeze glutes at the top'],
      mistakes: ['Rounded back', 'Bar drifting away from the body'],
      anim: {
        hold: { N: 'plate' }, focus: ['glute', 'thigh', 'torso'],
        frames: [
          { d: 0.4, l: 'Brace your back', p: stand({ t: 122, lN: [74, -24], aN: [-6, -6], hd: 22 }) },
          { d: 1.1, l: 'Push the floor away', p: stand({ t: 122, lN: [74, -24], aN: [-6, -6], hd: 22 }) },
          { d: 0.5, l: 'Top – squeeze', p: stand({ aN: [0, 0] }) },
          { d: 1.6, l: 'Controlled down', p: stand({ aN: [0, 0] }) }
        ]
      }
    },
    {
      id: 'bb_bench', name: 'Barbell bench press', equip: ['barbell', 'bench'], type: 'strength', unit: 'kg', load: 40, inc: 5,
      muscles: 'Chest, triceps, front delts', tempo: '3-1-1',
      cues: ['Shoulder blades together, feet planted', 'Lower the bar to the lower chest', 'Press up and slightly back over the shoulders'],
      mistakes: ['Bouncing off the chest', 'Elbows flared to 90°'],
      anim: {
        scene: [BENCH_FLAT, { type: 'rack', x: -46, y: -116 }], hold: { N: 'plate' }, focus: ['torso', 'upper'],
        frames: [
          { d: 2.2, l: 'Lower for 3 s', p: benchPose([174, 174]) },
          { d: 0.4, l: 'Pause', p: benchPose([58, 178]) },
          { d: 0.9, l: 'Press', p: benchPose([58, 178]) },
          { d: 0.5, l: 'Top', p: benchPose([174, 174]) }
        ]
      }
    },
    {
      id: 'box_jump', name: 'Box jump', equip: ['box'], type: 'strength', unit: 'bw', load: 0, inc: 0, secPerRep: 4,
      muscles: 'Legs, glutes, power', tempo: 'Explode up, step down',
      cues: ['Swing the arms and dip quickly', 'Land softly, whole foot on the box', 'Stand tall at the top, then STEP down'],
      mistakes: ['Jumping down (stresses the Achilles)', 'Landing on the toes'],
      anim: {
        scene: [BOX], focus: ['thigh', 'glute'],
        frames: [
          { d: 0.4, l: 'Arm swing', p: stand({ aN: [10, 10] }) },
          { d: 0.25, l: 'Quarter squat', p: stand({ t: 140, lN: [62, -26], aN: [-50, -44], hd: 10 }) },
          { d: 0.35, l: 'JUMP', p: { pin: ['fN', 34, -74], t: 160, hd: -4, lN: [74, -30, 110], aN: [110, 110] } },
          { d: 0.5, l: 'Soft landing', p: { pin: ['fN', 62, -58], t: 146, hd: 8, lN: [86, -32], aN: [70, 76] } },
          { d: 0.5, l: 'Stand tall', p: { pin: ['fN', 62, -58], t: 180, lN: [0, 0], aN: [4, 4] } },
          { d: 0.7, l: 'Step down', p: { pin: ['fN', 30, -34], t: 176, lN: [20, -10], aN: [8, 8] } }
        ]
      }
    },
    {
      id: 'jump_rope', name: 'Jump rope', equip: ['rope'], type: 'cardio', unit: 'min',
      muscles: 'Calves, heart, coordination', tempo: '~120 skips/min',
      cues: ['Low bounces off the balls of the feet, soft knees', 'Turn the rope from the wrists, elbows by your sides', 'Eyes forward, breathe steadily'],
      mistakes: ['Jumping too high', 'Turning from the shoulders'],
      anim: {
        focus: ['shin'], period: 0.5, label: 'From the wrists',
        fn: function (u) {
          var hop = u > 0.3 && u < 0.7 ? 9 * Math.sin((u - 0.3) / 0.4 * Math.PI) : 0;
          return { pin: ['fN', 0, -6 - hop], t: 179, hd: -4, lN: [4, -3, 58 + hop * 2], aN: [14, 82], aF: [12, 80], x: { rope: 180 - u * 360 } };
        }
      }
    },
    {
      id: 'band_row', name: 'Band row', equip: ['bands'], type: 'strength', unit: 'bw', load: 0, inc: 0,
      muscles: 'Back, rear delts, biceps', tempo: '1-2-2',
      cues: ['Band anchored at chest height (door / post)', 'Shoulder blades back, elbows to the hips', 'Squeeze 2 s at the end, return slowly'],
      mistakes: ['Rocking the torso', 'Band too light – no tension at the start'],
      anim: {
        scene: [ANCHOR_MID], cables: band(ANCHOR_MID), hold: { N: 'handle', F: 'handle' }, focus: ['torso', 'upper'],
        frames: [
          { d: 0.9, l: 'Pull', p: split({ t: 172, aN: [80, 82] }) },
          { d: 0.8, l: 'Squeeze 2 s', p: split({ t: 178, aN: [-62, 86] }) },
          { d: 1.6, l: 'Slowly back', p: split({ t: 178, aN: [-62, 86] }) },
          { d: 0.2, l: '', p: split({ t: 172, aN: [80, 82] }) }
        ]
      }
    },
    {
      id: 'band_pushdown', name: 'Band triceps pushdown', equip: ['bands'], type: 'strength', unit: 'bw', load: 0, inc: 0,
      muscles: 'Triceps', tempo: '1-1-2',
      cues: ['Band anchored high', 'Elbows by your sides, extend fully', 'Slowly back to 90°'],
      mistakes: ['Elbows drifting forward'],
      anim: {
        scene: [ANCHOR_HIGH], cables: band(ANCHOR_HIGH), hold: { N: 'handle', F: 'handle' }, focus: ['upper'],
        frames: [
          { d: 0.8, l: 'Extend', p: stand({ t: 172, aN: [10, 140] }) },
          { d: 0.5, l: 'Squeeze', p: stand({ t: 172, aN: [8, 10] }) },
          { d: 1.5, l: 'Slowly up', p: stand({ t: 172, aN: [8, 10] }) },
          { d: 0.2, l: '', p: stand({ t: 172, aN: [10, 140] }) }
        ]
      }
    },
    {
      id: 'db_farmers', name: 'Dumbbell farmers carry', equip: ['db'], type: 'cardio', unit: 'kg', load: 20, inc: 2,
      muscles: 'Grip, core, shoulders', tempo: 'Quick short steps',
      cues: ['Dumbbells at your sides, shoulders down and back', 'Quick short steps', 'Torso still, no leaning'],
      mistakes: ['Shoulders up by the ears'],
      anim: m(carryAnim, { hold: { N: 'db', F: 'db' } })
    },

    // ------------------------------------------------------------ BODYWEIGHT FALLBACKS
    {
      id: 'bw_squat', name: 'Bodyweight squat', equip: ['floor'], type: 'strength', unit: 'bw', load: 0, inc: 0,
      muscles: 'Quads, glutes', tempo: '2-1-1',
      cues: ['Feet shoulder-width, arms forward for balance', 'Hips back and down, heels down', 'Squeeze glutes at the top'],
      mistakes: ['Knees caving in', 'Shallow squat'],
      anim: {
        focus: ['thigh', 'glute'],
        frames: [
          { d: 1.6, l: 'Lower', p: stand({ aN: [10, 10] }) },
          { d: 0.4, l: 'Bottom', p: stand({ t: 146, lN: [100, -35], aN: [86, 88], hd: 10 }) },
          { d: 0.9, l: 'Up', p: stand({ t: 146, lN: [100, -35], aN: [86, 88], hd: 10 }) },
          { d: 0.4, l: '', p: stand({ aN: [10, 10] }) }
        ]
      }
    },
    {
      id: 'bw_lunge', name: 'Bodyweight lunges', equip: ['floor'], type: 'strength', unit: 'bw', load: 0, inc: 0, repsPerCycle: 2,
      muscles: 'Quads, glutes', tempo: 'Steady',
      cues: ['Hands on hips, torso upright', 'Back knee almost to the floor', 'Push back through the front heel'],
      mistakes: ['Step too short'],
      anim: {
        focus: ['thigh', 'glute'],
        frames: [
          { d: 0.7, l: 'Step forward', p: m(lungeP([0, -92], [6, -6], [-6, -6]), { aN: [24, -30] }) },
          { d: 0.25, l: 'Knee to floor', p: m(lungeP([-6, -50], [36, -6], [-44, -10]), { aN: [24, -30] }) },
          { d: 0.7, l: 'Push back', p: m(lungeP([-6, -50], [36, -6], [-44, -10]), { aN: [24, -30] }) },
          { d: 0.7, l: 'Other leg', p: m(lungeP([0, -92], [-6, -6], [6, -6]), { aN: [24, -30] }) },
          { d: 0.25, l: 'Knee to floor', p: m(lungeP([-6, -50], [-44, -10], [36, -6]), { aN: [24, -30] }) },
          { d: 0.7, l: 'Push back', p: m(lungeP([-6, -50], [-44, -10], [36, -6]), { aN: [24, -30] }) }
        ]
      }
    },
    {
      id: 'glute_bridge', name: 'Glute bridge', equip: ['floor'], type: 'strength', unit: 'bw', load: 0, inc: 0,
      muscles: 'Glutes, hamstrings', tempo: '1-2-2',
      cues: ['On your back, feet close to the glutes', 'Drive hips up through the heels', 'Squeeze 2 s at the top, ribs down'],
      mistakes: ['Arched lower back'],
      anim: {
        focus: ['glute', 'thigh'],
        frames: [
          { d: 0.9, l: 'Hips up', p: { t: -88, hd: 0, pin: ['sho', -42, -11], aN: [92, 92], lN: [0, 0, 80], ik: { fN: [52, -6], fF: [49, -6] } } },
          { d: 1.2, l: 'Squeeze 2 s', p: { t: -62, hd: -26, pin: ['sho', -42, -11], aN: [96, 96], lN: [0, 0, 80], ik: { fN: [52, -6], fF: [49, -6] } } },
          { d: 1.5, l: 'Slowly down', p: { t: -62, hd: -26, pin: ['sho', -42, -11], aN: [96, 96], lN: [0, 0, 80], ik: { fN: [52, -6], fF: [49, -6] } } },
          { d: 0.2, l: '', p: { t: -88, hd: 0, pin: ['sho', -42, -11], aN: [92, 92], lN: [0, 0, 80], ik: { fN: [52, -6], fF: [49, -6] } } }
        ]
      }
    },
    {
      id: 'mountain_climber', name: 'Mountain climber', equip: ['floor'], type: 'cardio', unit: 's', repsPerCycle: 2,
      muscles: 'Core, shoulders, heart', tempo: 'Fast',
      cues: ['Hands under shoulders, hips in line', 'Drive knees to chest, alternating fast', 'Shoulders over hands, not behind them'],
      mistakes: ['Hips too high', 'Shoulders behind the hands'],
      anim: {
        focus: ['torso', 'thigh'],
        frames: [
          { d: 0.3, l: 'Right knee', p: { pin: ['hN', 40, -5], t: 108, hd: -8, aN: [0, 0], lN: [40, -100, -30], lF: [-62, -62, 15] } },
          { d: 0.3, l: 'Left knee', p: { pin: ['hN', 40, -5], t: 108, hd: -8, aN: [0, 0], lN: [-62, -62, 15], lF: [40, -100, -30] } }
        ]
      }
    },
    {
      id: 'high_knees', name: 'High knees', equip: ['floor'], type: 'cardio', unit: 'min',
      muscles: 'Cardio, hip flexors, calves', tempo: 'Fast',
      cues: ['Knees to hip height', 'Land softly on the balls of the feet', 'Arms pump like a sprint'],
      mistakes: ['Landing on the heels', 'Leaning back'],
      anim: {
        focus: ['thigh'], period: 0.6, label: 'Knees high',
        fn: function (u) {
          var a = Math.sin(u * Math.PI * 2), s1 = Math.max(0, a), s2 = Math.max(0, -a);
          return {
            r: [0, -93 + 2 * Math.abs(a)], t: 178, hd: -4,
            lN: [78 * s1, -14 * s1, 70 + 20 * s1], lF: [78 * s2, -14 * s2, 70 + 20 * s2],
            aN: [40 * (s1 - s2), 40 * (s1 - s2) + 90], aF: [40 * (s2 - s1), 40 * (s2 - s1) + 90]
          };
        }
      }
    },

    // ------------------------------------------------------------ BODYWEIGHT ONLY (no equipment at all)
    {
      id: 'knee_pushup', name: 'Knee push-up', equip: ['floor'], type: 'strength', unit: 'bw', load: 0, inc: 0, secPerRep: 3,
      muscles: 'Chest, triceps, core', tempo: '2-0-1',
      cues: ['Knees down, hands just wider than the shoulders', 'Straight line from the knees to the head', 'Lower the chest between the hands, then press away'],
      mistakes: ['Hips piking up toward the ceiling', 'Elbows flaring straight out to the sides'],
      anim: {
        focus: ['torso', 'upper'],
        frames: [
          { d: 1.5, l: 'Lower', p: kneePush(121) },
          { d: 0.2, l: 'Bottom', p: kneePush(102) },
          { d: 0.8, l: 'Press', p: kneePush(102) },
          { d: 0.4, l: '', p: kneePush(121) }
        ]
      }
    },
    {
      id: 'pike_pushup', name: 'Pike push-up', equip: ['floor'], type: 'strength', unit: 'bw', load: 0, inc: 0,
      muscles: 'Shoulders, triceps', tempo: '2-0-1',
      cues: ['Hips high in an upside-down V, hands shoulder-width', 'Bend the elbows and lower the top of the head toward the floor', 'Press back up until the arms are straight'],
      mistakes: ['Hips dropping into a regular push-up', 'Elbows flaring straight out'],
      anim: {
        focus: ['upper', 'torso'],
        frames: [
          { d: 1.4, l: 'Head toward the floor', p: pike(0) },
          { d: 0.2, l: 'Bottom', p: pike(1) },
          { d: 0.8, l: 'Press up', p: pike(1) },
          { d: 0.4, l: '', p: pike(0) }
        ]
      }
    },
    {
      id: 'superman', name: 'Superman', equip: ['floor'], type: 'strength', unit: 'bw', load: 0, inc: 0,
      muscles: 'Lower back, glutes, upper back', tempo: '1-2-2',
      cues: ['Lie face down, arms long in front of you', 'Lift arms, chest and legs a few centimetres together', 'Hold for two seconds, eyes on the floor, then lower slowly'],
      mistakes: ['Cranking the head up to look forward', 'Jerking up instead of lifting smoothly'],
      anim: {
        focus: ['torso', 'glute'],
        frames: [
          { d: 0.9, l: 'Lift', p: prone(0, 0) },
          { d: 1.4, l: 'Hold 2 s', p: prone(1, 1) },
          { d: 1.2, l: 'Lower slowly', p: prone(1, 1) },
          { d: 0.4, l: '', p: prone(0, 0) }
        ]
      }
    },
    {
      id: 'prone_y_raise', name: 'Prone Y raise', equip: ['floor'], type: 'strength', unit: 'bw', load: 0, inc: 0,
      muscles: 'Upper back, rear shoulders', tempo: '1-2-2',
      cues: ['Lie face down, arms overhead in a Y, thumbs up', 'Squeeze the shoulder blades down and back to lift the arms', 'Legs and forehead stay relaxed near the floor'],
      mistakes: ['Shrugging the shoulders to the ears', 'Arching the lower back to get higher'],
      anim: {
        focus: ['upper', 'torso'],
        frames: [
          { d: 0.9, l: 'Lift the arms', p: prone(0, 0, 0) },
          { d: 1.4, l: 'Hold 2 s', p: prone(0.35, 0, 1) },
          { d: 1.2, l: 'Lower slowly', p: prone(0.35, 0, 1) },
          { d: 0.4, l: '', p: prone(0, 0, 0) }
        ]
      }
    },
    {
      id: 'side_plank', name: 'Side plank', equip: ['floor'], type: 'core', unit: 's', perSide: true,
      muscles: 'Obliques, core, glutes', tempo: 'Static hold',
      cues: ['Elbow under the shoulder, feet stacked', 'Lift the hips until the body is one straight line', 'Top arm to the ceiling, breathe steadily'],
      mistakes: ['Hips sagging toward the floor', 'Rolling the chest toward the floor'],
      anim: {
        focus: ['torso', 'glute'],
        frames: [
          { d: 1.2, l: 'Hips up', p: sidePlank(109, -83) },
          { d: 2, l: 'Hold – straight line', p: sidePlank(101, -79) },
          { d: 2, l: 'Breathe', p: sidePlank(101.5, -79.5) },
          { d: 0.8, l: '', p: sidePlank(101, -79) }
        ]
      }
    },
    {
      id: 'wall_sit', name: 'Wall sit', equip: ['floor'], type: 'strength', unit: 's',
      muscles: 'Quads, glutes', tempo: 'Static hold',
      cues: ['Back flat on the wall, feet a step out in front', 'Slide down until the thighs are parallel to the floor', 'Knees over the ankles, breathe and hold'],
      mistakes: ['Knees drifting past the toes', 'Hands pushing on the thighs'],
      anim: {
        scene: [WALL_PLAIN], focus: ['thigh', 'glute'],
        frames: [
          { d: 1.4, l: 'Slide down the wall', p: wallSit(0) },
          { d: 2.2, l: 'Hold – thighs parallel', p: wallSit(1) },
          { d: 2.2, l: 'Breathe', p: wallSit(1, true) },
          { d: 1.2, l: 'Slide up', p: wallSit(1) }
        ]
      }
    },
    {
      id: 'jump_squat', name: 'Jump squat', equip: ['floor'], type: 'strength', unit: 'bw', load: 0, inc: 0, secPerRep: 3,
      muscles: 'Quads, glutes, calves', tempo: 'Explosive',
      cues: ['Squat down with the arms swinging back', 'Jump straight up, arms drive overhead', 'Land softly on the balls of the feet and sink into the next squat'],
      mistakes: ['Landing with stiff, locked knees', 'Knees caving in on the landing'],
      anim: {
        focus: ['thigh', 'glute'],
        frames: [
          { d: 0.7, l: 'Squat down', p: stand({ aN: [8, 8] }) },
          { d: 0.22, l: 'Load', p: stand({ t: 142, lN: [96, -32, 90], aN: [-46, -34], hd: 12 }) },
          { d: 0.3, l: 'Explode up', p: m(stand({ t: 178, lN: [4, 0, 28], lF: [-2, -6, 24], aN: [168, 172], hd: -4 }), { pin: ['fN', 2, -40] }) },
          { d: 0.4, l: 'Soft landing', p: stand({ t: 150, lN: [72, -26, 90], aN: [62, 76], hd: 6 }) }
        ]
      }
    },
    {
      id: 'burpee', name: 'Burpee', equip: ['floor'], type: 'cardio', unit: 'bw', load: 0, inc: 0, secPerRep: 4, iv: [30, 30],
      muscles: 'Full body, heart', tempo: 'Steady',
      cues: ['Squat and place the hands on the floor', 'Jump the feet back to a plank and lower the chest', 'Feet back under you, then jump up with the arms overhead'],
      mistakes: ['Hips sagging in the plank', 'Landing with locked knees'],
      anim: {
        focus: ['thigh', 'torso'],
        frames: [
          { d: 0.35, l: 'Squat down', p: stand({ aN: [6, 6] }) },
          { d: 0.25, l: 'Hands down', p: { pin: ['fN', 0, -6], t: 125, hd: 15, lN: [95, -35], ik: { hN: [34, -5], hF: [31, -5] } } },
          { d: 0.35, l: 'Jump feet back', p: { pin: ['fN', -78, -6], t: 112, hd: -5, lN: [-68, -68, 15], ik: { hN: [34, -5], hF: [31, -5] } } },
          { d: 0.3, l: 'Chest to floor', p: { pin: ['fN', -78, -6], t: 96, hd: -5, lN: [-84, -84, 15], ik: { hN: [38, -5], hF: [35, -5] } } },
          { d: 0.3, l: 'Feet under body', p: { pin: ['fN', 0, -6], t: 125, hd: 15, lN: [95, -35], ik: { hN: [34, -5], hF: [31, -5] } } },
          { d: 0.25, l: 'Jump up', p: stand({ t: 146, lN: [80, -30, 90], aN: [40, 50], hd: 8 }) },
          { d: 0.3, l: 'Arms overhead', p: m(stand({ t: 179, lN: [4, 0, 28], lF: [-2, -6, 24], aN: [172, 174], hd: -4 }), { pin: ['fN', 1, -36] }) },
          { d: 0.4, l: 'Soft landing', p: stand({ t: 156, lN: [60, -22, 90], aN: [50, 60], hd: 6 }) }
        ]
      }
    },
    {
      id: 'hollow_hold', name: 'Hollow hold', equip: ['floor'], type: 'core', unit: 's',
      muscles: 'Abs, deep core', tempo: 'Static hold',
      cues: ['Lie on your back and press the lower back into the floor', 'Lift the shoulders and straight legs a little off the floor', 'Arms long past the ears – bend the knees to make it easier'],
      mistakes: ['Lower back peeling off the floor', 'Holding the breath'],
      anim: {
        focus: ['torso'],
        frames: [
          { d: 2, l: 'Inhale – back flat', p: hollow(0) },
          { d: 2, l: 'Exhale – brace', p: hollow(1) }
        ]
      }
    },
    {
      id: 'sl_glute_bridge', name: 'Single-leg glute bridge', equip: ['floor'], type: 'strength', unit: 'bw', load: 0, inc: 0, perSide: true,
      muscles: 'Glutes, hamstrings', tempo: '1-2-2',
      cues: ['One foot flat near the glutes, the other leg straight', 'Drive the hips up through the heel of the planted foot', 'Keep the hips level, squeeze at the top, lower slowly'],
      mistakes: ['Hips tilting to one side', 'Pushing from the lower back instead of the glute'],
      anim: {
        focus: ['glute', 'thigh'],
        frames: [
          { d: 0.9, l: 'Hips up', p: slBridge(0) },
          { d: 1.2, l: 'Squeeze 2 s', p: slBridge(1) },
          { d: 1.5, l: 'Slowly down', p: slBridge(1) },
          { d: 0.2, l: '', p: slBridge(0) }
        ]
      }
    },
    {
      id: 'hamstring_floor', name: 'Seated hamstring stretch', equip: ['floor'], type: 'mobility', unit: 's',
      muscles: 'Hamstrings, calves, lower back', tempo: 'Breathe',
      cues: ['Sit tall with the legs straight out in front, toes up', 'Hinge forward from the hips and reach toward the feet', 'Relax a little deeper on each exhale'],
      mistakes: ['Rounding hard through the upper back', 'Bouncing'],
      anim: {
        focus: ['thigh'],
        frames: [
          { d: 2.4, l: 'Inhale – sit tall', p: seatFold(0) },
          { d: 2.4, l: 'Exhale – fold forward', p: seatFold(1) }
        ]
      }
    },

    // ------------------------------------------------------------ SUSPENSION TRAINER
    {
      id: 'susp_row', name: 'Suspension row', equip: ['suspension'], type: 'strength', unit: 'bw', load: 0, inc: 0,
      muscles: 'Back, rear delts, biceps', tempo: '1-1-2',
      cues: ['Walk the feet forward to make it harder, back to make it easier', 'Body stays one straight plank – glutes and abs tight', 'Lead with the chest, squeeze the shoulder blades, hands finish by the ribs'],
      mistakes: ['Hips sagging toward the floor', 'Shrugging the shoulders to the ears', 'Straps rubbing on the arms – keep them taut and apart'],
      anim: {
        scene: [SUSP_FRONT], cables: strap(SUSP_FRONT), hold: { N: 'handle', F: 'handle' }, focus: ['torso', 'upper'],
        frames: [
          { d: 0.9, l: 'Pull chest to hands', p: suspRow.long },
          { d: 0.5, l: 'Squeeze shoulder blades', p: suspRow.pull },
          { d: 1.6, l: 'Lower slowly', p: suspRow.pull },
          { d: 0.3, l: 'Arms long', p: suspRow.long }
        ]
      }
    },
    {
      id: 'susp_pushup', name: 'Suspension chest press', equip: ['suspension'], type: 'strength', unit: 'bw', load: 0, inc: 0,
      muscles: 'Chest, triceps, core', tempo: '3-0-1',
      cues: ['Face away from the anchor, straps taut, arms straight at chest height', 'Lower the chest between the hands, elbows ~45°', 'Plank body – the straps shouldn\'t wobble or flare out', 'Feet further back = harder'],
      mistakes: ['Hips sagging or piking', 'Hands drifting wide apart', 'Letting the shoulders roll forward at the bottom'],
      anim: {
        scene: [SUSP_BACK], cables: strap(SUSP_BACK), hold: { N: 'handle', F: 'handle' }, focus: ['torso', 'upper'],
        frames: [
          { d: 2.0, l: 'Lower for 3 s', p: suspPress.top },
          { d: 0.3, l: 'Chest between hands', p: suspPress.low },
          { d: 0.9, l: 'Press', p: suspPress.low },
          { d: 0.4, l: 'Arms straight', p: suspPress.top }
        ]
      }
    },
    {
      id: 'susp_squat', name: 'Suspension-assisted squat', equip: ['suspension'], type: 'strength', unit: 'bw', load: 0, inc: 0,
      muscles: 'Quads, glutes', tempo: '3-1-1',
      cues: ['Face the anchor, hold the handles, light tension in the straps', 'Sit the hips back and down – go deeper than you could alone', 'Drive through the whole foot, arms only assist', 'Progress: fewer arms, then single-leg (pistol)'],
      mistakes: ['Pulling yourself up with the arms', 'Heels lifting', 'Knees caving in'],
      anim: {
        scene: [SUSP_SQ], cables: strap(SUSP_SQ), hold: { N: 'handle', F: 'handle' }, focus: ['thigh', 'glute'],
        frames: [
          { d: 2.0, l: 'Sit back for 3 s', p: suspSquat.top },
          { d: 0.5, l: 'Deep – pause', p: suspSquat.bot },
          { d: 1.0, l: 'Drive up', p: suspSquat.bot },
          { d: 0.5, l: 'Stand tall', p: suspSquat.top }
        ]
      }
    },
    {
      id: 'susp_fallout', name: 'Suspension fallout', equip: ['suspension'], type: 'core', unit: 'bw', load: 0, inc: 0,
      muscles: 'Abs, lats, shoulders', tempo: '3-1-1',
      cues: ['Face away from the anchor, arms straight, on the balls of the feet', 'Let the arms rise overhead as the body leans forward', 'Ribs down, glutes tight – don\'t let the lower back sag', 'Pull back with straight arms to the start'],
      mistakes: ['Lower back arching', 'Bending at the hips instead of staying a plank', 'Going further than you can control'],
      anim: {
        scene: [SUSP_BACK], cables: strap(SUSP_BACK), hold: { N: 'handle', F: 'handle' }, focus: ['torso'],
        frames: [
          { d: 2.0, l: 'Arms overhead, lean in', p: suspFall.up },
          { d: 0.5, l: 'Hold – ribs down', p: suspFall.out },
          { d: 1.2, l: 'Pull back, arms straight', p: suspFall.out },
          { d: 0.4, l: 'Start', p: suspFall.up }
        ]
      }
    },

    // ------------------------------------------------------------ AB WHEEL
    {
      id: 'abwheel_rollout', name: 'Ab wheel rollout (kneeling)', equip: ['abwheel'], type: 'core', unit: 'bw', load: 0, inc: 0,
      muscles: 'Abs, lats, shoulders', tempo: '3-0-1',
      cues: ['Knees on a pad, wheel under the shoulders, arms straight', 'Tuck the pelvis and roll out as one unit – hips and shoulders together', 'Go only as far as the lower back stays flat', 'Pull back with the abs and lats, not the hips'],
      mistakes: ['Lower back sagging at full extension', 'Hips staying back (it turns into a stretch)', 'Bending the elbows'],
      anim: {
        hold: { N: 'wheel' }, focus: ['torso'],
        frames: [
          { d: 2.0, l: 'Roll out for 3 s', p: rollout(24, 108, false) },
          { d: 0.4, l: 'Long – ribs down', p: rollout(-64, 110, true) },
          { d: 1.1, l: 'Pull back with the abs', p: rollout(-64, 110, true) },
          { d: 0.4, l: 'Start', p: rollout(24, 108, false) }
        ]
      }
    },

    // ------------------------------------------------------------ SLAM BALL
    {
      id: 'ball_slam', name: 'Slam ball – overhead slam', equip: ['slamball'], type: 'cardio', unit: 'kg', load: 8, inc: 2, secPerRep: 2.2, iv: [30, 30],
      muscles: 'Lats, core, full body', tempo: 'Explosive, reset each rep',
      cues: ['Reach tall – ball overhead, up on the toes', 'Slam it down hard, hinge at the hips as you throw', 'Squat to pick it up with a flat back', 'Exhale hard on every slam'],
      mistakes: ['Rounding the back to pick up the ball', 'Throwing with the arms only', 'Using a bouncy ball – it can rebound into your face'],
      anim: {
        focus: ['torso', 'upper'],
        frames: [
          { d: 0.28, l: 'Ball overhead – reach tall', p: slam(stand({ t: 184, aN: [172, 170], aF: [170, 168], hd: -10, lN: [0, 0, 56] })) },
          { d: 0.12, l: 'SLAM', p: slam(stand({ t: 132, lN: [46, -20, 70], aN: [112, 124], aF: [110, 122], hd: 14 })) },
          { d: 0.3, l: 'Ball hits the floor', p: slam(stand({ t: 118, lN: [56, -26, 70], hd: 20, ik: { hN: [46, -36], hF: [48, -35] } }), [50, -13]) },
          { d: 0.32, l: 'Squat to pick up', p: slam(stand({ t: 128, lN: [94, -38, 70], hd: 18, ik: { hN: [46, -16], hF: [54, -15] } }), [50, -13]) },
          { d: 0.55, l: 'Drive up', p: slam(stand({ t: 128, lN: [94, -38, 70], hd: 18, ik: { hN: [46, -16], hF: [54, -15] } }), [50, -13]) }
        ]
      }
    },
    {
      id: 'ball_rot_slam', name: 'Slam ball – rotational slam', equip: ['slamball'], type: 'core', unit: 'kg', load: 6, inc: 2, perSide: true, repsPerCycle: 2, secPerRep: 2.4,
      muscles: 'Obliques, core, lats', tempo: 'Explosive, alternate sides',
      cues: ['Ball overhead, then rotate and slam it beside the outside of one foot', 'Pivot the back foot so the hips turn with the torso', 'Pick it up with a flat back and switch sides', 'Power comes from the hips and core, not the arms'],
      mistakes: ['Twisting the lower back with the feet planted', 'Rounding the back on the pickup', 'Too heavy – the slam turns slow'],
      anim: {
        focus: ['torso'],
        frames: rotSlamFrames('N', '').concat(rotSlamFrames('F', ' – other side'))
      }
    },

    // ------------------------------------------------------------ BATTLE ROPES
    {
      id: 'rope_waves', name: 'Battle ropes – alternating waves', equip: ['ropes'], type: 'cardio', unit: 's', iv: [30, 30],
      muscles: 'Shoulders, arms, core, heart', tempo: 'Fast, rhythmic',
      cues: ['Athletic half squat – hips back, chest up, core braced', 'Alternate arms fast, waves travel all the way to the anchor', 'Move from the shoulders, elbows soft', 'Breathe – don\'t hold it in'],
      mistakes: ['Standing up tall (the lower back takes over)', 'Tiny waves that die halfway', 'Shrugging the shoulders'],
      anim: {
        scene: [ROPE_ANCHOR], focus: ['upper', 'torso'], period: 0.5, label: 'Alternate fast – waves to the anchor',
        fn: function (u) {
          var sw = Math.sin(u * Math.PI * 2);
          return {
            t: 152 + 2 * Math.sin(u * Math.PI * 4), hd: 20, lN: [54, -24, 76], lF: [42, -32, 70], pin: ['fN', 0, -6],
            ik: { hN: [42, -78 + 15 * sw], hF: [40, -78 - 15 * sw] }, bd: { aN: 1, aF: 1 },
            x: { wave: u, ra: [ROPE_ANCHOR.x, -12], amp: 15 }
          };
        }
      }
    },

    // ------------------------------------------------------------ FOAM ROLLER
    {
      id: 'roll_tspine', name: 'Foam roll – upper back', equip: ['roller'], type: 'mobility', unit: 's',
      muscles: 'Upper back, thoracic spine', tempo: 'Slow',
      cues: ['Roller across the upper back, hands support the head', 'Hips slightly up, feet push you slowly up and down', 'Stay between the shoulder blades and the bottom of the ribs', 'Pause and breathe on tight spots'],
      mistakes: ['Rolling the lower back', 'Pulling on the neck', 'Rolling too fast'],
      anim: {
        focus: ['torso'],
        frames: [
          { d: 2.2, l: 'Roll up – exhale', p: supineRoll(-24, 0.45, 0.45, -100, 66) },
          { d: 2.2, l: 'Roll down – inhale', p: supineRoll(-24, 0.45, 0.86, -104, 66) }
        ]
      }
    },
    {
      id: 'roll_quads', name: 'Foam roll – quads', equip: ['roller'], type: 'mobility', unit: 's',
      muscles: 'Quads, hip flexors', tempo: 'Slow',
      cues: ['Face down on the forearms, roller under the thighs', 'Brace the abs – body in a plank line', 'Roll slowly from just above the knee to the hip', 'Pause 10–20 s on tender spots'],
      mistakes: ['Sagging lower back', 'Rolling over the kneecap', 'Racing through it'],
      anim: {
        focus: ['thigh'],
        frames: [
          { d: 2.4, l: 'Roll toward the knee', p: proneRoll(-20, 0.18, 0.18, -38) },
          { d: 2.4, l: 'Roll back to the hip', p: proneRoll(-20, 0.18, 0.78, -38) }
        ]
      }
    },

    // ------------------------------------------------------------ DIP STATION / PARALLETTES
    {
      id: 'dips', name: 'Parallel-bar dip', equip: ['dip'], type: 'strength', unit: 'bw', load: 0, inc: 0,
      muscles: 'Triceps, chest, front delts', tempo: '2-0-1',
      cues: ['Arms locked, shoulders down away from the ears', 'Lean slightly forward, elbows track back', 'Lower until the upper arms are about parallel to the floor', 'Press up to full lockout'],
      mistakes: ['Dropping too deep with rounded shoulders', 'Elbows flaring out', 'Shrugging at the top'],
      anim: {
        scene: [DIPS], focus: ['upper', 'torso'],
        frames: [
          { d: 1.6, l: 'Lower', p: dip(172, [0, 2], [18, -72, -40]) },
          { d: 0.3, l: 'Upper arms parallel', p: dip(160, [-72, 6], [24, -66, -40]) },
          { d: 0.9, l: 'Press up', p: dip(160, [-72, 6], [24, -66, -40]) },
          { d: 0.4, l: 'Lock out', p: dip(172, [0, 2], [18, -72, -40]) }
        ]
      }
    },
    {
      id: 'lsit', name: 'L-sit hold', equip: ['dip'], type: 'core', unit: 's',
      muscles: 'Abs, hip flexors, triceps', tempo: 'Static hold',
      cues: ['Arms locked, push the bars down – shoulders away from the ears', 'Legs straight and together, toes pointed', 'Easier: tuck the knees or one leg straight'],
      mistakes: ['Shoulders shrugging up', 'Knees bending and legs dropping', 'Rounding forward'],
      anim: {
        scene: [DIPS], focus: ['torso', 'thigh'],
        frames: [
          { d: 2, l: 'Push down – legs up', p: dip(182, [-6, -2], [90, 90, 100]) },
          { d: 2, l: 'Breathe – hold', p: dip(184, [-7, -3], [86, 86, 98]) }
        ]
      }
    },

    // ------------------------------------------------------------ LANDMINE
    {
      id: 'landmine_press', name: 'Landmine press (single arm)', equip: ['landmine', 'barbell'], type: 'strength', unit: 'kg', load: 10, inc: 2.5, perSide: true,
      muscles: 'Shoulders, upper chest, triceps', tempo: '1-0-2',
      cues: ['Staggered stance, bar end at the shoulder', 'Press up and forward along the arc, reach at the top', 'Ribs down, glutes tight – no leaning back', 'Shoulder-friendly: the arc keeps the arm in front of the body'],
      mistakes: ['Leaning back to finish the press', 'Elbow flaring wide at the start', 'Shrugging at the top'],
      anim: {
        scene: [lmPress.scene], focus: ['upper', 'torso'],
        frames: [
          { d: 0.9, l: 'Press up & forward', p: lmPress.rack },
          { d: 0.3, l: 'Reach', p: lmPress.lock },
          { d: 1.6, l: 'Controlled down', p: lmPress.lock },
          { d: 0.3, l: 'Bar at the shoulder', p: lmPress.rack }
        ]
      }
    },
    {
      id: 'landmine_row', name: 'Landmine T-bar row', equip: ['landmine', 'barbell'], type: 'strength', unit: 'kg', load: 15, inc: 2.5,
      muscles: 'Lats, mid-back, biceps', tempo: '1-1-2',
      cues: ['Straddle the bar, grip under the plates (V-handle or hands together)', 'Hinge to ~45°, back flat, knees soft', 'Row to the lower chest, elbows close, squeeze 1 s', 'Lower until the arms are straight – keep the hinge'],
      mistakes: ['Standing up as you row', 'Rounded lower back', 'Jerking the weight with the hips'],
      anim: {
        scene: [lmRow.scene], focus: ['torso', 'upper'],
        frames: [
          { d: 0.9, l: 'Row to the chest', p: lmRow.hang },
          { d: 0.5, l: 'Squeeze', p: lmRow.top },
          { d: 1.6, l: 'Lower slowly', p: lmRow.top },
          { d: 0.3, l: 'Arms long, back flat', p: lmRow.hang }
        ]
      }
    },

    // ------------------------------------------------------------ AIR BIKE
    {
      id: 'airbike_sprint', name: 'Air bike – sprint intervals', equip: ['airbike'], type: 'cardio', unit: 'min', iv: [20, 40],
      muscles: 'Full body, heart', tempo: 'All-out sprints',
      cues: ['Push and pull the handles while you pedal – arms AND legs', 'Sprint all-out for the work interval, easy spin to recover', 'The fan is the resistance: the harder you go, the harder it gets', 'Stay seated, core braced'],
      mistakes: ['Legs only, arms just along for the ride', 'Going out too hard on round 1', 'Rocking the torso side to side'],
      anim: airAnim(0.48, 'Push & pull – arms and legs')
    },
    {
      id: 'airbike_z2', name: 'Air bike – steady / Zone 2', equip: ['airbike'], type: 'cardio', unit: 'min',
      muscles: 'Full body, heart', tempo: '50–60 RPM',
      cues: ['Even rhythm, arms and legs share the work', 'Pace: you can talk in full sentences', 'Relax the grip, shoulders down'],
      mistakes: ['Creeping into a sprint', 'Death grip on the handles'],
      anim: airAnim(1.0, 'Smooth – arms and legs together')
    }
  ];

  // Focus groups per exercise — primary group first. Drives library filters and the session builder.
  var FOCUS = {
    noge: { name: 'Legs', icon: '🦵' },
    zadnjica: { name: 'Glutes', icon: '🍑' },
    prsa: { name: 'Chest', icon: '🫁' },
    hrbet: { name: 'Back', icon: '🔙' },
    rame: { name: 'Shoulders', icon: '🤷' },
    roke: { name: 'Arms', icon: '💪' },
    trup: { name: 'Core', icon: '🎯' },
    kardio: { name: 'Cardio', icon: '❤️' },
    hyrox: { name: 'Hybrid race', icon: '🏁' },
    mobilnost: { name: 'Mobility', icon: '🧘' }
  };
  var GROUPS = {
    bike_z2: ['kardio', 'noge'], bike_hiit: ['kardio', 'noge'], row_hiit: ['kardio', 'hrbet'],
    kb_swing: ['zadnjica', 'kardio', 'trup'], kb_goblet_squat: ['noge', 'zadnjica', 'trup'], kb_deadlift: ['zadnjica', 'noge', 'hrbet'], kb_press: ['rame', 'roke', 'trup'],
    db_bench: ['prsa', 'roke', 'rame'], db_incline: ['prsa', 'rame', 'roke'], db_row: ['hrbet', 'roke'], db_rdl: ['zadnjica', 'noge', 'hrbet'],
    db_bulgarian: ['noge', 'zadnjica'], db_shoulder_press: ['rame', 'roke'], db_curl: ['roke'], db_hip_thrust: ['zadnjica', 'noge'], db_stepup: ['noge', 'zadnjica'],
    k_chest_press: ['prsa', 'roke', 'trup'], k_row: ['hrbet', 'roke'], k_pulldown: ['hrbet', 'roke'], k_face_pull: ['rame', 'hrbet'],
    k_pushdown: ['roke'], k_pullthrough: ['zadnjica', 'noge'], k_woodchop: ['trup'],
    pullup: ['hrbet', 'roke', 'trup'], hang_knee_raise: ['trup'], hang_leg_raise: ['trup'], dead_hang: ['mobilnost', 'hrbet'],
    back_ext: ['hrbet', 'zadnjica'], situp: ['trup'], pushup: ['prsa', 'roke', 'trup'], plank: ['trup'], dead_bug: ['trup'], bird_dog: ['trup', 'hrbet'],
    hip_flexor: ['mobilnost', 'noge'], hamstring_bench: ['mobilnost', 'noge'],
    hx_bike_run: ['kardio', 'noge', 'hyrox'], k_ski: ['kardio', 'hrbet', 'trup', 'hyrox'], bike_sled: ['kardio', 'noge', 'hyrox'], k_sled_pull: ['kardio', 'hrbet', 'roke', 'hyrox'],
    burpee_bj: ['kardio', 'noge', 'prsa', 'hyrox'], kb_farmers: ['kardio', 'trup', 'roke', 'hyrox'], kb_lunge: ['noge', 'zadnjica', 'hyrox'], db_thruster: ['noge', 'rame', 'kardio', 'hyrox'],
    row_steady: ['kardio', 'hrbet', 'hyrox'],
    treadmill_run: ['kardio', 'noge', 'hyrox'], skierg: ['kardio', 'hrbet', 'trup', 'hyrox'], sled_push: ['kardio', 'noge', 'zadnjica', 'hyrox'],
    sled_pull: ['kardio', 'hrbet', 'roke', 'hyrox'], wall_ball: ['kardio', 'noge', 'rame', 'hyrox'], sandbag_lunge: ['noge', 'zadnjica', 'hyrox'],
    bb_squat: ['noge', 'zadnjica', 'trup'], bb_deadlift: ['zadnjica', 'noge', 'hrbet'], bb_bench: ['prsa', 'roke', 'rame'], box_jump: ['noge', 'zadnjica'],
    jump_rope: ['kardio', 'noge'], band_row: ['hrbet', 'roke'], band_pushdown: ['roke'], db_farmers: ['kardio', 'trup', 'roke'],
    bw_squat: ['noge', 'zadnjica'], bw_lunge: ['noge', 'zadnjica'], glute_bridge: ['zadnjica', 'noge'], mountain_climber: ['kardio', 'trup'], high_knees: ['kardio', 'noge'],
    susp_row: ['hrbet', 'roke', 'trup'], susp_pushup: ['prsa', 'roke', 'trup'], susp_squat: ['noge', 'zadnjica'], susp_fallout: ['trup', 'rame'],
    abwheel_rollout: ['trup'], ball_slam: ['kardio', 'trup', 'rame'], ball_rot_slam: ['trup', 'kardio'], rope_waves: ['kardio', 'rame', 'roke'],
    roll_tspine: ['mobilnost', 'hrbet'], roll_quads: ['mobilnost', 'noge'], dips: ['roke', 'prsa', 'rame'], lsit: ['trup', 'roke'],
    landmine_press: ['rame', 'prsa', 'roke'], landmine_row: ['hrbet', 'roke'], airbike_sprint: ['kardio', 'noge', 'roke'], airbike_z2: ['kardio', 'noge'],
    knee_pushup: ['prsa', 'roke', 'trup'], pike_pushup: ['rame', 'roke'], superman: ['hrbet', 'zadnjica'], prone_y_raise: ['hrbet', 'rame'],
    side_plank: ['trup'], wall_sit: ['noge', 'zadnjica'], jump_squat: ['noge', 'zadnjica', 'kardio'], burpee: ['kardio', 'prsa', 'noge'],
    hollow_hold: ['trup'], sl_glute_bridge: ['zadnjica', 'noge'], hamstring_floor: ['mobilnost', 'noge']
  };
  // Multi-joint lifts go first in a generated session
  var COMPOUND = ['bb_squat', 'bb_deadlift', 'bb_bench', 'kb_goblet_squat', 'kb_deadlift', 'db_rdl', 'db_bulgarian', 'db_hip_thrust', 'kb_swing', 'db_bench', 'db_incline', 'pullup',
    'db_row', 'k_pulldown', 'db_shoulder_press', 'kb_press', 'k_chest_press', 'k_row', 'db_stepup', 'pushup', 'k_pullthrough', 'back_ext',
    'landmine_row', 'landmine_press', 'dips', 'susp_row', 'susp_pushup', 'susp_squat', 'pike_pushup'];

  // Movement patterns, each list in preference order. Used to substitute exercises
  // when a profile lacks equipment, and to upgrade hybrid race substitutes to the real station.
  var PATTERNS = {
    squat: ['bb_squat', 'kb_goblet_squat', 'bw_squat', 'jump_squat', 'wall_sit', 'susp_squat'],
    hinge: ['bb_deadlift', 'kb_deadlift', 'db_rdl', 'glute_bridge', 'sl_glute_bridge'],
    swing: ['kb_swing', 'k_pullthrough', 'db_rdl', 'jump_squat', 'glute_bridge', 'sl_glute_bridge'],
    bridge: ['db_hip_thrust', 'glute_bridge', 'sl_glute_bridge'],
    lunge: ['db_bulgarian', 'db_stepup', 'kb_lunge', 'sandbag_lunge', 'bw_lunge', 'jump_squat', 'wall_sit'],
    stepup: ['db_stepup', 'box_jump', 'db_bulgarian', 'bw_lunge', 'jump_squat', 'wall_sit'],
    backext: ['back_ext', 'superman', 'k_pullthrough', 'glute_bridge', 'bird_dog'],
    hpush: ['db_bench', 'bb_bench', 'k_chest_press', 'pushup', 'susp_pushup', 'dips', 'knee_pushup'],
    incline: ['db_incline', 'k_chest_press', 'bb_bench', 'pushup', 'landmine_press', 'susp_pushup', 'knee_pushup'],
    vpush: ['db_shoulder_press', 'kb_press', 'pike_pushup', 'pushup', 'landmine_press', 'knee_pushup'],
    hpull: ['db_row', 'k_row', 'band_row', 'pullup', 'landmine_row', 'susp_row', 'superman', 'prone_y_raise'],
    vpull: ['pullup', 'k_pulldown', 'band_row', 'db_row', 'susp_row', 'landmine_row', 'superman', 'prone_y_raise'],
    rear: ['k_face_pull', 'band_row', 'db_row', 'susp_row', 'prone_y_raise', 'superman'],
    curl: ['db_curl', 'band_row'],
    triceps: ['k_pushdown', 'band_pushdown', 'pushup', 'dips', 'knee_pushup'],
    corehang: ['hang_knee_raise', 'hang_leg_raise', 'situp', 'dead_bug', 'lsit', 'abwheel_rollout', 'hollow_hold'],
    coreflex: ['situp', 'hang_knee_raise', 'dead_bug', 'abwheel_rollout', 'susp_fallout', 'hollow_hold'],
    corerot: ['k_woodchop', 'side_plank', 'bird_dog', 'plank', 'ball_rot_slam'],
    hang: ['dead_hang', 'hip_flexor', 'roll_tspine'],
    stretch: ['hamstring_bench', 'hamstring_floor', 'hip_flexor'],
    thruster: ['db_thruster', 'wall_ball', 'kb_goblet_squat', 'bw_squat'],
    carry: ['kb_farmers', 'db_farmers', 'plank', 'side_plank'],
    steady: ['bike_z2', 'row_steady', 'treadmill_run', 'skierg', 'jump_rope', 'high_knees', 'airbike_z2'],
    steadyRow: ['row_steady', 'skierg', 'bike_z2', 'treadmill_run', 'high_knees', 'airbike_z2'],
    intervals: ['bike_hiit', 'row_hiit', 'treadmill_run', 'skierg', 'jump_rope', 'high_knees', 'mountain_climber', 'airbike_sprint', 'rope_waves', 'ball_slam', 'burpee'],
    intervalsRow: ['row_hiit', 'skierg', 'bike_hiit', 'treadmill_run', 'jump_rope', 'high_knees', 'airbike_sprint', 'rope_waves', 'mountain_climber', 'burpee'],
    hxrun: ['treadmill_run', 'hx_bike_run', 'row_steady', 'high_knees'],
    hxski: ['skierg', 'k_ski', 'row_steady', 'mountain_climber'],
    hxpush: ['sled_push', 'bike_sled', 'mountain_climber'],
    hxpull: ['sled_pull', 'k_sled_pull', 'band_row', 'db_row', 'superman'],
    hxwb: ['wall_ball', 'db_thruster', 'bw_squat', 'jump_squat'],
    hxlunge: ['sandbag_lunge', 'kb_lunge', 'bw_lunge'],
    hxcarry: ['kb_farmers', 'db_farmers'],
    hxrow: ['row_steady', 'skierg', 'bike_z2', 'airbike_z2'],
    burpee: ['burpee_bj', 'burpee', 'mountain_climber', 'ball_slam'],
    plank: ['plank', 'dead_bug', 'abwheel_rollout', 'susp_fallout', 'side_plank', 'hollow_hold'], deadbug: ['dead_bug', 'plank', 'hollow_hold'], birddog: ['bird_dog', 'dead_bug', 'side_plank'], pushup: ['pushup', 'k_chest_press', 'susp_pushup', 'knee_pushup'], hipflex: ['hip_flexor', 'roll_quads'],
    // patterns introduced with the extra equipment
    rollout: ['abwheel_rollout', 'susp_fallout', 'plank', 'dead_bug'], lsit: ['lsit', 'hang_leg_raise', 'hang_knee_raise', 'plank'],
    dip: ['dips', 'db_bench', 'k_chest_press', 'pushup', 'k_pushdown', 'knee_pushup'], landmine: ['landmine_press', 'db_shoulder_press', 'kb_press', 'pike_pushup', 'pushup'],
    slam: ['ball_slam', 'kb_swing', 'burpee', 'burpee_bj', 'mountain_climber'], rotslam: ['ball_rot_slam', 'k_woodchop', 'bird_dog'],
    ropes: ['rope_waves', 'ball_slam', 'mountain_climber', 'high_knees'], foam: ['roll_tspine', 'dead_hang'], foamq: ['roll_quads', 'hip_flexor'],
    airhiit: ['airbike_sprint', 'bike_hiit', 'row_hiit', 'skierg', 'mountain_climber'], airz2: ['airbike_z2', 'bike_z2', 'row_steady', 'high_knees'],
    susprow: ['susp_row', 'db_row', 'k_row', 'band_row'], susppush: ['susp_pushup', 'pushup', 'k_chest_press'], suspsquat: ['susp_squat', 'kb_goblet_squat', 'bw_squat'],
    lmrow: ['landmine_row', 'db_row', 'k_row', 'band_row', 'superman', 'prone_y_raise'],
    // bodyweight-only additions
    superman: ['superman', 'prone_y_raise', 'bird_dog']
  };
  var PATTERN_OF = {
    kb_goblet_squat: 'squat', bb_squat: 'squat', bw_squat: 'squat', kb_deadlift: 'hinge', bb_deadlift: 'hinge', db_rdl: 'hinge', kb_swing: 'swing', k_pullthrough: 'swing',
    db_hip_thrust: 'bridge', glute_bridge: 'bridge', db_bulgarian: 'lunge', kb_lunge: 'hxlunge', bw_lunge: 'lunge', db_stepup: 'stepup', box_jump: 'stepup', back_ext: 'backext',
    db_bench: 'hpush', bb_bench: 'hpush', k_chest_press: 'hpush', db_incline: 'incline', db_shoulder_press: 'vpush', kb_press: 'vpush',
    db_row: 'hpull', k_row: 'hpull', band_row: 'hpull', pullup: 'vpull', k_pulldown: 'vpull', k_face_pull: 'rear', db_curl: 'curl', k_pushdown: 'triceps', band_pushdown: 'triceps',
    hang_knee_raise: 'corehang', hang_leg_raise: 'corehang', situp: 'coreflex', k_woodchop: 'corerot', dead_hang: 'hang', hamstring_bench: 'stretch', hip_flexor: 'hipflex',
    db_thruster: 'hxwb', kb_farmers: 'carry', db_farmers: 'carry', bike_z2: 'steady', row_steady: 'steadyRow', bike_hiit: 'intervals', row_hiit: 'intervalsRow',
    hx_bike_run: 'hxrun', treadmill_run: 'hxrun', k_ski: 'hxski', skierg: 'hxski', bike_sled: 'hxpush', sled_push: 'hxpush', k_sled_pull: 'hxpull', sled_pull: 'hxpull',
    wall_ball: 'hxwb', sandbag_lunge: 'hxlunge', burpee_bj: 'burpee', plank: 'plank', dead_bug: 'deadbug', bird_dog: 'birddog', pushup: 'pushup',
    jump_rope: 'intervals', high_knees: 'intervals', mountain_climber: 'intervals',
    susp_row: 'susprow', susp_pushup: 'susppush', susp_squat: 'suspsquat', susp_fallout: 'rollout', abwheel_rollout: 'rollout', lsit: 'lsit', dips: 'dip',
    landmine_press: 'landmine', landmine_row: 'lmrow', ball_slam: 'slam', ball_rot_slam: 'rotslam', rope_waves: 'ropes',
    roll_tspine: 'foam', roll_quads: 'foamq', airbike_sprint: 'airhiit', airbike_z2: 'airz2',
    knee_pushup: 'pushup', pike_pushup: 'vpush', superman: 'superman', prone_y_raise: 'rear', side_plank: 'corerot', wall_sit: 'squat',
    jump_squat: 'squat', burpee: 'burpee', hollow_hold: 'coreflex', sl_glute_bridge: 'bridge', hamstring_floor: 'stretch'
  };

  // Working muscles per exercise: [primary, secondary]. Drives the glowing muscles on the figure,
  // the on-figure labels and the front/back muscle map.
  var MUSCLES = {
    bike_z2: [['quads'], ['glutes', 'calves', 'hams']], bike_hiit: [['quads', 'glutes'], ['calves', 'hams']], hx_bike_run: [['quads'], ['glutes', 'calves']],
    bike_sled: [['quads', 'glutes'], ['calves', 'hams']],
    row_steady: [['lats', 'quads'], ['glutes', 'hams', 'biceps', 'traps']], row_hiit: [['lats', 'quads', 'glutes'], ['hams', 'biceps', 'traps']],
    kb_swing: [['glutes', 'hams'], ['lowback', 'abs', 'forearms']], kb_goblet_squat: [['quads', 'glutes'], ['abs', 'lowback']],
    kb_deadlift: [['glutes', 'hams'], ['lowback', 'quads', 'forearms']], kb_press: [['delts', 'triceps'], ['abs', 'traps']],
    db_bench: [['chest', 'triceps'], ['delts']], db_incline: [['chest', 'delts'], ['triceps']], db_row: [['lats', 'traps'], ['biceps', 'forearms']],
    db_rdl: [['hams', 'glutes'], ['lowback', 'forearms']], db_bulgarian: [['quads', 'glutes'], ['hams', 'abs']], db_shoulder_press: [['delts', 'triceps'], ['traps']],
    db_curl: [['biceps'], ['forearms']], db_hip_thrust: [['glutes'], ['hams', 'quads']], db_stepup: [['quads', 'glutes'], ['calves', 'hams']],
    k_chest_press: [['chest', 'triceps'], ['delts', 'abs']], k_row: [['lats', 'traps'], ['biceps', 'delts']], k_pulldown: [['lats'], ['biceps', 'traps']],
    k_face_pull: [['delts', 'traps'], ['biceps']], k_pushdown: [['triceps'], ['forearms']], k_pullthrough: [['glutes', 'hams'], ['lowback']],
    k_woodchop: [['obliques', 'abs'], ['delts', 'glutes']], pullup: [['lats', 'biceps'], ['traps', 'forearms', 'abs']],
    hang_knee_raise: [['abs', 'hipflex'], ['obliques', 'forearms']], hang_leg_raise: [['abs', 'hipflex'], ['obliques', 'forearms']], dead_hang: [['forearms', 'lats'], ['delts']],
    back_ext: [['lowback', 'glutes'], ['hams']], situp: [['abs'], ['hipflex', 'obliques']], pushup: [['chest', 'triceps'], ['delts', 'abs']],
    plank: [['abs'], ['obliques', 'delts', 'glutes']], dead_bug: [['abs'], ['obliques', 'hipflex']], bird_dog: [['lowback', 'glutes'], ['abs', 'delts']],
    hip_flexor: [['hipflex'], ['quads']], hamstring_bench: [['hams'], ['calves', 'lowback']],
    k_ski: [['lats', 'triceps'], ['abs', 'glutes']], k_sled_pull: [['lats', 'biceps'], ['traps', 'glutes', 'forearms']], burpee_bj: [['quads', 'chest'], ['glutes', 'triceps', 'abs']],
    kb_farmers: [['forearms', 'traps'], ['abs', 'glutes']], kb_lunge: [['quads', 'glutes'], ['hams', 'abs']], db_thruster: [['quads', 'delts'], ['glutes', 'triceps']],
    treadmill_run: [['quads', 'calves'], ['glutes', 'hams']], skierg: [['lats', 'triceps'], ['abs', 'glutes']], sled_push: [['quads', 'glutes'], ['calves', 'abs']],
    sled_pull: [['lats', 'biceps'], ['traps', 'glutes', 'forearms']], wall_ball: [['quads', 'delts'], ['glutes', 'triceps']], sandbag_lunge: [['quads', 'glutes'], ['traps', 'abs']],
    bb_squat: [['quads', 'glutes'], ['lowback', 'abs', 'hams']], bb_deadlift: [['glutes', 'hams', 'lowback'], ['traps', 'forearms', 'quads']], bb_bench: [['chest', 'triceps'], ['delts']],
    box_jump: [['quads', 'glutes'], ['calves']], jump_rope: [['calves'], ['quads', 'delts']], band_row: [['lats', 'traps'], ['biceps']], band_pushdown: [['triceps'], ['forearms']],
    db_farmers: [['forearms', 'traps'], ['abs', 'glutes']], bw_squat: [['quads', 'glutes'], ['abs']], bw_lunge: [['quads', 'glutes'], ['hams']], glute_bridge: [['glutes'], ['hams']],
    mountain_climber: [['abs', 'hipflex'], ['delts', 'quads']], high_knees: [['hipflex', 'calves'], ['quads', 'abs']],
    susp_row: [['lats', 'traps'], ['biceps', 'delts', 'abs']], susp_pushup: [['chest', 'triceps'], ['delts', 'abs']], susp_squat: [['quads', 'glutes'], ['hams', 'calves']],
    susp_fallout: [['abs', 'lats'], ['delts', 'obliques']], abwheel_rollout: [['abs', 'lats'], ['obliques', 'delts', 'hipflex']],
    ball_slam: [['lats', 'abs'], ['glutes', 'delts', 'triceps']], ball_rot_slam: [['obliques', 'abs'], ['lats', 'glutes', 'delts']],
    rope_waves: [['delts', 'forearms'], ['abs', 'biceps', 'quads']], roll_tspine: [['traps'], ['lats', 'lowback']], roll_quads: [['quads'], ['hipflex']],
    dips: [['triceps', 'chest'], ['delts']], lsit: [['abs', 'hipflex'], ['triceps', 'quads']],
    landmine_press: [['delts', 'chest'], ['triceps', 'abs']], landmine_row: [['lats', 'traps'], ['biceps', 'lowback', 'hams']],
    airbike_sprint: [['quads', 'glutes', 'lats'], ['delts', 'triceps', 'calves']], airbike_z2: [['quads'], ['glutes', 'lats', 'delts']],
    knee_pushup: [['chest', 'triceps'], ['delts', 'abs']], pike_pushup: [['delts', 'triceps'], ['traps', 'chest']],
    superman: [['lowback', 'glutes'], ['hams', 'traps', 'delts']], prone_y_raise: [['traps', 'delts'], ['lowback']],
    side_plank: [['obliques'], ['abs', 'glutes', 'delts']], wall_sit: [['quads'], ['glutes', 'calves']], jump_squat: [['quads', 'glutes'], ['calves', 'hams']],
    burpee: [['quads', 'chest'], ['glutes', 'triceps', 'abs', 'delts']], hollow_hold: [['abs'], ['hipflex', 'obliques']],
    sl_glute_bridge: [['glutes'], ['hams', 'abs']], hamstring_floor: [['hams'], ['calves', 'lowback']]
  };
  // which joint checkpoints teach the movement best
  function guidesFor(e, mus) {
    var all = mus[0].concat(mus[1]), g = [];
    var hinge = /rdl|deadlift|swing|pullthrough|back_ext|good|row\b|db_row|bird/.test(e.id);
    if (hinge || mus[0].indexOf('lowback') >= 0) g.push('spine');
    if (/squat|lunge|bulgarian|stepup|thruster|wall_ball|box|sled_push/.test(e.id)) g.push('knee');
    if (hinge || /thrust|bridge|squat/.test(e.id)) g.push('hip');
    if (!g.length && (all.indexOf('triceps') >= 0 || all.indexOf('biceps') >= 0 || all.indexOf('chest') >= 0)) g.push('elbow');
    return g;
  }

  var BY_ID = {};
  LIST.forEach(function (e) {
    var mu = MUSCLES[e.id] || [[], []];
    e.anim.muscles = { p: mu[0], s: mu[1] };
    e.anim.guides = guidesFor(e, mu);
    e.groups = GROUPS[e.id] || [];
    e.compound = COMPOUND.indexOf(e.id) >= 0;
    BY_ID[e.id] = e;
  });

  // true when every piece of equipment the exercise needs is owned (bodyweight is always available)
  function available(id, owned) {
    var e = BY_ID[id];
    return !!e && e.equip.every(function (k) { return k === 'floor' || owned.indexOf(k) >= 0; });
  }
  // best available exercise for a slot: the original, else first available in its movement pattern
  function substitute(id, owned, avoid) {
    if (available(id, owned)) return id;
    var list = PATTERNS[PATTERN_OF[id]] || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] !== id && available(list[i], owned) && (!avoid || avoid.indexOf(list[i]) < 0)) return list[i];
    }
    return null;
  }

  global.Exercises = {
    LIST: LIST, BY_ID: BY_ID, EQUIP: EQUIP, EQUIP_GROUPS: EQUIP_GROUPS, HOME_GYM: HOME_GYM, FOCUS: FOCUS, COMPOUND: COMPOUND,
    PATTERNS: PATTERNS, PATTERN_OF: PATTERN_OF, available: available, substitute: substitute
  };
})(window);
