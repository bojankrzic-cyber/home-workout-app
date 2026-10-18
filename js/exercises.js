/*
 * Exercise library — every exercise uses only the home equipment:
 * exercise bike, water rower, kettlebells, dumbbells, NOHrD TriaTrainer (abs/back),
 * NOHrD weight bench, Technogym Kinesis Personal, wall pull-up / leg-raise station.
 *
 * anim.frames: looping keyframes, each { d: seconds to next frame, l: phase label, p: pose }.
 * Pose fields are documented in figure.js.
 */
(function (global) {
  'use strict';

  function m(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }
  var FOOT = ['fN', 0, -6];
  function stand(x) { return m({ t: 180, lN: [0, 0], aN: [0, 0], pin: FOOT }, x || {}); }

  var EQUIP = {
    bike: { name: 'Sobno kolo', icon: '🚴' },
    rower: { name: 'Veslač', icon: '🚣' },
    kb: { name: 'Kettlebell', icon: '🔔' },
    db: { name: 'Uteži (dumbbells)', icon: '🏋️' },
    tria: { name: 'NOHrD TriaTrainer (trebušne/hrbet)', icon: '🪵' },
    bench: { name: 'NOHrD klop', icon: '🛋️' },
    kinesis: { name: 'Technogym Kinesis Personal', icon: '🎛️' },
    wall: { name: 'Stena (drog / dvig nog)', icon: '🧗' },
    floor: { name: 'Lastna teža', icon: '🧘' }
  };

  // ---------------------------------------------------------------- cardio
  var BIKE = { type: 'bike', sx: -28, sy: -96, cx: 0, cy: -32, bx: 38, by: -112 };
  function bikeAnim(period) {
    return {
      scene: [BIKE], period: period, label: 'Enakomeren krog pedala',
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
      { d: 0.42, l: 'Noge potisnejo', p: rowPose(FX - 60, 155, [FX + 6, -56]) },
      { d: 0.42, l: 'Trup nazaj, roke potegnejo', p: rowPose(FX - 89, 160, [FX - 22, -58]) },
      { d: 0.18, l: 'Zaključek', p: rowPose(FX - 91, 198, [FX - 86, -62]) },
      { d: 0.55, l: 'Roke ven', p: rowPose(FX - 91, 198, [FX - 86, -62]) },
      { d: 0.75, l: 'Trup naprej, počasi nazaj', p: rowPose(FX - 89, 160, [FX - 24, -57]) }
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

  // ------------------------------------------------------------ TriaTrainer
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


  // ------------------------------------------------------------ HYROX substitutes
  // Standing heavy climb on the bike (sled-push substitute): hips out of the saddle, bob with the stroke
  function bikeStandAnim(period) {
    return {
      scene: [BIKE], period: period, label: 'Stoje, težak upor – potiskaj',
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
    hold: { N: 'kb', F: 'kb' }, focus: ['fore', 'torso', 'glute'], period: 1.1, label: 'Hodi visoko, ramena dol',
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

  // ======================================================================
  var LIST = [
    // ---------------------------------------------------------------- CARDIO
    {
      id: 'bike_z2', name: 'Sobno kolo – ogrevanje / cona 2', equip: ['bike'], type: 'cardio', unit: 'min',
      muscles: 'Srce, noge', tempo: '80–90 obratov/min',
      cues: ['Sedež na višini kolka – koleno ostane rahlo pokrčeno spodaj', 'Ramena sproščena, trup nagnjen ~30°', 'Tempo: lahko še govoriš v celih stavkih (RPE 4–5)'],
      mistakes: ['Prenizek sedež (bolečina v kolenu)', 'Zibanje bokov na sedežu'],
      anim: bikeAnim(0.75)
    },
    {
      id: 'bike_hiit', name: 'Sobno kolo – intervali', equip: ['bike'], type: 'cardio', unit: 'min',
      muscles: 'Srce, noge', tempo: '100+ obratov/min v sprintu',
      cues: ['Sprint 20 s maksimalno, 40 s lahkotno', 'Upor zvišaj, da kadenca ne zleti čez 110', 'Trup miren, moč iz kolkov'],
      mistakes: ['Premajhen upor – samo vrtenje brez sile', 'Zadrževanje diha'],
      anim: bikeAnim(0.55)
    },
    {
      id: 'row_steady', name: 'Veslač – tehnika / enakomerno', equip: ['rower'], type: 'cardio', unit: 'min',
      muscles: 'Noge, hrbet, roke', tempo: '20–24 zaveslajev/min',
      cues: ['Zaporedje: NOGE → TRUP → ROKE, nazaj ROKE → TRUP → NOGE', 'Razmerje 1 : 2 – potisk hiter, povratek počasen', 'Golen navpično na začetku, hrbet raven'],
      mistakes: ['Vlečenje z rokami pred nogami', 'Prevelik nagib nazaj na koncu'],
      anim: ROW_ANIM, speed: 0.95
    },
    {
      id: 'row_hiit', name: 'Veslač – intervali', equip: ['rower'], type: 'cardio', unit: 'min',
      muscles: 'Celo telo, srce', tempo: '26–30 zaveslajev/min v intervalu',
      cues: ['30 s močno, 30 s lahkotno', 'Moč pride iz potiska nog, ne iz rok', 'Glej 500 m čas – drži ga stabilnega med serijami'],
      mistakes: ['Hitra frekvenca brez sile', 'Krivljenje hrbta na začetku zaveslaja'],
      anim: ROW_ANIM, speed: 1.25
    },

    // ------------------------------------------------------------ KETTLEBELL
    {
      id: 'kb_swing', name: 'Kettlebell swing', equip: ['kb'], type: 'strength', unit: 'kg', load: 16, inc: 4,
      muscles: 'Zadnjica, zadnje stegenske, trup', tempo: 'Eksplozivno',
      cues: ['Zgib v kolkih (hinge), NE počep – boki gredo nazaj', 'Eksplozivni potisk bokov, zadnjica stisnjena na vrhu', 'Roke so samo vrvi – KB do višine prsi', 'Izdih na vrhu, trebušne napete'],
      mistakes: ['Dviganje z rokami', 'Zaokrožen hrbet spodaj', 'Nagib nazaj na vrhu'],
      anim: {
        scene: [], hold: { N: 'kb' }, focus: ['glute', 'thigh'],
        frames: [
          { d: 0.55, l: 'Zgib – boki nazaj', p: swingTop },
          { d: 0.12, l: 'Spodaj', p: swingBot },
          { d: 0.5, l: 'POTISK BOKOV', p: swingBot },
          { d: 0.15, l: 'Vrh – stisni zadnjico', p: swingTop }
        ]
      }
    },
    {
      id: 'kb_goblet_squat', name: 'Goblet počep s kettlebellom', equip: ['kb'], type: 'strength', unit: 'kg', load: 16, inc: 4,
      muscles: 'Kvadricepsi, zadnjica, trup', tempo: '3-1-1',
      cues: ['KB ob prsnici, komolci navzdol', 'Kolena sledijo prstom, peta ostane na tleh', 'Spusti se počasi 3 s, kratka pavza spodaj', 'Prsni koš pokonci'],
      mistakes: ['Pete se dvigujejo', 'Kolena padajo navznoter', 'Plitev počep'],
      anim: {
        hold: { N: 'kb' }, focus: ['thigh', 'glute'],
        frames: [
          { d: 2.2, l: 'Spuščaj 3 s', p: gobTop },
          { d: 0.5, l: 'Pavza spodaj', p: gobBot },
          { d: 1.0, l: 'Potisni gor', p: gobBot },
          { d: 0.6, l: 'Stoj vzravnano', p: gobTop }
        ]
      }
    },
    {
      id: 'kb_deadlift', name: 'Mrtvi dvig s kettlebellom', equip: ['kb'], type: 'strength', unit: 'kg', load: 24, inc: 4,
      muscles: 'Zadnjica, zadnje stegenske, hrbet', tempo: '2-0-1',
      cues: ['KB med stopali, stopala nekoliko širše od bokov', 'Boki nazaj, hrbet nevtralen, lopatice "v žepe"', 'Potisni tla stran in iztegni boke'],
      mistakes: ['Okrogel hrbet', 'Vlečenje z rokami'],
      anim: {
        hold: { N: 'kb' }, focus: ['glute', 'thigh', 'torso'],
        frames: [
          { d: 1.6, l: 'Spusti – boki nazaj', p: dlTop },
          { d: 0.4, l: 'Napni hrbet', p: dlBot },
          { d: 1.0, l: 'Potisni tla', p: dlBot },
          { d: 0.6, l: 'Vrh', p: dlTop }
        ]
      }
    },
    {
      id: 'kb_press', name: 'Potisk kettlebella nad glavo (enoročno)', equip: ['kb'], type: 'strength', unit: 'kg', load: 12, inc: 4, perSide: true,
      muscles: 'Ramena, triceps, trup', tempo: '1-1-2',
      cues: ['Začni v "rack" poziciji – KB na podlakti, zapestje ravno', 'Stisni zadnjico in trebušne, rebra dol', 'Potisni navpično, biceps ob uho'],
      mistakes: ['Prekomerna ukrivljenost ledvenega dela', 'Upognjeno zapestje'],
      anim: {
        hold: { N: 'kb' }, focus: ['upper', 'fore'],
        frames: [
          { d: 0.9, l: 'Potisni gor', p: pressRack },
          { d: 0.5, l: 'Zakleni zgoraj', p: pressTop },
          { d: 1.6, l: 'Kontrolirano dol', p: pressTop },
          { d: 0.4, l: 'Rack', p: pressRack }
        ]
      }
    },

    // ------------------------------------------------------------ DUMBBELLS
    {
      id: 'db_bench', name: 'Potisk z utežmi na klopi', equip: ['db', 'bench'], type: 'strength', unit: 'kg', load: 16, inc: 2,
      muscles: 'Prsa, triceps, sprednja rama', tempo: '3-1-1',
      cues: ['Lopatice skupaj in navzdol, rahel lok', 'Komolci ~45° od trupa', 'Spusti 3 s do višine prsi, potisni gor in rahlo skupaj'],
      mistakes: ['Komolci pod 90° na stran', 'Odbijanje uteži od prsi'],
      anim: {
        scene: [BENCH_FLAT], hold: { N: 'db', F: 'db' }, focus: ['torso', 'upper'],
        frames: [
          { d: 2.2, l: 'Spuščaj 3 s', p: benchPose([172, 172]) },
          { d: 0.4, l: 'Pavza', p: benchPose([62, 178]) },
          { d: 0.9, l: 'Potisni', p: benchPose([62, 178]) },
          { d: 0.5, l: 'Vrh', p: benchPose([172, 172]) }
        ]
      }
    },
    {
      id: 'db_incline', name: 'Potisk z utežmi na poševni klopi', equip: ['db', 'bench'], type: 'strength', unit: 'kg', load: 14, inc: 2,
      muscles: 'Zgornja prsa, rame, triceps', tempo: '3-0-1',
      cues: ['Naslon na ~30–45°', 'Uteži potisni navpično nad zgornji del prsi', 'Lopatice prilepljene na klop'],
      mistakes: ['Prestrm naklon (postane potisk za rame)', 'Dvigovanje zadnjice'],
      anim: {
        scene: [BENCH_INC], hold: { N: 'db', F: 'db' }, focus: ['torso', 'upper'],
        frames: [
          { d: 2.2, l: 'Spuščaj', p: incPose([178, 178]) },
          { d: 0.3, l: 'Spodaj', p: incPose([28, 182]) },
          { d: 0.9, l: 'Potisni', p: incPose([28, 182]) },
          { d: 0.5, l: 'Vrh', p: incPose([178, 178]) }
        ]
      }
    },
    {
      id: 'db_row', name: 'Enoročno veslanje z utežjo', equip: ['db', 'bench'], type: 'strength', unit: 'kg', load: 20, inc: 2, perSide: true,
      muscles: 'Široka hrbtna, romboidi, biceps', tempo: '1-1-2',
      cues: ['Koleno in dlan na klopi, hrbet raven kot miza', 'Komolec vleci proti boku (ne proti rami)', 'Na vrhu stisni lopatico, nato počasi dol'],
      mistakes: ['Rotacija trupa', 'Vlečenje z bicepsom'],
      anim: {
        scene: [BENCH_ROW], hold: { N: 'db' }, focus: ['torso', 'upper'],
        frames: [
          { d: 0.9, l: 'Vleci komolec k boku', p: rowDb([0, 0]) },
          { d: 0.5, l: 'Stisni lopatico', p: rowDb([-100, 10]) },
          { d: 1.5, l: 'Kontrolirano dol', p: rowDb([-100, 10]) },
          { d: 0.3, l: 'Iztegni', p: rowDb([0, 0]) }
        ]
      }
    },
    {
      id: 'db_rdl', name: 'Romunski mrtvi dvig z utežmi', equip: ['db'], type: 'strength', unit: 'kg', load: 20, inc: 2,
      muscles: 'Zadnje stegenske, zadnjica, hrbet', tempo: '3-0-1',
      cues: ['Kolena rahlo pokrčena in fiksna', 'Uteži drsijo ob stegnih, boki gredo nazaj', 'Spusti do raztega zadnje lože (pod kolena), nato potisni boke naprej'],
      mistakes: ['Počep namesto zgiba', 'Zaokrožen hrbet', 'Uteži daleč od nog'],
      anim: {
        hold: { N: 'db', F: 'db' }, focus: ['thigh', 'glute'],
        frames: [
          { d: 2.4, l: 'Boki nazaj 3 s', p: rdlTop },
          { d: 0.3, l: 'Razteg', p: rdlBot },
          { d: 1.0, l: 'Boki naprej', p: rdlBot },
          { d: 0.5, l: 'Vrh – stisni', p: rdlTop }
        ]
      }
    },
    {
      id: 'db_bulgarian', name: 'Bolgarski počep (zadnja noga na klopi)', equip: ['db', 'bench'], type: 'strength', unit: 'kg', load: 10, inc: 2, perSide: true,
      muscles: 'Kvadricepsi, zadnjica', tempo: '2-1-1',
      cues: ['Zadnja noga z narti na klopi', 'Spusti se navpično – zadnje koleno proti tlom', 'Teža na sprednji peti, trup rahlo naprej'],
      mistakes: ['Sprednja noga preblizu klopi', 'Koleno pada navznoter'],
      anim: {
        scene: [BSS_BENCH], hold: { N: 'db', F: 'db' }, focus: ['thigh', 'glute'],
        frames: [
          { d: 1.8, l: 'Spuščaj', p: bss([-12, -86]) },
          { d: 0.4, l: 'Spodaj', p: bss([-24, -52]) },
          { d: 1.0, l: 'Potisni skozi peto', p: bss([-24, -52]) },
          { d: 0.4, l: 'Gor', p: bss([-12, -86]) }
        ]
      }
    },
    {
      id: 'db_shoulder_press', name: 'Sedeči potisk z utežmi nad glavo', equip: ['db', 'bench'], type: 'strength', unit: 'kg', load: 12, inc: 2,
      muscles: 'Ramena, triceps', tempo: '2-0-1',
      cues: ['Naslon skoraj pokonci, hrbet ob naslonu', 'Uteži začnejo v višini ušes', 'Potisni gor in rahlo skupaj, ne zakleni sunkovito'],
      mistakes: ['Ločen hrbet od naslona', 'Prekratek obseg giba'],
      anim: {
        scene: [BENCH_SEAT], hold: { N: 'db', F: 'db' }, focus: ['upper'],
        frames: [
          { d: 0.9, l: 'Potisni', p: seatPose([22, 176]) },
          { d: 0.4, l: 'Vrh', p: seatPose([176, 178]) },
          { d: 1.8, l: 'Kontrolirano dol', p: seatPose([176, 178]) },
          { d: 0.3, l: 'Spodaj', p: seatPose([22, 176]) }
        ]
      }
    },
    {
      id: 'db_curl', name: 'Biceps upogib z utežmi', equip: ['db'], type: 'strength', unit: 'kg', load: 10, inc: 2,
      muscles: 'Biceps, podlaket', tempo: '1-1-2',
      cues: ['Komolci ob telesu, ne gredo naprej', 'Dlani obrnjene navzgor na vrhu', 'Spusti v 2 s do polne iztegnitve'],
      mistakes: ['Zamah s trupom', 'Polovični gib'],
      anim: {
        hold: { N: 'db', F: 'db' }, focus: ['upper', 'fore'],
        frames: [
          { d: 0.9, l: 'Upogni', p: stand({ aN: [2, 2] }) },
          { d: 0.5, l: 'Stisni', p: stand({ aN: [10, 155] }) },
          { d: 1.8, l: 'Počasi dol', p: stand({ aN: [10, 155] }) },
          { d: 0.2, l: '', p: stand({ aN: [2, 2] }) }
        ]
      }
    },
    {
      id: 'db_hip_thrust', name: 'Hip thrust (ramena na klopi)', equip: ['db', 'bench'], type: 'strength', unit: 'kg', load: 20, inc: 2,
      muscles: 'Zadnjica, zadnje stegenske', tempo: '1-2-2',
      cues: ['Spodnji rob lopatic na robu klopi', 'Golen navpično na vrhu, brada k prsim', 'Na vrhu 2 s stisni zadnjico – rebra dol'],
      mistakes: ['Prekomerno ukrivljen ledveni del', 'Potisk skozi prste namesto pete'],
      anim: {
        scene: [thrustBench], hold: { N: 'db' }, focus: ['glute', 'thigh'],
        frames: [
          { d: 0.9, l: 'Potisni boke gor', p: thrust(-128, [6, -40]) },
          { d: 1.2, l: 'Stisni 2 s', p: thrust(-92, [16, -66]) },
          { d: 1.6, l: 'Počasi dol', p: thrust(-92, [16, -66]) },
          { d: 0.2, l: '', p: thrust(-128, [6, -40]) }
        ]
      }
    },
    {
      id: 'db_stepup', name: 'Stopanje na klop z utežmi', equip: ['db', 'bench'], type: 'strength', unit: 'kg', load: 8, inc: 2, perSide: true,
      muscles: 'Kvadricepsi, zadnjica, ravnotežje', tempo: '1-0-2',
      cues: ['Cela stopala na klop', 'Potisni skozi peto zgornje noge – spodnja noga ne pomaga', 'Kontrolirano nazaj dol'],
      mistakes: ['Odriv s spodnjo nogo', 'Koleno pada navznoter'],
      anim: {
        scene: [STEP_BENCH], hold: { N: 'db', F: 'db' }, focus: ['thigh', 'glute'],
        frames: [
          { d: 1.1, l: 'Potisni skozi peto', p: step([0, -88], [-4, -6]) },
          { d: 0.4, l: 'Vrh', p: step([36, -134], [60, -96]) },
          { d: 0.8, l: 'Kontrolirano dol', p: step([36, -134], [60, -96]) },
          { d: 0.8, l: '', p: step([14, -106], [4, -26]) }
        ]
      }
    },

    // ------------------------------------------------------------ KINESIS
    {
      id: 'k_chest_press', name: 'Kinesis – potisk za prsa stoje', equip: ['kinesis'], type: 'strength', unit: 'stopnja', load: 8, inc: 1,
      muscles: 'Prsa, triceps, trup', tempo: '1-1-2',
      cues: ['Hrbet proti napravi, razkoračna stoja', 'Ročaja na višini prsi, komolci ~45°', 'Potisni naprej in rahlo skupaj, trup ostane miren'],
      mistakes: ['Nagibanje naprej', 'Ramena se dvignejo k ušesom'],
      anim: {
        scene: [K_BEHIND], cables: cab(K_BEHIND), hold: { N: 'handle', F: 'handle' }, focus: ['torso', 'upper'],
        frames: [
          { d: 0.9, l: 'Potisni', p: split({ aN: [-68, 90] }) },
          { d: 0.4, l: 'Stisni', p: split({ aN: [86, 88] }) },
          { d: 1.6, l: 'Kontrolirano nazaj', p: split({ aN: [86, 88] }) },
          { d: 0.2, l: '', p: split({ aN: [-68, 90] }) }
        ]
      }
    },
    {
      id: 'k_row', name: 'Kinesis – veslanje stoje', equip: ['kinesis'], type: 'strength', unit: 'stopnja', load: 8, inc: 1,
      muscles: 'Hrbet, zadnja rama, biceps', tempo: '1-1-2',
      cues: ['Obrnjen proti napravi, kolena mehka', 'Najprej lopatice nazaj, nato komolci', 'Na koncu 1 s stisni, prsni koš ponosen'],
      mistakes: ['Zibanje trupa nazaj', 'Ramena naprej na koncu giba'],
      anim: {
        scene: [K_FRONT_MID], cables: cab(K_FRONT_MID), hold: { N: 'handle', F: 'handle' }, focus: ['torso', 'upper'],
        frames: [
          { d: 0.9, l: 'Vleci', p: split({ t: 172, aN: [80, 82] }) },
          { d: 0.5, l: 'Stisni lopatice', p: split({ t: 178, aN: [-62, 86] }) },
          { d: 1.6, l: 'Iztegni počasi', p: split({ t: 178, aN: [-62, 86] }) },
          { d: 0.2, l: '', p: split({ t: 172, aN: [80, 82] }) }
        ]
      }
    },
    {
      id: 'k_pulldown', name: 'Kinesis – poteg navzdol klečé', equip: ['kinesis'], type: 'strength', unit: 'stopnja', load: 9, inc: 1,
      muscles: 'Široka hrbtna, biceps', tempo: '1-1-2',
      cues: ['Polklek, zadnjica stisnjena, trup pokonci', 'Komolce vleci navzdol ob telo', 'Iztegni do konca zgoraj – razteg pod pazduho'],
      mistakes: ['Nagib nazaj', 'Ramena ostanejo pri ušesih'],
      anim: {
        scene: [K_FRONT_HIGH], cables: cab(K_FRONT_HIGH), hold: { N: 'handle', F: 'handle' }, focus: ['torso', 'upper'],
        frames: [
          { d: 0.9, l: 'Komolci dol', p: kneel({ aN: [158, 158] }) },
          { d: 0.4, l: 'Stisni', p: kneel({ aN: [-8, 168] }) },
          { d: 1.6, l: 'Počasi gor', p: kneel({ aN: [-8, 168] }) },
          { d: 0.3, l: 'Razteg', p: kneel({ aN: [158, 158] }) }
        ]
      }
    },
    {
      id: 'k_face_pull', name: 'Kinesis – face pull', equip: ['kinesis'], type: 'strength', unit: 'stopnja', load: 5, inc: 1,
      muscles: 'Zadnja rama, rotatorji, srednji hrbet', tempo: '1-2-2',
      cues: ['Ročaja v višini obraza', 'Vleci proti čelu, komolci visoko in narazen', 'Na koncu rotiraj roke navzven (dvojni biceps)'],
      mistakes: ['Pretežka stopnja – vlečenje z bicepsom', 'Komolci padejo dol'],
      anim: {
        scene: [K_FRONT_FACE], cables: cab(K_FRONT_FACE), hold: { N: 'handle', F: 'handle' }, focus: ['upper'],
        frames: [
          { d: 0.9, l: 'Vleci k obrazu', p: split({ t: 176, aN: [92, 92] }) },
          { d: 0.9, l: 'Rotiraj ven, drži', p: split({ t: 178, aN: [-92, 172] }) },
          { d: 1.6, l: 'Počasi nazaj', p: split({ t: 178, aN: [-92, 172] }) },
          { d: 0.2, l: '', p: split({ t: 176, aN: [92, 92] }) }
        ]
      }
    },
    {
      id: 'k_pushdown', name: 'Kinesis – triceps potisk navzdol', equip: ['kinesis'], type: 'strength', unit: 'stopnja', load: 6, inc: 1,
      muscles: 'Triceps', tempo: '1-1-2',
      cues: ['Komolci prilepljeni ob telo', 'Iztegni do konca in stisni 1 s', 'Gor samo do 90°'],
      mistakes: ['Komolci se premikajo naprej', 'Pomoč z ramo / trupom'],
      anim: {
        scene: [K_PUSH], cables: cab(K_PUSH), hold: { N: 'handle', F: 'handle' }, focus: ['upper'],
        frames: [
          { d: 0.8, l: 'Iztegni', p: stand({ t: 172, aN: [10, 140] }) },
          { d: 0.5, l: 'Stisni', p: stand({ t: 172, aN: [8, 10] }) },
          { d: 1.5, l: 'Počasi gor', p: stand({ t: 172, aN: [8, 10] }) },
          { d: 0.2, l: '', p: stand({ t: 172, aN: [10, 140] }) }
        ]
      }
    },
    {
      id: 'k_pullthrough', name: 'Kinesis – pull-through (zgib v kolkih)', equip: ['kinesis'], type: 'strength', unit: 'stopnja', load: 10, inc: 1,
      muscles: 'Zadnjica, zadnje stegenske', tempo: '2-0-1',
      cues: ['Hrbet proti napravi, kabel med nogami', 'Boki nazaj, hrbet raven, roke samo držijo', 'Iztegni boke in stisni zadnjico'],
      mistakes: ['Vlečenje z rokami', 'Počep namesto zgiba'],
      anim: {
        scene: [K_LOW_BEHIND], cables: cab(K_LOW_BEHIND), hold: { N: 'handle', F: 'handle' }, focus: ['glute', 'thigh'],
        frames: [
          { d: 1.5, l: 'Boki nazaj', p: stand({ aN: [8, 8] }) },
          { d: 0.3, l: 'Razteg', p: stand({ t: 108, lN: [36, -4], aN: [-30, -30], hd: 25 }) },
          { d: 0.9, l: 'Iztegni boke', p: stand({ t: 108, lN: [36, -4], aN: [-30, -30], hd: 25 }) },
          { d: 0.5, l: 'Stisni', p: stand({ aN: [8, 8] }) }
        ]
      }
    },
    {
      id: 'k_woodchop', name: 'Kinesis – sekanje drv (visoko → nizko)', equip: ['kinesis'], type: 'core', unit: 'stopnja', load: 6, inc: 1, perSide: true,
      muscles: 'Poševne trebušne, trup', tempo: '1-0-2',
      cues: ['Bočno ob napravi, roke iztegnjene', 'Rotacija iz bokov in trupa diagonalno navzdol', 'Počasi nazaj – upiraj se rotaciji'],
      mistakes: ['Gib samo z rokami', 'Zaokrožen hrbet spodaj'],
      anim: {
        scene: [K_HIGH_BEHIND], cables: cab(K_HIGH_BEHIND), hold: { N: 'handle', F: 'handle' }, focus: ['torso'],
        frames: [
          { d: 0.8, l: 'Sekaj diagonalno', p: stand({ t: 188, aN: [-140, -140], hd: -10 }) },
          { d: 0.3, l: 'Spodaj', p: stand({ t: 160, lN: [28, -16], aN: [42, 42], hd: 10 }) },
          { d: 1.5, l: 'Kontrolirano nazaj', p: stand({ t: 160, lN: [28, -16], aN: [42, 42], hd: 10 }) },
          { d: 0.2, l: '', p: stand({ t: 188, aN: [-140, -140], hd: -10 }) }
        ]
      }
    },

    // ------------------------------------------------------------ WALL
    {
      id: 'pullup', name: 'Zgibi na drogu', equip: ['wall'], type: 'strength', unit: 'bw', load: 0, inc: 0,
      muscles: 'Široka hrbtna, biceps, trup', tempo: '1-1-3',
      cues: ['Začni iz polnega visenja, najprej stisni lopatice', 'Vleci prsi proti drogu, brada čez drog', 'Spusti v 3 s – če ne gre, delaj samo negativne'],
      mistakes: ['Zamah z nogami (kipping)', 'Polovični zgibi'],
      anim: {
        scene: [WALL], focus: ['torso', 'upper'],
        frames: [
          { d: 1.0, l: 'Vleci', p: hang({ lN: [12, -6, 40] }) },
          { d: 0.4, l: 'Brada čez drog', p: hang({ t: 184, hd: -8, aN: [36, 170], aF: [33, 168], lN: [22, -10, 40] }) },
          { d: 2.2, l: 'Spuščaj 3 s', p: hang({ t: 184, hd: -8, aN: [36, 170], aF: [33, 168], lN: [22, -10, 40] }) },
          { d: 0.5, l: 'Polno visenje', p: hang({ lN: [12, -6, 40] }) }
        ]
      }
    },
    {
      id: 'hang_knee_raise', name: 'Dvig kolen v visenju', equip: ['wall'], type: 'core', unit: 'bw', load: 0, inc: 0,
      muscles: 'Spodnje trebušne, upogibalke kolka', tempo: '1-1-2',
      cues: ['Aktivno visenje – ramena stran od ušes', 'Kolena dvigni nad višino bokov, medenico zavij', 'Spusti kontrolirano, brez zamaha'],
      mistakes: ['Nihanje telesa', 'Kolena samo do 90°'],
      anim: {
        scene: [WALL], focus: ['torso', 'thigh'],
        frames: [
          { d: 0.9, l: 'Kolena gor', p: hang({}) },
          { d: 0.4, l: 'Zavij medenico', p: hang({ t: 188, lN: [118, 12, 50] }) },
          { d: 1.6, l: 'Počasi dol', p: hang({ t: 188, lN: [118, 12, 50] }) },
          { d: 0.3, l: '', p: hang({}) }
        ]
      }
    },
    {
      id: 'hang_leg_raise', name: 'Dvig iztegnjenih nog v visenju', equip: ['wall'], type: 'core', unit: 'bw', load: 0, inc: 0,
      muscles: 'Trebušne, upogibalke kolka', tempo: '1-1-3',
      cues: ['Noge iztegnjene, prsti naprej', 'Dvigni do vodoravne lege ali višje', 'Spuščaj 3 s, ne zanihaj'],
      mistakes: ['Zamah', 'Upognjena kolena (postane dvig kolen)'],
      anim: {
        scene: [WALL], focus: ['torso', 'thigh'],
        frames: [
          { d: 1.0, l: 'Noge gor', p: hang({}) },
          { d: 0.4, l: 'Drži', p: hang({ t: 190, lN: [98, 96, 160] }) },
          { d: 2.0, l: 'Spuščaj 3 s', p: hang({ t: 190, lN: [98, 96, 160] }) },
          { d: 0.3, l: '', p: hang({}) }
        ]
      }
    },
    {
      id: 'dead_hang', name: 'Visenje + lopatični dvigi', equip: ['wall'], type: 'mobility', unit: 's',
      muscles: 'Ramena, prijem, hrbtenica', tempo: 'Počasi',
      cues: ['Sprosti se v visenju – raztegni hrbtenico', 'Nato samo z lopaticami dvigni telo 2–3 cm', 'Dihaj globoko'],
      mistakes: ['Zadrževanje diha', 'Upogibanje komolcev'],
      anim: {
        scene: [WALL], focus: ['upper', 'torso'],
        frames: [
          { d: 1.4, l: 'Pasivno visenje', p: hang({}) },
          { d: 1.0, l: 'Lopatice dol', p: hang({ aN: [180, 180], pin: ['hN', 30, -230], t: 182 }) },
          { d: 1.4, l: 'Drži', p: hang({ aN: [180, 180], pin: ['hN', 30, -230], t: 182 }) },
          { d: 1.0, l: 'Sprosti', p: hang({}) }
        ]
      }
    },

    // ------------------------------------------------------------ TRIATRAINER
    {
      id: 'back_ext', name: 'Iztegovanje hrbta (TriaTrainer pol-odprt)', equip: ['tria'], type: 'strength', unit: 'kg', load: 0, inc: 2.5,
      muscles: 'Iztegovalke hrbta, zadnjica, zadnje stegenske', tempo: '2-1-2',
      cues: ['Blazina tik pod kolčnima kostema', 'Spusti se z ravnim hrbtom, nato stisni zadnjico', 'Gor samo do ravne linije telesa – brez prekomernega usločenja'],
      mistakes: ['Hiperekstenzija na vrhu', 'Sunkovit gib'],
      anim: {
        scene: [TRIA_BACK], focus: ['torso', 'glute'],
        frames: [
          { d: 1.8, l: 'Spuščaj', p: backExt(141) },
          { d: 0.3, l: 'Spodaj', p: backExt(30) },
          { d: 1.4, l: 'Stisni zadnjico, gor', p: backExt(30) },
          { d: 0.8, l: 'Ravna linija – drži', p: backExt(141) }
        ]
      }
    },
    {
      id: 'situp', name: 'Trebušnjaki na TriaTrainerju (zaprt)', equip: ['tria'], type: 'core', unit: 'bw', load: 0, inc: 2.5,
      muscles: 'Trebušne', tempo: '1-1-2',
      cues: ['Stopala zataknjena pod valje', 'Zvijaj se vretence za vretencem, brada k prsim', 'Spuščaj počasi, ne odpadi na blazino'],
      mistakes: ['Vlečenje za vrat', 'Sunkovit vzpon s kolki'],
      anim: {
        scene: [TRIA_ABS], focus: ['torso'],
        frames: [
          { d: 1.0, l: 'Zvij se gor', p: situp(282) },
          { d: 0.4, l: 'Stisni', p: situp(150) },
          { d: 1.6, l: 'Počasi dol', p: situp(150) },
          { d: 0.3, l: '', p: situp(282) }
        ]
      }
    },

    // ------------------------------------------------------------ BODYWEIGHT
    {
      id: 'pushup', name: 'Sklece', equip: ['floor'], type: 'strength', unit: 'bw', load: 0, inc: 0,
      muscles: 'Prsa, triceps, trup', tempo: '2-0-1',
      cues: ['Dlani pod rameni, telo ravna deska', 'Komolci ~45° nazaj', 'Prsi do tik nad tla, nato potisni'],
      mistakes: ['Povešeni boki', 'Glava naprej'],
      anim: {
        focus: ['torso', 'upper'],
        frames: [
          { d: 1.5, l: 'Spuščaj', p: pushPose(114.6, [40, -5]) },
          { d: 0.2, l: 'Spodaj', p: pushPose(97, [44, -5]) },
          { d: 0.8, l: 'Potisni', p: pushPose(97, [44, -5]) },
          { d: 0.4, l: '', p: pushPose(114.6, [40, -5]) }
        ]
      }
    },
    {
      id: 'plank', name: 'Deska na podlakteh', equip: ['floor'], type: 'core', unit: 's',
      muscles: 'Trebušne, trup', tempo: 'Statično',
      cues: ['Komolci pod rameni', 'Stisni zadnjico in trebušne – rebra proti medenici', 'Dihaj enakomerno'],
      mistakes: ['Povešen ali dvignjen boki', 'Zadrževanje diha'],
      anim: {
        focus: ['torso'],
        frames: [
          { d: 2, l: 'Vdih', p: { t: 101, hd: -6, lN: [-79, -79, 15], aN: [-2, 92], pin: PUSH_FEET } },
          { d: 2, l: 'Izdih – stisni', p: { t: 102.5, hd: -6, lN: [-77.5, -77.5, 15], aN: [-3, 92], pin: PUSH_FEET } }
        ]
      }
    },
    {
      id: 'dead_bug', name: 'Dead bug', equip: ['floor'], type: 'core', unit: 'bw', load: 0, inc: 0,
      muscles: 'Globoke trebušne', tempo: '2-1-2',
      cues: ['Ledveni del pritisnjen v tla ves čas', 'Iztegni nasprotno roko in nogo, izdihni', 'Počasi – kakovost pred številom'],
      mistakes: ['Dvig ledvenega dela', 'Prehitro'],
      anim: {
        focus: ['torso'],
        frames: [
          { d: 1.4, l: 'Iztegni nasprotno', p: deadBug(DB_REST_ARM, DB_REST_ARM, DB_REST_LEG, DB_REST_LEG) },
          { d: 0.6, l: 'Izdih', p: deadBug([-96, -96], DB_REST_ARM, DB_REST_LEG, [94, 94, 160]) },
          { d: 1.4, l: 'Nazaj', p: deadBug([-96, -96], DB_REST_ARM, DB_REST_LEG, [94, 94, 160]) },
          { d: 1.4, l: 'Druga stran', p: deadBug(DB_REST_ARM, DB_REST_ARM, DB_REST_LEG, DB_REST_LEG) },
          { d: 0.6, l: 'Izdih', p: deadBug(DB_REST_ARM, [-96, -96], [94, 94, 160], DB_REST_LEG) },
          { d: 1.4, l: 'Nazaj', p: deadBug(DB_REST_ARM, [-96, -96], [94, 94, 160], DB_REST_LEG) }
        ]
      }
    },
    {
      id: 'bird_dog', name: 'Bird dog', equip: ['floor'], type: 'core', unit: 'bw', load: 0, inc: 0,
      muscles: 'Trup, hrbet, zadnjica', tempo: '2-2-2',
      cues: ['Na vseh štirih, hrbet raven kot miza', 'Iztegni nasprotno roko in nogo – medenica ostane vodoravna', 'Drži 2 s, nato zamenjaj'],
      mistakes: ['Rotacija medenice', 'Usločen hrbet'],
      anim: {
        focus: ['torso', 'glute'],
        frames: [
          { d: 1.2, l: 'Iztegni', p: quad([0, 0], [0, 0], [0, -90, -160], [0, -90, -160]) },
          { d: 1.4, l: 'Drži', p: quad([92, 92], [0, 0], [0, -90, -160], [-88, -88, -30]) },
          { d: 1.2, l: 'Nazaj', p: quad([92, 92], [0, 0], [0, -90, -160], [-88, -88, -30]) },
          { d: 1.2, l: 'Druga stran', p: quad([0, 0], [0, 0], [0, -90, -160], [0, -90, -160]) },
          { d: 1.4, l: 'Drži', p: quad([0, 0], [92, 92], [-88, -88, -30], [0, -90, -160]) },
          { d: 1.2, l: 'Nazaj', p: quad([0, 0], [92, 92], [-88, -88, -30], [0, -90, -160]) }
        ]
      }
    },

    // ------------------------------------------------------------ MOBILITY
    {
      id: 'hip_flexor', name: 'Razteg upogibalk kolka (polklek)', equip: ['floor'], type: 'mobility', unit: 's', perSide: true,
      muscles: 'Upogibalke kolka, sprednje stegno', tempo: 'Dihaj',
      cues: ['Zadnje koleno na tleh, stisni zadnjico na tej strani', 'Medenico zavij nazaj, nato boke rahlo naprej', 'Roka iste strani gor in rahlo čez glavo'],
      mistakes: ['Usločen ledveni del', 'Sprednje koleno daleč čez prste'],
      anim: {
        focus: ['thigh', 'glute'],
        frames: [
          { d: 2.2, l: 'Boki naprej – vdih', p: kneel({ r: [-4, -53], aN: [0, 0], ik: { fN: [42, -8], fF: [-46, -8] } }) },
          { d: 2.2, l: 'Razteg – izdih', p: kneel({ r: [10, -48], t: 186, aN: [176, 176], ik: { fN: [42, -8], fF: [-46, -8] } }) }
        ]
      }
    },
    {
      id: 'hamstring_bench', name: 'Razteg zadnje lože (peta na klopi)', equip: ['bench'], type: 'mobility', unit: 's', perSide: true,
      muscles: 'Zadnje stegenske, meča, spodnji hrbet', tempo: 'Dihaj',
      cues: ['Peta na klopi, prsti proti stropu, koleno mehko', 'Zgib v kolkih z ravnim hrbtom – prsni koš proti stopalu', 'Z izdihom se spusti malo globlje'],
      mistakes: ['Zaokrožen hrbet', 'Sunkovito vzmetenje'],
      anim: {
        scene: [{ type: 'bench', x: 50, len: 100 }], focus: ['thigh'],
        frames: [
          { d: 2.4, l: 'Vdih – podaljšaj hrbet', p: { r: [0, -92], t: 176, hd: 0, aN: [6, 6], lN: [0, 0, 175], ik: { fN: [80, -54], fF: [-5, -6] } } },
          { d: 2.4, l: 'Izdih – zgib naprej', p: { r: [-4, -91], t: 128, hd: 15, aN: [62, 66], lN: [0, 0, 175], ik: { fN: [80, -54], fF: [-5, -6] } } }
        ]
      }
    },

    // ------------------------------------------------------------ HYROX (substitutes on home equipment)
    {
      id: 'hx_bike_run', name: 'Kolo – nadomestek teka (HYROX)', equip: ['bike'], type: 'cardio', unit: 'min',
      muscles: 'Srce, noge', tempo: '90–100 obratov/min · RPE 7',
      cues: ['Tempo, ki ga zdržiš vseh 8 krogov – ne sprint', 'Upor srednji: pri 95 obr./min diham hitro, a nadzorovano', 'Zadnjih 20 s rahlo upočasni in pripravi postajo'],
      mistakes: ['Prvi krog prehiter', 'Zadrževanje diha na postaji takoj po kolesu'],
      anim: bikeAnim(0.62)
    },
    {
      id: 'k_ski', name: 'Kinesis – SkiErg poteg (HYROX)', equip: ['kinesis'], type: 'cardio', unit: 'stopnja', load: 6, inc: 1,
      muscles: 'Široka hrbtna, trup, triceps, zadnjica', tempo: 'Ritmično ~40 potegov/min',
      cues: ['Visoka škripca spredaj, ročaja nad glavo', 'Poteg z zgibom v kolkih in trebušnimi – roke končajo ob bokih', 'Kolena mehka, sunek iz bokov kot pri SkiErgu'],
      mistakes: ['Poteg samo z rokami', 'Zaokrožen hrbet v spodnjem delu'],
      anim: {
        scene: [K_SKI], cables: cab(K_SKI), hold: { N: 'handle', F: 'handle' }, focus: ['torso', 'upper'],
        frames: [
          { d: 0.55, l: 'POTEG – zgib v kolkih', p: stand({ t: 184, aN: [160, 160], hd: -6 }) },
          { d: 0.15, l: 'Roke ob bokih', p: stand({ t: 128, lN: [30, -14], aN: [-22, -22], hd: 22 }) },
          { d: 0.8, l: 'Gor – iztegni se', p: stand({ t: 128, lN: [30, -14], aN: [-22, -22], hd: 22 }) }
        ]
      }
    },
    {
      id: 'bike_sled', name: 'Kolo – težak upor stoje (nadomestek sled push)', equip: ['bike'], type: 'cardio', unit: 'min',
      muscles: 'Kvadricepsi, zadnjica, srce', tempo: '55–65 obratov/min · težak upor',
      cues: ['Upor tako visok, da kadenca pade pod 65', 'Iz sedla, teža nad pedali, trup nagnjen kot pri potiskanju sani', 'Moč iz kolkov – roke samo za ravnotežje'],
      mistakes: ['Prenizek upor – vrtenje brez sile', 'Zibanje kolesa s trupom'],
      anim: bikeStandAnim(1.05)
    },
    {
      id: 'k_sled_pull', name: 'Kinesis – vlečenje sani roka-čez-roko', equip: ['kinesis'], type: 'cardio', unit: 'stopnja', load: 12, inc: 1, repsPerCycle: 2,
      muscles: 'Hrbet, biceps, prijem, zadnjica', tempo: 'Izmenično, hitro',
      cues: ['Nizka škripca spredaj, atletska stoja, boki nazaj', 'Izmenično vleci z levo in desno roko k boku', 'Trup nagnjen nazaj, teža na petah'],
      mistakes: ['Pokončna stoja – vleče samo z rokami', 'Okrogel hrbet'],
      anim: {
        scene: [K_SLED], cables: cab(K_SLED), hold: { N: 'handle', F: 'handle' }, focus: ['upper', 'torso'],
        frames: [
          { d: 0.42, l: 'Desna k boku', p: sled([84, 88], [-60, 70]) },
          { d: 0.42, l: 'Leva k boku', p: sled([-60, 70], [84, 88]) }
        ]
      }
    },
    {
      id: 'burpee_bj', name: 'Burpee s skokom v daljino (HYROX)', equip: ['floor'], type: 'cardio', unit: 'bw', load: 0, inc: 0, secPerRep: 6,
      muscles: 'Celo telo, srce', tempo: 'Enakomerno',
      cues: ['Prsi do tal, nato noge pod telo', 'Sonožni skok naprej – mehak doskok v polčep', 'Doma: hoja nazaj na začetno točko, ritem brez postankov'],
      mistakes: ['Predolg skok, ki uniči ritem', 'Doskok na iztegnjena kolena'],
      anim: {
        focus: ['thigh', 'torso'],
        frames: [
          { d: 0.35, l: 'Dol', p: { pin: ['fN', 0, -6], t: 180, lN: [0, 0], ik: { hN: [6, -86], hF: [4, -86] } } },
          { d: 0.25, l: 'Roke na tla', p: { pin: ['fN', 0, -6], t: 125, hd: 15, lN: [95, -35], ik: { hN: [34, -5], hF: [31, -5] } } },
          { d: 0.35, l: 'Noge nazaj', p: { pin: ['fN', -78, -6], t: 112, hd: -5, lN: [-68, -68, 15], ik: { hN: [34, -5], hF: [31, -5] } } },
          { d: 0.3, l: 'Prsi do tal', p: { pin: ['fN', -78, -6], t: 96, hd: -5, lN: [-84, -84, 15], ik: { hN: [38, -5], hF: [35, -5] } } },
          { d: 0.3, l: 'Noge pod telo', p: { pin: ['fN', 0, -6], t: 125, hd: 15, lN: [95, -35], ik: { hN: [34, -5], hF: [31, -5] } } },
          { d: 0.3, l: 'SKOK naprej', p: { pin: ['fN', 0, -6], t: 140, hd: 10, lN: [70, -30], ik: { hN: [-20, -60], hF: [-22, -60] } } },
          { d: 0.35, l: 'Let', p: { pin: ['fN', 52, -40], t: 168, hd: -4, lN: [30, -20, 110], ik: { hN: [110, -150], hF: [107, -150] } } },
          { d: 0.6, l: 'Mehak doskok', p: { pin: ['fN', 95, -6], t: 140, hd: 10, lN: [75, -30], ik: { hN: [125, -70], hF: [122, -70] } } },
          { d: 0.6, l: 'Nazaj na začetek', p: { pin: ['fN', 95, -6], t: 180, lN: [0, 0], ik: { hN: [101, -86], hF: [99, -86] } } }
        ]
      }
    },
    {
      id: 'kb_farmers', name: 'Kmečka hoja s kettlebelli (HYROX)', equip: ['kb'], type: 'cardio', unit: 'kg', load: 16, inc: 4,
      muscles: 'Prijem, trup, ramena, noge', tempo: 'Hitri kratki koraki',
      cues: ['Dva KB ob telesu, ramena stisnjena dol in nazaj', 'Hitri kratki koraki, pogled naprej', 'Ne ustavljaj se – če prijem popušča, pojdi počasneje'],
      mistakes: ['Nagib na eno stran', 'Ramena pri ušesih'],
      anim: carryAnim
    },
    {
      id: 'kb_lunge', name: 'Izpadni koraki z utežjo (nadomestek sandbag lunges)', equip: ['kb'], type: 'strength', unit: 'kg', load: 12, inc: 4, repsPerCycle: 2, secPerRep: 2.5,
      muscles: 'Kvadricepsi, zadnjica, trup', tempo: 'Enakomerno',
      cues: ['KB pred prsnico (goblet)', 'Zadnje koleno se dotakne tal, trup pokonci', 'Izmenjuj nogi brez postankov'],
      mistakes: ['Prekratek korak – koleno daleč čez prste', 'Trup pade naprej'],
      anim: {
        hold: { N: 'kb' }, focus: ['thigh', 'glute'],
        frames: [
          { d: 0.7, l: 'Korak naprej', p: lungeP([0, -92], [6, -6], [-6, -6]) },
          { d: 0.25, l: 'Koleno do tal', p: lungeP([-6, -50], [36, -6], [-44, -10]) },
          { d: 0.7, l: 'Potisni nazaj gor', p: lungeP([-6, -50], [36, -6], [-44, -10]) },
          { d: 0.7, l: 'Druga noga', p: lungeP([0, -92], [-6, -6], [6, -6]) },
          { d: 0.25, l: 'Koleno do tal', p: lungeP([-6, -50], [-44, -10], [36, -6]) },
          { d: 0.7, l: 'Potisni nazaj gor', p: lungeP([-6, -50], [-44, -10], [36, -6]) }
        ]
      }
    },
    {
      id: 'db_thruster', name: 'Thruster z utežmi (nadomestek wall balls)', equip: ['db'], type: 'strength', unit: 'kg', load: 8, inc: 2, secPerRep: 3,
      muscles: 'Noge, ramena, srce', tempo: 'Tekoče, brez pavze',
      cues: ['Uteži na ramenih, komolci naprej', 'Počep do vzporednice, iz dna eksplodiraj', 'Moč iz nog potisne uteži nad glavo – en tekoč gib'],
      mistakes: ['Ločen počep in potisk', 'Pete se dvigujejo'],
      anim: {
        hold: { N: 'db', F: 'db' }, focus: ['thigh', 'upper'],
        frames: [
          { d: 0.9, l: 'Počep', p: thrRack },
          { d: 0.1, l: 'Dno', p: thrBot },
          { d: 0.55, l: 'EKSPLODIRAJ gor', p: thrBot },
          { d: 0.4, l: 'Nad glavo', p: thrTop },
          { d: 0.5, l: 'Nazaj na ramena', p: thrTop }
        ]
      }
    }
  ];

  // Focus groups per exercise — primary group first. Drives library filters and the session builder.
  var FOCUS = {
    noge: { name: 'Noge', icon: '🦵' },
    zadnjica: { name: 'Zadnjica', icon: '🍑' },
    prsa: { name: 'Prsa', icon: '🫁' },
    hrbet: { name: 'Hrbet', icon: '🔙' },
    rame: { name: 'Rame', icon: '🤷' },
    roke: { name: 'Roke', icon: '💪' },
    trup: { name: 'Trup', icon: '🎯' },
    kardio: { name: 'Kardio', icon: '❤️' },
    hyrox: { name: 'HYROX', icon: '🏁' },
    mobilnost: { name: 'Mobilnost', icon: '🧘' }
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
    row_steady: ['kardio', 'hrbet', 'hyrox']
  };
  // Multi-joint lifts go first in a generated session
  var COMPOUND = ['kb_goblet_squat', 'kb_deadlift', 'db_rdl', 'db_bulgarian', 'db_hip_thrust', 'kb_swing', 'db_bench', 'db_incline', 'pullup',
    'db_row', 'k_pulldown', 'db_shoulder_press', 'kb_press', 'k_chest_press', 'k_row', 'db_stepup', 'pushup', 'k_pullthrough', 'back_ext'];

  var BY_ID = {};
  LIST.forEach(function (e) {
    e.groups = GROUPS[e.id] || [];
    e.compound = COMPOUND.indexOf(e.id) >= 0;
    BY_ID[e.id] = e;
  });

  global.Exercises = { LIST: LIST, BY_ID: BY_ID, EQUIP: EQUIP, FOCUS: FOCUS, COMPOUND: COMPOUND };
})(window);
