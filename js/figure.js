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
    return '';
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
      to.forEach(function (pt) { s += line(c.from, pt, 1.6, 'p-cable'); });
    });
    var sc = anim.scene || [];
    sc.forEach(function (o) {
      if (o.type === 'rower') {
        var hm = [(J.hN[0] + J.hF[0]) / 2, (J.hN[1] + J.hF[1]) / 2];
        s += line([o.fx + 20, -44], hm, 2, 'p-chain');
        s += line([hm[0], hm[1] - 9], [hm[0], hm[1] + 9], 5, 'p-metal');
        s += rect(J.hip[0] - 16, -26, 30, 8, 'p-pad', 3);
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
  var W = { torso: 21, upper: 11, fore: 9, thigh: 16, shin: 12 };

  function limbCls(seg, side, focus) {
    var base = side === 'F' ? 'b far' : 'b';
    return focus && focus.indexOf(seg) >= 0 ? base + ' hot' : base;
  }

  function drawLeg(J, s, focus) {
    var o = '';
    o += line(J.hip, J['k' + s], W.thigh, limbCls('thigh', s, focus));
    o += line(J['k' + s], J['f' + s], W.shin, limbCls('shin', s, focus));
    o += poly([J['f' + s], J['toe' + s], J['heel' + s]], 'b foot' + (s === 'F' ? ' far' : ''));
    o += line(J['heel' + s], J['toe' + s], 6, 'b foot' + (s === 'F' ? ' far' : ''));
    return o;
  }
  function drawArm(J, s, focus) {
    var o = '';
    o += line(J.sho, J['e' + s], W.upper, limbCls('upper', s, focus));
    o += line(J['e' + s], J['h' + s], W.fore, limbCls('fore', s, focus));
    o += circ(J['h' + s], 5, 'b hand' + (s === 'F' ? ' far' : ''));
    return o;
  }

  function drawFigure(J, anim) {
    var focus = anim.focus || [];
    var hold = anim.hold || {};
    var o = '';
    if (hold.F) o += heldProp(hold.F, J, 'F');
    o += drawArm(J, 'F', focus);
    o += drawLeg(J, 'F', focus);
    // glutes / pelvis
    o += circ(J.hip, 11, limbCls('glute', 'N', focus).replace('b', 'b pelvis'));
    o += line(J.hip, J.sho, W.torso, limbCls('torso', 'N', focus));
    o += line(J.sho, J.neck, 9, 'b');
    o += circ(J.head, L.headR, 'b head');
    o += drawLeg(J, 'N', focus);
    o += drawArm(J, 'N', focus);
    if (hold.N) o += heldProp(hold.N, J, 'N');
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
    rower: function (o) { return [o.fx - 172, -60, o.fx + 82, 0]; }
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

  function viewBox(anim, aspect) {
    var b = computeBox(anim);
    var pad = 16;
    var x0 = b[0] - pad, x1 = b[2] + pad, y0 = b[1] - pad, y1 = 0 + 18;
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
    this._raf = null;
    this._lastIdx = -1;
    this._loop = this._loop.bind(this);
    container.innerHTML = '<svg class="fig-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">' +
      '<defs><filter id="glow" filterUnits="userSpaceOnUse" x="-2000" y="-2000" width="4000" height="4000"><feGaussianBlur stdDeviation="2.2" result="b"/>' +
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
    var vb = viewBox(anim, this.aspect);
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
    this.gFig.innerHTML = drawFigure(J, this.anim);
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

  global.Figure = {
    L: L, solve: solve, sample: sample, totalDur: totalDur, viewBox: viewBox,
    d: d, add: add, ik2: ik2, Player: Player
  };
})(window);
