/*
 * Figure engine — 2D skeletal animation (side view) rendered to SVG.
 *
 * Coordinate system: world units ≈ cm, ground at y = 0, up is negative y (SVG).
 * Angles (degrees) are absolute: direction d(a) = (sin a, cos a)
 *   0 = down, 90 = forward (+x), 180 = up, -90 = back.
 * The figure faces +x. "N" = near limb (in front), "F" = far limb (behind).
 */
(function (global) {
  'use strict';

  var L = {
    torso: 50, neck: 7, headR: 11,
    upper: 30, fore: 28,
    thigh: 44, shin: 43, foot: 17
  };

  var RAD = Math.PI / 180;
  function d(a) { return [Math.sin(a * RAD), Math.cos(a * RAD)]; }
  function add(p, a, len) { var v = d(a); return [p[0] + v[0] * len, p[1] + v[1] * len]; }
  function ang(from, to) { return Math.atan2(to[0] - from[0], to[1] - from[1]) / RAD; }
  function dist(a, b) { return Math.hypot(b[0] - a[0], b[1] - a[1]); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // Two-bone IK. Returns [upperAngle, lowerAngle]. bend: +1 / -1 picks side.
  function ik2(base, target, l1, l2, bend) {
    var dd = Math.max(Math.abs(l1 - l2) + 0.01, Math.min(l1 + l2 - 0.01, dist(base, target)));
    var a = ang(base, target);
    var c = (l1 * l1 + dd * dd - l2 * l2) / (2 * l1 * dd);
    var alpha = Math.acos(Math.max(-1, Math.min(1, c))) / RAD;
    var up = a + bend * alpha;
    var joint = add(base, up, l1);
    return [up, ang(joint, target)];
  }

  // ---- pose interpolation -------------------------------------------------
  function lerpVal(a, b, t) {
    if (a === undefined) return b;
    if (b === undefined) return a;
    if (typeof a === 'number') return lerp(a, b, t);
    if (typeof a === 'string') return t < 0.5 ? a : b;
    if (Array.isArray(a)) {
      var out = [];
      for (var i = 0; i < Math.max(a.length, b.length); i++) out.push(lerpVal(a[i], b[i], t));
      return out;
    }
    var o = {};
    var k;
    for (k in a) o[k] = lerpVal(a[k], b[k], t);
    for (k in b) if (!(k in o)) o[k] = b[k];
    return o;
  }

  var EASE = {
    lin: function (t) { return t; },
    io: function (t) { return 0.5 - 0.5 * Math.cos(Math.PI * t); },
    out: function (t) { return Math.sin(t * Math.PI / 2); },
    in: function (t) { return 1 - Math.cos(t * Math.PI / 2); }
  };

  // ---- solve skeleton -----------------------------------------------------
  function fk(p, root) {
    var J = {};
    var t = p.t !== undefined ? p.t : 180;
    J.hip = root;
    J.sho = add(root, t, L.torso);
    J.head = add(J.sho, t + (p.hd || 0), L.neck + L.headR);
    J.neck = add(J.sho, t + (p.hd || 0), L.neck * 0.6);
    var aN = p.aN || [0, 0], aF = p.aF || aN;
    var lN = p.lN || [0, 0], lF = p.lF || lN;
    J.eN = add(J.sho, aN[0], L.upper); J.hN = add(J.eN, aN[1], L.fore);
    J.eF = add(J.sho, aF[0], L.upper); J.hF = add(J.eF, aF[1], L.fore);
    J.kN = add(root, lN[0], L.thigh); J.fN = add(J.kN, lN[1], L.shin);
    J.kF = add(root, lF[0], L.thigh); J.fF = add(J.kF, lF[1], L.shin);
    J.ang = {
      t: t, aN: aN.slice(), aF: aF.slice(),
      lN: [lN[0], lN[1], lN[2] !== undefined ? lN[2] : lN[1] + 70],
      lF: [lF[0], lF[1], lF[2] !== undefined ? lF[2] : lF[1] + 70]
    };
    return J;
  }

  function solve(p) {
    var root = p.r ? p.r.slice() : [0, -94];
    var J = fk(p, root);
    if (p.pin) {
      var pj = J[p.pin[0]];
      root = [root[0] + p.pin[1] - pj[0], root[1] + p.pin[2] - pj[1]];
      J = fk(p, root);
    }
    var bd = p.bd || {};
    var ik = p.ik || {};
    var limbs = [
      ['hN', 'eN', 'aN', 'sho', L.upper, L.fore, bd.aN || -1],
      ['hF', 'eF', 'aF', 'sho', L.upper, L.fore, bd.aF || -1],
      ['fN', 'kN', 'lN', 'hip', L.thigh, L.shin, bd.lN || 1],
      ['fF', 'kF', 'lF', 'hip', L.thigh, L.shin, bd.lF || 1]
    ];
    limbs.forEach(function (lm) {
      var tgt = ik[lm[0]];
      if (!tgt) return;
      var r = ik2(J[lm[3]], tgt, lm[4], lm[5], lm[6]);
      J[lm[1]] = add(J[lm[3]], r[0], lm[4]);
      J[lm[0]] = add(J[lm[1]], r[1], lm[5]);
      J.ang[lm[2]][0] = r[0]; J.ang[lm[2]][1] = r[1];
      if (lm[2][0] === 'l') {
        var f = (p[lm[2]] && p[lm[2]][2] !== undefined) ? p[lm[2]][2] : r[1] + 70;
        J.ang[lm[2]][2] = f;
      }
    });
    ['N', 'F'].forEach(function (s) {
      var fa = J.ang['l' + s][2];
      J['toe' + s] = add(J['f' + s], fa, L.foot);
      J['heel' + s] = add(J['f' + s], fa - 100, 6);
    });
    J.kb = p.kb; J.extra = p.x || {};
    return J;
  }

  // ---- SVG helpers --------------------------------------------------------
  function f1(n) { return Math.round(n * 10) / 10; }
  function P(p) { return f1(p[0]) + ',' + f1(p[1]); }
  function line(a, b, w, cls) {
    return '<line x1="' + f1(a[0]) + '" y1="' + f1(a[1]) + '" x2="' + f1(b[0]) + '" y2="' + f1(b[1]) +
      '" stroke-width="' + w + '" class="' + cls + '"/>';
  }
  function circ(c, r, cls, extra) {
    return '<circle cx="' + f1(c[0]) + '" cy="' + f1(c[1]) + '" r="' + r + '" class="' + cls + '"' + (extra || '') + '/>';
  }
  function poly(pts, cls) { return '<polygon points="' + pts.map(P).join(' ') + '" class="' + cls + '"/>'; }
  function rect(x, y, w, h, cls, rx) {
    return '<rect x="' + f1(x) + '" y="' + f1(y) + '" width="' + f1(w) + '" height="' + f1(h) + '" rx="' + (rx || 0) + '" class="' + cls + '"/>';
  }
  function path(dd, cls, w) { return '<path d="' + dd + '" class="' + cls + '"' + (w ? ' stroke-width="' + w + '"' : '') + '/>'; }

  // ---- held equipment -----------------------------------------------------
  function heldProp(type, J, side) {
    var h = J['h' + side];
    var fa = J.ang['a' + side][1];
    var far = side === 'F' ? ' far' : '';
    if (type === 'db') {
      return circ(h, 9, 'p-plate' + far) + circ(h, 4, 'p-plate-in' + far);
    }
    if (type === 'kb') {
      var dir = J.kb !== undefined ? J.kb : fa;
      var c = add(h, dir, 12);
      return line(h, add(h, dir, 4), 4, 'p-kb-h' + far) + circ(c, 10, 'p-kb' + far) +
        circ(add(c, dir + 140, 4), 2.2, 'p-kb-shine' + far);
    }
    if (type === 'handle') return circ(h, 5, 'p-handle' + far);
    // barbell seen from the side: the plate is what the eye reads
    if (type === 'plate') return circ(h, 22, 'p-bbplate' + far) + circ(h, 7, 'p-plate-in' + far) + circ(h, 3, 'p-metal-c');
    if (side === 'F') return '';
    if (type === 'bar') { var c2 = add(J.sho, J.ang.t + 55, 8); return circ(c2, 22, 'p-bbplate') + circ(c2, 7, 'p-plate-in') + circ(c2, 3, 'p-metal-c'); }
    if (type === 'bag') { var c3 = add(J.sho, J.ang.t + 50, 10); return '<ellipse cx="' + f1(c3[0]) + '" cy="' + f1(c3[1]) + '" rx="15" ry="12" class="p-bag"/>' + line(add(c3, 200, 9), add(c3, 140, 9), 2, 'p-bag-h'); }
    if (type === 'ball' && !J.extra.ball) { var m = [(J.hN[0] + J.hF[0]) / 2 + 6, (J.hN[1] + J.hF[1]) / 2]; return ballSvg(m); }
    return '';
  }
  function ballSvg(c) {
    return circ(c, 12, 'p-ball') + path('M' + P([c[0] - 12, c[1]]) + ' Q' + P([c[0], c[1] - 7]) + ' ' + P([c[0] + 12, c[1]]), 'p-ball-seam', 1.6) +
      path('M' + P([c[0], c[1] - 12]) + ' Q' + P([c[0] + 6, c[1]]) + ' ' + P([c[0], c[1] + 12]), 'p-ball-seam', 1.6);
  }

  // ---- static scenery -----------------------------------------------------
  var SCENE = {
    floor: function () { return ''; },
    // NOHrD weight bench (flat or incline). x = pivot (seat rear end), h = pad top height
    bench: function (o) {
      var h = o.h || 44, x = o.x, s = '';
      var len = o.len || 115;
      if (!o.incline) {
        s += rect(x + 8, -h + 6, 7, h - 6, 'p-wood') + rect(x + len - 15, -h + 6, 7, h - 6, 'p-wood');
        s += rect(x, -h + 4, len, 4, 'p-wood-d') + rect(x - 2, -h - 3, len + 4, 8, 'p-pad', 3);
      } else {
        var a = o.incline;
        s += rect(x + 2, -h + 6, 7, h - 6, 'p-wood') + rect(x + 32, -h + 6, 7, h - 6, 'p-wood');
        s += rect(x - 4, -h - 3, 44, 8, 'p-pad', 3);
        var end = [x - Math.cos(a * RAD) * 78, -h - Math.sin(a * RAD) * 78];
        s += line([x - 6, -h + 6], [x - 6 - Math.cos(a * RAD) * 40, -h + 6 - Math.sin(a * RAD) * 40 + 30], 6, 'p-wood');
        s += line([x - 2, -h - 2], end, 9, 'p-pad-l');
      }
      return s;
    },
    // NOHrD TriaTrainer closed = ab trainer (decline sit-up). x = low end
    tria_abs: function (o) {
      var x = o.x, s = '';
      var lo = [x, -32], hi = [x + 92, -58];
      s += poly([[x + 8, 0], [x + 18, 0], [x + 28, -36], [x + 18, -36]], 'p-wood');
      s += poly([[x + 78, 0], [x + 88, 0], [x + 96, -58], [x + 86, -58]], 'p-wood');
      s += rect(x - 4, -3, 110, 5, 'p-wood-d', 2);
      s += line(lo, hi, 9, 'p-pad-l');
      s += line([x + 100, -60], [x + 112, -70], 6, 'p-wood');
      s += circ([x + 112, -72], 6, 'p-roll') + circ([x + 108, -55], 6, 'p-roll');
      return s;
    },
    // NOHrD TriaTrainer half-open = 45° back extension. hx,hy = hip pad
    tria_back: function (o) {
      var s = '';
      var px = o.x, py = o.y;
      var fx = px - 62, fy = -8;
      s += line([fx - 6, 0], [px + 4, py + 8], 9, 'p-wood');
      s += line([px - 4, 0], [px + 2, py + 6], 7, 'p-wood');
      s += rect(fx - 22, -4, px - fx + 34, 5, 'p-wood-d', 2);
      s += line([px + 4, py - 12], [px + 14, py + 10], 11, 'p-pad-l');
      s += line([fx - 10, fy + 4], [fx + 8, fy - 10], 5, 'p-pad-l');
      s += circ([fx - 2, fy - 18], 5, 'p-roll');
      return s;
    },
    // Wall-mounted pull-up / leg-raise station with wall bars. x = wall, y = bar height
    wall: function (o) {
      var x = o.x, y = o.y, s = '';
      s += rect(x - 14, -250, 10, 250, 'p-wall');
      for (var i = 1; i < 14; i++) s += line([x - 30, -i * 16], [x - 4, -i * 16], 3, 'p-rung');
      s += rect(x - 32, -250, 4, 250, 'p-wood') + rect(x - 6, -250, 4, 250, 'p-wood');
      s += line([x - 4, y], [o.bx, y], 6, 'p-metal');
      s += circ([o.bx, y], 3.5, 'p-metal-c');
      if (o.pads) {
        s += rect(x - 4, o.pads - 5, 34, 9, 'p-pad', 3);
        s += rect(x - 4, o.pads + 70, 8, 40, 'p-pad', 3);
      }
      return s;
    },
    // Technogym Kinesis Personal: slim panel with pivoting arms; pulleys at given points
    kinesis: function (o) {
      var x = o.x, s = '';
      s += rect(x - 9, -212, 18, 212, 'p-kin', 4);
      s += rect(x - 6, -150, 12, 26, 'p-kin-screen', 2);
      (o.pulleys || []).forEach(function (pt) {
        s += line([x, pt[1]], pt, 7, 'p-kin-arm') + circ(pt, 5, 'p-metal-c');
      });
      return s;
    },
    // Exercise bike. sx,sy = saddle top; cx,cy = crank centre
    bike: function (o) {
      var s = '';
      var sad = [o.sx, o.sy], cr = [o.cx, o.cy], bar = [o.bx, o.by];
      s += rect(o.sx - 40, -6, 130, 6, 'p-metal-d', 3);
      s += line([o.sx - 20, -4], [cr[0] - 4, cr[1] + 4], 9, 'p-bike');
      s += line(cr, [o.sx - 6, o.sy + 8], 9, 'p-bike');
      s += line(cr, [o.bx - 10, o.by + 18], 9, 'p-bike');
      s += line([o.bx - 10, o.by + 18], [o.bx + 30, -4], 9, 'p-bike');
      s += circ([o.bx + 16, -34], 26, 'p-fly');
      s += line([o.bx - 10, o.by + 18], bar, 6, 'p-bike');
      s += line([o.sx - 14, o.sy - 2], [o.sx + 10, o.sy - 2], 7, 'p-pad-l');
      s += line(bar, [bar[0] + 8, bar[1] - 4], 6, 'p-pad-l');
      return s;
    },
    // Treadmill: belt from x0 to x1, console at the front
    treadmill: function (o) {
      var s = '';
      s += rect(o.x0 - 6, -16, o.x1 - o.x0 + 14, 12, 'p-metal-d', 6);
      s += rect(o.x0, -18, o.x1 - o.x0, 5, 'p-belt', 2);
      s += line([o.x1 + 4, -12], [o.x1 + 22, -128], 7, 'p-bike');
      s += line([o.x1 + 22, -128], [o.x1 - 18, -100], 6, 'p-bike');
      s += rect(o.x1 + 6, -146, 34, 22, 'p-kin-screen', 4);
      return s;
    },
    // Concept-style SkiErg tower; handles hang from the top pulleys (cables drawn per frame)
    skierg: function (o) {
      var x = o.x, s = '';
      s += rect(x - 30, -6, 70, 6, 'p-metal-d', 3);
      s += rect(x - 7, -214, 16, 210, 'p-bike', 5);
      s += circ([x + 1, -168], 15, 'p-fly');
      s += rect(x - 12, -222, 26, 14, 'p-metal-d', 4) + circ([x - 8, -208], 4, 'p-metal-c');
      return s;
    },
    // HYROX sled with push poles (static); x = rear of sled
    sled: function (o) {
      var x = o.x, s = '';
      s += poly([[x, -6], [x + 70, -6], [x + 78, -20], [x - 4, -20]], 'p-sled');
      s += rect(x + 10, -34, 50, 14, 'p-bbplate', 4);
      if (!o.rope) {
        s += line([x + 4, -18], [x - 2, -112], 6, 'p-metal');
        s += line([x - 2, -112], [x - 16, -112], 6, 'p-metal');
      }
      return s;
    },
    box: function (o) {
      var s = '';
      s += rect(o.x, -o.h, o.w, o.h, 'p-wood', 4);
      s += rect(o.x + 8, -o.h + 10, o.w - 16, o.h - 20, 'p-wood-d', 3);
      s += line([o.x, -o.h], [o.x + o.w, -o.h], 3, 'p-wood');
      return s;
    },
    // wall with a wall-ball target at height y
    target: function (o) {
      return rect(o.x, o.y - 40, 14, -o.y + 40, 'p-wall') + circ([o.x - 2, o.y], 13, 'p-target') + circ([o.x - 2, o.y], 5, 'p-target-in');
    },
    rack: function (o) {
      var s = '';
      s += rect(o.x - 4, -232, 8, 232, 'p-rack') + rect(o.x - 40, -6, 80, 6, 'p-metal-d', 3);
      s += line([o.x + 4, o.y], [o.x + 16, o.y], 5, 'p-metal') + line([o.x + 16, o.y], [o.x + 16, o.y - 8], 5, 'p-metal');
      return s;
    },
    anchor: function (o) {
      return rect(o.x - 3, -220, 10, 220, 'p-wood-d') + circ([o.x, o.y], 4.5, 'p-band-anchor');
    },
    // Wooden water rower. fx = footplate x
    rower: function (o) {
      var fx = o.fx, s = '';
      s += line([fx - 170, -16], [fx + 20, -16], 7, 'p-wood');
      s += line([fx - 170, -16], [fx - 170, 0], 6, 'p-wood');
      s += rect(fx + 18, -52, 62, 44, 'p-tank', 22);
      s += rect(fx + 30, -40, 38, 20, 'p-water', 10);
      s += line([fx + 20, -8], [fx + 20, -60], 7, 'p-wood');
      s += line([fx + 76, -8], [fx + 76, 0], 7, 'p-wood');
      s += line([fx - 2, -14], [fx + 10, -40], 8, 'p-pad-l');
      return s;
    }
  };

  // ---- dynamic scenery drawn per frame -------------------------------------
  function dynamicProps(anim, J, phase) {
    var s = '';
    (anim.cables || []).forEach(function (c) {
      var to = c.to.map(function (k) { return J[k]; });
      to.forEach(function (pt) { s += line(c.from, pt, c.w || 1.6, c.cls || 'p-cable'); });
    });
    if (J.extra.mv !== undefined) {
      // moving floor marks show forward travel while the figure stays centred
      for (var k = -6; k <= 6; k++) {
        var mx = k * 40 - (J.extra.mv % 40);
        s += line([mx, 1.5], [mx + 16, 1.5], 3, 'p-floor-mark');
      }
    }
    if (J.extra.belt !== undefined) {
      for (var b = 0; b < 8; b++) {
        var bx = J.extra.bx0 + ((b * 18 - J.extra.belt % 18 + 180) % 144);
        s += line([bx, -15.5], [bx + 6, -15.5], 2, 'p-belt-mark');
      }
    }
    if (J.extra.rope !== undefined) {
      var hm2 = [(J.hN[0] + J.hF[0]) / 2, (J.hN[1] + J.hF[1]) / 2];
      var cen = [J.hip[0], J.hip[1] - 10];
      var apex = add(cen, J.extra.rope, 104);
      var ctl = add(cen, J.extra.rope, 120);
      var c1 = add(ctl, J.extra.rope + 90, 34), c2 = add(ctl, J.extra.rope - 90, 34);
      s += path('M' + P(hm2) + ' Q' + P(c1) + ' ' + P(apex) + ' Q' + P(c2) + ' ' + P(hm2), 'p-rope', 2.4);
    }
    if (J.extra.ball) s += ballSvg(J.extra.ball);
    var sc = anim.scene || [];
    sc.forEach(function (o) {
      if (o.type === 'rower') {
        var hm = [(J.hN[0] + J.hF[0]) / 2, (J.hN[1] + J.hF[1]) / 2];
        s += line([o.fx + 20, -44], hm, 2, 'p-chain');
        s += line([hm[0], hm[1] - 9], [hm[0], hm[1] + 9], 5, 'p-metal');
        s += rect(J.hip[0] - 16, -26, 30, 8, 'p-pad', 3);
      }
      if (o.type === 'sled' && o.rope) {
        var hm3 = [(J.hN[0] + J.hF[0]) / 2, (J.hN[1] + J.hF[1]) / 2];
        s += path('M' + P([o.x - 4, -14]) + ' Q' + P([(o.x + hm3[0]) / 2, -4]) + ' ' + P(hm3), 'p-rope', 3);
      }
      if (o.type === 'bike' && J.extra.crank !== undefined) {
        var cr = [o.cx, o.cy], a = J.extra.crank;
        var pN = add(cr, a, 17), pF = add(cr, a + 180, 17);
        s += line(cr, pF, 5, 'p-metal far');
        s += circ(cr, 9, 'p-metal-c');
        s += line(cr, pN, 5, 'p-metal');
        s += J.pedals ? '' : '';
      }
    });
    return s;
  }

  // ---- figure drawing ------------------------------------------------------
  // Anatomical mannequin: tapered limbs, clothing, face/hair, shoes, and muscle bellies
  // that light up when they are the working muscles (primary = bright, secondary = soft).
  var R = { thigh: [10.2, 6.8], shin: [6.8, 4.4], upper: [6.4, 4.8], fore: [5, 3.6], torso: [11.6, 13.6], neck: [5, 4.6] };

  function capsule(a, b, r1, r2, cls) {
    var an = ang(a, b), n1 = d(an + 90), n2 = d(an - 90);
    var p1 = [a[0] + n1[0] * r1, a[1] + n1[1] * r1], p2 = [b[0] + n1[0] * r2, b[1] + n1[1] * r2];
    var p3 = [b[0] + n2[0] * r2, b[1] + n2[1] * r2], p4 = [a[0] + n2[0] * r1, a[1] + n2[1] * r1];
    return '<path d="M' + P(p1) + ' L' + P(p2) + ' A' + r2 + ' ' + r2 + ' 0 0 1 ' + P(p3) + ' L' + P(p4) + ' A' + r1 + ' ' + r1 + ' 0 0 1 ' + P(p1) + 'Z" class="' + cls + '"/>';
  }
  function ellipse(c, rx, ry, segAng, cls) {
    return '<ellipse cx="' + f1(c[0]) + '" cy="' + f1(c[1]) + '" rx="' + f1(rx) + '" ry="' + f1(ry) + '" transform="rotate(' + f1(90 - segAng) + ' ' + f1(c[0]) + ' ' + f1(c[1]) + ')" class="' + cls + '"/>';
  }
  function along(a, b, frac, normalAng, off) {
    var p = [a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac];
    return off ? add(p, normalAng, off) : p;
  }

  // muscle id -> geometry on the solved skeleton (centre, radii, rotation)
  function muscleShapes(J, s) {
    var hip = J.hip, sho = J.sho, k = J['k' + s], f = J['f' + s], e = J['e' + s], h = J['h' + s];
    var aT = ang(hip, sho), aTh = ang(hip, k), aSh = ang(k, f), aU = ang(sho, e), aF = ang(e, h);
    var lTh = dist(hip, k), lSh = dist(k, f), lU = dist(sho, e), lF = dist(e, h);
    var tAnt = aT - 90, tPost = aT + 90;
    return {
      quads: [along(hip, k, 0.5, aTh + 90, 3.4), lTh * 0.36, 4.3, aTh],
      hipflex: [along(hip, k, 0.16, aTh + 90, 4.4), 6.5, 3, aTh],
      hams: [along(hip, k, 0.52, aTh - 90, 3.2), lTh * 0.34, 3.9, aTh],
      glutes: [add(add(hip, tPost, 5.6), aTh, 2.5), 8.6, 7.4, aT],
      calves: [along(k, f, 0.3, aSh - 90, 2.6), lSh * 0.25, 3.5, aSh],
      chest: [along(hip, sho, 0.8, tAnt, 6.6), 9, 4.8, aT],
      abs: [along(hip, sho, 0.42, tAnt, 7.2), 12, 3.6, aT],
      obliques: [along(hip, sho, 0.4, tAnt, 2), 10.5, 5.6, aT],
      lats: [along(hip, sho, 0.66, tPost, 6.2), 13, 4.8, aT],
      traps: [along(hip, sho, 0.96, tPost, 5.4), 7, 4.2, aT],
      lowback: [along(hip, sho, 0.26, tPost, 7.2), 10, 3.4, aT],
      delts: [along(sho, e, 0.12, aU, 0), 6.6, 6, aU],
      biceps: [along(sho, e, 0.52, aU + 90, 2.4), lU * 0.3, 3.3, aU],
      triceps: [along(sho, e, 0.5, aU - 90, 2.5), lU * 0.32, 3.5, aU],
      forearms: [along(e, h, 0.32, aF, 0), lF * 0.3, 3.3, aF]
    };
  }
  var MUSCLE_SEG = {
    quads: 'leg', hipflex: 'leg', hams: 'leg', calves: 'leg', glutes: 'hip',
    chest: 'torso', abs: 'torso', obliques: 'torso', lats: 'torso', traps: 'torso', lowback: 'torso',
    delts: 'arm', biceps: 'arm', triceps: 'arm', forearms: 'arm'
  };
  // subtle skin definition on exposed muscles (shorts/top cover the rest)
  var DEFINITION = { leg: ['calves'], arm: ['delts', 'biceps', 'triceps', 'forearms'] };

  function musclesOf(anim) {
    if (anim.muscles) return anim.muscles;
    return { p: [], s: [] };
  }
  function mClass(id, mus, far) {
    var c = mus.p.indexOf(id) >= 0 ? 'm p' : mus.s.indexOf(id) >= 0 ? 'm s' : '';
    return c ? c + (far ? ' far' : '') : '';
  }
  function drawMuscles(J, s, group, mus, far) {
    var sh = muscleShapes(J, s), o = '';
    Object.keys(sh).forEach(function (id) {
      if (MUSCLE_SEG[id] !== group) return;
      var c = mClass(id, mus, far);
      if (!c) return;
      var g = sh[id];
      o += ellipse(g[0], g[1], g[2], g[3], c);
    });
    return o;
  }
  function drawDefinition(J, s, group, far) {
    var sh = muscleShapes(J, s), o = '';
    (DEFINITION[group] || []).forEach(function (id) { var g = sh[id]; o += ellipse(g[0], g[1] * 0.9, g[2] * 0.7, g[3], 'mdef' + (far ? ' far' : '')); });
    return o;
  }

  function drawLeg(J, s, mus) {
    var far = s === 'F', fc = far ? ' far' : '';
    var k = J['k' + s], f = J['f' + s], o = '';
    o += capsule(J.hip, k, R.thigh[0], R.thigh[1], 'skin' + fc);
    o += capsule(k, f, R.shin[0], R.shin[1], 'skin' + fc);
    o += drawDefinition(J, s, 'leg', far);
    // shorts
    o += capsule(J.hip, along(J.hip, k, 0.5), R.thigh[0] + 0.8, R.thigh[0] * 0.86, 'cloth' + fc);
    o += drawMuscles(J, s, 'leg', mus, far);
    // shoe
    o += poly([add(f, J.ang['l' + s][2] + 180, 2), J['toe' + s], J['heel' + s]], 'shoe' + fc);
    o += line(J['heel' + s], J['toe' + s], 5, 'shoe' + fc) + line(J['heel' + s], J['toe' + s], 1.8, 'sole' + fc);
    return o;
  }
  function drawArm(J, s, mus) {
    var far = s === 'F', fc = far ? ' far' : '';
    var e = J['e' + s], h = J['h' + s], o = '';
    o += capsule(J.sho, e, R.upper[0], R.upper[1], 'skin' + fc);
    o += capsule(e, h, R.fore[0], R.fore[1], 'skin' + fc);
    o += drawDefinition(J, s, 'arm', far);
    o += drawMuscles(J, s, 'arm', mus, far);
    o += circ(h, 4.2, 'skin hand' + fc);
    return o;
  }
  function drawHead(J) {
    var up = ang(J.neck, J.head), face = up - 90, back = up + 90, o = '';
    o += circ(add(add(J.head, back, 1.6), up, 1.2), 11, 'hair');
    o += circ(add(J.head, face, 0.8), 9.8, 'skin face');
    var nb = add(J.head, face, 9.4);
    o += poly([add(nb, up, 2.6), add(add(J.head, face, 12.6), up, -0.6), add(nb, up, -1.6)], 'skin face');
    o += circ(add(J.head, back, 1.4), 2.2, 'ear');
    return o;
  }
  function drawTorso(J, mus) {
    var o = '';
    o += capsule(J.hip, J.sho, R.torso[0], R.torso[1], 'cloth top');
    o += drawMuscles(J, 'N', 'torso', mus, false);
    return o;
  }

  function drawFigure(J, anim) {
    var mus = musclesOf(anim);
    var hold = anim.hold || {};
    var o = '';
    if (hold.F) o += heldProp(hold.F, J, 'F');
    o += drawArm(J, 'F', mus);
    o += drawLeg(J, 'F', mus);
    o += capsule(J.sho, J.neck, R.neck[0], R.neck[1], 'skin');
    o += drawHead(J);
    o += circ(J.hip, 10.5, 'cloth');
    o += drawMuscles(J, 'N', 'hip', mus, false);
    o += drawTorso(J, mus);
    o += drawLeg(J, 'N', mus);
    o += drawArm(J, 'N', mus);
    if (hold.N) o += heldProp(hold.N, J, 'N');
    return o;
  }

  // ---- teaching overlays: muscle labels + joint angle checkpoints -------------
  var MUSCLE_NAME = {
    quads: 'Kvadriceps', hams: 'Zadnja loža', glutes: 'Zadnjica', calves: 'Meča', hipflex: 'Upogibalke kolka',
    abs: 'Trebušne', obliques: 'Poševne trebušne', lowback: 'Spodnji hrbet', chest: 'Prsne', lats: 'Široka hrbtna',
    traps: 'Trapez', delts: 'Rame', biceps: 'Biceps', triceps: 'Triceps', forearms: 'Podlaket'
  };
  function labelSvg(pt, txt, dir) {
    var w = txt.length * 4.6 + 12;
    var end = add(pt, dir, 34);
    var x = end[0] - (Math.sin(dir * RAD) < 0 ? w : 0);
    return line(pt, end, 1, 'lbl-line') + circ(pt, 2, 'lbl-dot') +
      '<rect x="' + f1(x) + '" y="' + f1(end[1] - 7) + '" width="' + f1(w) + '" height="14" rx="7" class="lbl-bg"/>' +
      '<text x="' + f1(x + w / 2) + '" y="' + f1(end[1] + 3.2) + '" class="lbl-txt">' + txt + '</text>';
  }
  function drawLabels(J, anim) {
    var mus = musclesOf(anim), sh = muscleShapes(J, 'N'), o = '';
    var used = [];
    mus.p.slice(0, 3).forEach(function (id, i) {
      var g = sh[id]; if (!g) return;
      var c = g[0];
      var out = c[0] >= J.hip[0] ? 70 + i * 22 : -70 - i * 22;
      if (used.some(function (u) { return Math.abs(u - c[1]) < 14; })) out += out > 0 ? 30 : -30;
      used.push(c[1]);
      o += labelSvg(c, MUSCLE_NAME[id] || id, out);
    });
    return o;
  }
  function jointAngle(a, j, b) {
    var a1 = Math.atan2(a[1] - j[1], a[0] - j[0]), a2 = Math.atan2(b[1] - j[1], b[0] - j[0]);
    var dd = Math.abs(a1 - a2) * 180 / Math.PI;
    return dd > 180 ? 360 - dd : dd;
  }
  function arcSvg(a, j, b, deg) {
    var r = 15;
    var u1 = Math.atan2(a[1] - j[1], a[0] - j[0]), u2 = Math.atan2(b[1] - j[1], b[0] - j[0]);
    var p1 = [j[0] + Math.cos(u1) * r, j[1] + Math.sin(u1) * r], p2 = [j[0] + Math.cos(u2) * r, j[1] + Math.sin(u2) * r];
    var diff = u2 - u1; while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
    var mid = u1 + diff / 2, tp = [j[0] + Math.cos(mid) * (r + 12), j[1] + Math.sin(mid) * (r + 12)];
    return '<path d="M' + P(p1) + ' A' + r + ' ' + r + ' 0 0 ' + (diff > 0 ? 1 : 0) + ' ' + P(p2) + '" class="g-arc"/>' +
      '<text x="' + f1(tp[0]) + '" y="' + f1(tp[1] + 3) + '" class="g-txt">' + Math.round(deg) + '°</text>';
  }
  function drawGuides(J, anim) {
    var g = anim.guides || [], o = '';
    if (g.indexOf('spine') >= 0) {
      var top = add(J.sho, ang(J.hip, J.sho), 14), bot = add(J.hip, ang(J.sho, J.hip), 10);
      o += line(bot, top, 1.4, 'g-spine');
    }
    if (g.indexOf('knee') >= 0) o += arcSvg(J.hip, J.kN, J.fN, jointAngle(J.hip, J.kN, J.fN));
    if (g.indexOf('hip') >= 0) o += arcSvg(J.sho, J.hip, J.kN, jointAngle(J.sho, J.hip, J.kN));
    if (g.indexOf('elbow') >= 0) o += arcSvg(J.sho, J.eN, J.hN, jointAngle(J.sho, J.eN, J.hN));
    return o;
  }

  // ---- timeline -------------------------------------------------------------
  function totalDur(anim) {
    if (anim.fn) return anim.period || 2;
    return anim.frames.reduce(function (s, f) { return s + f.d; }, 0);
  }

  // returns {pose, label, idx}
  function sample(anim, time, speed) {
    var T = totalDur(anim);
    var t = ((time * (speed || 1)) % T + T) % T;
    if (anim.fn) return { pose: anim.fn(t / T), label: anim.label || '', idx: 0 };
    var fr = anim.frames;
    for (var i = 0; i < fr.length; i++) {
      if (t < fr[i].d || i === fr.length - 1) {
        var a = fr[i], b = fr[(i + 1) % fr.length];
        var k = Math.min(1, t / a.d);
        var e = EASE[a.e || 'io'](k);
        return { pose: lerpVal(a.p, b.p, e), label: a.l || '', idx: i };
      }
      t -= fr[i].d;
    }
  }

  // ---- auto camera -------------------------------------------------------------
  var SCENE_BOX = {
    bench: function (o) { return [o.x - 90, -(o.h || 44) - 70, o.x + (o.len || 115) + 10, 0]; },
    tria_abs: function (o) { return [o.x - 10, -80, o.x + 120, 0]; },
    tria_back: function (o) { return [o.x - 90, o.y - 15, o.x + 20, 0]; },
    wall: function (o) { return [o.x - 34, o.y - 30, o.bx + 10, 0]; },
    kinesis: function (o) { return [o.x - 12, -215, o.x + 12, 0]; },
    bike: function (o) { return [o.sx - 42, o.by - 10, o.bx + 45, 0]; },
    rower: function (o) { return [o.fx - 172, -60, o.fx + 82, 0]; },
    treadmill: function (o) { return [o.x0 - 8, -150, o.x1 + 44, 0]; },
    skierg: function (o) { return [o.x - 32, -224, o.x + 42, 0]; },
    sled: function (o) { return [o.x - 18, -114, o.x + 80, 0]; },
    box: function (o) { return [o.x, -o.h, o.x + o.w, 0]; },
    target: function (o) { return [o.x - 16, o.y - 20, o.x + 14, 0]; },
    rack: function (o) { return [o.x - 40, -234, o.x + 40, 0]; },
    anchor: function (o) { return [o.x - 6, o.y - 10, o.x + 8, 0]; }
  };

  function computeBox(anim) {
    var bx = [Infinity, Infinity, -Infinity, -Infinity];
    function ext(p, pad) {
      pad = pad || 0;
      bx[0] = Math.min(bx[0], p[0] - pad); bx[1] = Math.min(bx[1], p[1] - pad);
      bx[2] = Math.max(bx[2], p[0] + pad); bx[3] = Math.max(bx[3], p[1] + pad);
    }
    var T = totalDur(anim);
    for (var i = 0; i < 40; i++) {
      var J = solve(sample(anim, (i / 40) * T).pose);
      ['hip', 'sho', 'eN', 'eF', 'hN', 'hF', 'kN', 'kF', 'fN', 'fF', 'toeN', 'toeF'].forEach(function (k) { ext(J[k], 10); });
      ext(J.head, 14);
      if (anim.hold) { ext(J.hN, 24); ext(J.hF, 24); }
    }
    (anim.scene || []).forEach(function (o) {
      var f = SCENE_BOX[o.type];
      if (f) { var b = f(o); ext([b[0], b[1]]); ext([b[2], b[3]]); }
    });
    (anim.cables || []).forEach(function (c) { ext(c.from, 8); });
    ext([bx[0], 0]);
    return bx;
  }

  function viewBox(anim, aspect, extra) {
    var b = computeBox(anim);
    var pad = 16;
    var x0 = b[0] - pad - (extra || 0), x1 = b[2] + pad + (extra || 0), y0 = b[1] - pad, y1 = 0 + 18;
    var w = x1 - x0, h = y1 - y0;
    if (w / h > aspect) { var nh = w / aspect; y0 -= (nh - h); h = nh; }
    else { var nw = h * aspect; x0 -= (nw - w) / 2; w = nw; }
    return [x0, y0, w, h];
  }

  // ---- player ---------------------------------------------------------------
  function Player(container, opts) {
    opts = opts || {};
    this.el = container;
    this.aspect = opts.aspect || 16 / 10;
    this.speed = 1;
    this.anim = null;
    this.playing = true;
    this.t0 = 0;
    this.time = 0;
    this.onPhase = opts.onPhase || null;
    this.labels = !!opts.labels;   // name the working muscles on the figure
    this.guides = !!opts.guides;   // joint-angle checkpoints
    this._raf = null;
    this._lastIdx = -1;
    this._loop = this._loop.bind(this);
    container.innerHTML = '<svg class="fig-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">' +
      '<defs><filter id="glow" filterUnits="userSpaceOnUse" x="-2000" y="-2000" width="4000" height="4000"><feGaussianBlur stdDeviation="1.8" result="b"/>' +
      '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<linearGradient id="floorg" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="0" y2="60"><stop offset="0" stop-color="var(--floor-a)"/><stop offset="1" stop-color="var(--floor-b)"/></linearGradient></defs>' +
      '<g class="g-floor"></g><g class="g-static"></g><g class="g-dyn"></g><g class="g-fig"></g></svg>';
    this.svg = container.firstChild;
    this.gFloor = this.svg.querySelector('.g-floor');
    this.gStatic = this.svg.querySelector('.g-static');
    this.gDyn = this.svg.querySelector('.g-dyn');
    this.gFig = this.svg.querySelector('.g-fig');
  }

  Player.prototype.load = function (anim) {
    this.anim = anim;
    this.time = 0;
    this._lastIdx = -1;
    var vb = viewBox(anim, this.aspect, this.labels ? 46 : 0);
    this.svg.setAttribute('viewBox', vb.map(f1).join(' '));
    this.gFloor.innerHTML = rect(vb[0] - 3000, 0, vb[2] + 6000, 600, '', 0).replace('class=""', 'fill="url(#floorg)"') +
      line([vb[0] - 3000, 0], [vb[0] + vb[2] + 3000, 0], 1.5, 'p-floor-line');
    this.gStatic.innerHTML = (anim.scene || []).map(function (o) { return SCENE[o.type] ? SCENE[o.type](o) : ''; }).join('');
    this.render();
    this.start();
  };

  Player.prototype.render = function () {
    if (!this.anim) return;
    var smp = sample(this.anim, this.time, this.speed);
    var J = solve(smp.pose);
    this.gDyn.innerHTML = dynamicProps(this.anim, J);
    this.gFig.innerHTML = drawFigure(J, this.anim) +
      (this.guides ? drawGuides(J, this.anim) : '') + (this.labels ? drawLabels(J, this.anim) : '');
    if (smp.idx !== this._lastIdx) {
      this._lastIdx = smp.idx;
      if (this.onPhase) this.onPhase(smp.label, smp.idx);
    }
  };

  Player.prototype._loop = function (ts) {
    if (!this.playing) return;
    if (this._prev !== undefined) this.time += Math.min(0.1, (ts - this._prev) / 1000);
    this._prev = ts;
    this.render();
    this._raf = requestAnimationFrame(this._loop);
  };
  Player.prototype.start = function () {
    this.playing = true;
    this._prev = undefined;
    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(this._loop);
  };
  Player.prototype.stop = function () { this.playing = false; cancelAnimationFrame(this._raf); };
  Player.prototype.toggle = function () { if (this.playing) this.stop(); else this.start(); return this.playing; };
  Player.prototype.setTime = function (t) { this.time = t; this.render(); };
  Player.prototype.destroy = function () { this.stop(); this.el.innerHTML = ''; };

  // ---- static icons (equipment picker) --------------------------------------
  var ICON_PROP = {
    db: function (x, y, k) {
      k = k || 1;
      return line([x - 26 * k, y], [x + 26 * k, y], 5 * k, 'p-metal') + rect(x - 30 * k, y - 15 * k, 12 * k, 30 * k, 'p-plate', 4 * k) + rect(x + 18 * k, y - 15 * k, 12 * k, 30 * k, 'p-plate', 4 * k) +
        rect(x - 36 * k, y - 11 * k, 7 * k, 22 * k, 'p-plate', 3 * k) + rect(x + 29 * k, y - 11 * k, 7 * k, 22 * k, 'p-plate', 3 * k);
    },
    kb: function (x, y, k) {
      k = k || 1;
      // wide flat-topped handle + slightly flattened bell reads as a kettlebell, not a padlock
      return path('M' + P([x - 15 * k, y - 6 * k]) + ' C' + P([x - 22 * k, y - 40 * k]) + ' ' + P([x + 22 * k, y - 40 * k]) + ' ' + P([x + 15 * k, y - 6 * k]), 'p-kb-h', 6.5 * k) +
        '<ellipse cx="' + x + '" cy="' + (y + 8 * k) + '" rx="' + 24 * k + '" ry="' + 21 * k + '" class="p-kb"/>' + rect(x - 14 * k, y + 26 * k, 28 * k, 4 * k, 'p-kb', 2 * k) +
        circ([x - 9 * k, y], 4 * k, 'p-kb-shine');
    },
    barbell: function (x, y, k) {
      k = k || 1;
      return line([x - 80 * k, y], [x + 80 * k, y], 5 * k, 'p-metal') + rect(x - 66 * k, y - 32 * k, 14 * k, 64 * k, 'p-bbplate', 5 * k) + rect(x + 52 * k, y - 32 * k, 14 * k, 64 * k, 'p-bbplate', 5 * k) +
        rect(x - 52 * k, y - 24 * k, 8 * k, 48 * k, 'p-plate', 3 * k) + rect(x + 44 * k, y - 24 * k, 8 * k, 48 * k, 'p-plate', 3 * k);
    },
    ball: function (x, y, k) { return '<g transform="translate(' + x + ' ' + y + ') scale(' + (2.4 * (k || 1)) + ')">' + ballSvg([0, 0]) + '</g>'; },
    bag: function (x, y, k) {
      k = k || 1;
      return rect(x - 42 * k, y - 18 * k, 84 * k, 36 * k, 'p-bag', 18 * k) + path('M' + P([x - 18 * k, y - 18 * k]) + ' Q' + P([x - 10 * k, y - 34 * k]) + ' ' + P([x - 2 * k, y - 18 * k]), 'p-bag-h', 4 * k) +
        path('M' + P([x + 2 * k, y - 18 * k]) + ' Q' + P([x + 10 * k, y - 34 * k]) + ' ' + P([x + 18 * k, y - 18 * k]), 'p-bag-h', 4 * k);
    },
    rope: function (x, y, k) {
      k = k || 1;
      return path('M' + P([x - 40 * k, y - 20 * k]) + ' C' + P([x - 50 * k, y + 50 * k]) + ' ' + P([x + 50 * k, y + 50 * k]) + ' ' + P([x + 40 * k, y - 20 * k]), 'p-rope', 3 * k) +
        line([x - 40 * k, y - 20 * k], [x - 44 * k, y - 46 * k], 8 * k, 'p-handle-g') + line([x + 40 * k, y - 20 * k], [x + 44 * k, y - 46 * k], 8 * k, 'p-handle-g');
    },
    band: function (x, y, k) {
      k = k || 1;
      return '<ellipse cx="' + x + '" cy="' + y + '" rx="' + 46 * k + '" ry="' + 24 * k + '" class="p-band-loop" stroke-width="' + 7 * k + '"/>' +
        '<ellipse cx="' + (x + 8 * k) + '" cy="' + (y + 6 * k) + '" rx="' + 38 * k + '" ry="' + 18 * k + '" class="p-band-loop b2" stroke-width="' + 6 * k + '"/>';
    }
  };
  // spec = { vb: [x, y, w, h], scene: [...], props: [{ t, x, y, k }], pose: {...} }
  function icon(spec) {
    var body = (spec.scene || []).map(function (o) { return SCENE[o.type] ? SCENE[o.type](o) : ''; }).join('');
    if (spec.pose) body += drawFigure(solve(spec.pose), { muscles: spec.muscles || { p: [], s: [] }, hold: spec.hold || {} });
    (spec.props || []).forEach(function (pr) { body += ICON_PROP[pr.t](pr.x, pr.y, pr.k); });
    var floor = spec.noFloor ? '' : line([spec.vb[0] - 20, 0], [spec.vb[0] + spec.vb[2] + 20, 0], 2, 'p-floor-line');
    return '<svg class="fig-svg icon" viewBox="' + spec.vb.join(' ') + '" preserveAspectRatio="xMidYMid meet">' + floor + body + '</svg>';
  }

  global.Figure = {
    L: L, solve: solve, sample: sample, totalDur: totalDur, viewBox: viewBox,
    d: d, add: add, ik2: ik2, Player: Player, icon: icon, MUSCLE_NAME: MUSCLE_NAME
  };
})(window);
