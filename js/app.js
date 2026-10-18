/*
 * App shell: screens, TV remote (D-pad) navigation, guided workout player,
 * TV preview mode, library, history, settings.
 */
(function () {
  'use strict';

  Store.load();
  var state = null; // active profile
  var root = document.getElementById('app');
  var stack = [];
  var players = [];
  var cleanup = [];

  // ---------------------------------------------------------------- utils
  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(sec) { sec = Math.max(0, Math.ceil(sec)); var m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function ex(id) { return Exercises.BY_ID[id]; }
  function toast(msg) {
    var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600);
  }
  var DAYN = ['Ne', 'Po', 'To', 'Sr', 'Če', 'Pe', 'So'];

  // ---------------------------------------------------------------- audio / voice
  var Audio = {
    ctx: null,
    beep: function (freq, dur) {
      if (!state || !state.settings.beeps) return;
      try {
        this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
        var o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.frequency.value = freq || 880; o.type = 'sine';
        g.gain.setValueAtTime(0.25, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (dur || 0.15));
        o.connect(g); g.connect(this.ctx.destination); o.start(); o.stop(this.ctx.currentTime + (dur || 0.15));
      } catch (e) { /* no audio */ }
    }
  };
  var Voice = {
    v: null,
    init: function () {
      if (!('speechSynthesis' in window)) return;
      var pick = function () {
        var vs = speechSynthesis.getVoices();
        Voice.v = vs.filter(function (v) { return /^sl/i.test(v.lang); })[0] ||
          vs.filter(function (v) { return /^(hr|sr|bs)/i.test(v.lang); })[0] || null;
      };
      pick();
      speechSynthesis.onvoiceschanged = pick;
    },
    say: function (text) {
      if (!state || !state.settings.voice || !this.v || !('speechSynthesis' in window)) return;
      try {
        speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(text); u.voice = this.v; u.lang = this.v.lang; u.rate = 1.0;
        speechSynthesis.speak(u);
      } catch (e) { /* ignore */ }
    }
  };
  Voice.init();

  // keep TV screen awake during workouts
  var wake = null;
  function keepAwake(on) {
    try {
      if (on && navigator.wakeLock && !wake) navigator.wakeLock.request('screen').then(function (w) { wake = w; }).catch(function () {});
      if (!on && wake) { wake.release(); wake = null; }
    } catch (e) { /* unsupported */ }
  }

  // ---------------------------------------------------------------- spatial navigation (TV remote)
  var KEY = { LEFT: [37], UP: [38], RIGHT: [39], DOWN: [40], OK: [13, 32], BACK: [8, 27, 10009, 461, 166], PLAY: [179, 415, 19, 10252, 80] };
  function isKey(code, k) { return KEY[k].indexOf(code) >= 0; }

  function focusables() {
    var scope = $('.player') || root;
    return $$('.focusable', scope).filter(function (e) { return e.offsetParent !== null || e.getClientRects().length; });
  }
  function center(r) { return [r.left + r.width / 2, r.top + r.height / 2]; }
  function move(dir) {
    var list = focusables();
    var cur = document.activeElement;
    if (!cur || list.indexOf(cur) < 0) { if (list[0]) list[0].focus(); return; }
    var rc = cur.getBoundingClientRect(), c = center(rc), best = null, bestScore = Infinity;
    list.forEach(function (el) {
      if (el === cur) return;
      var r = el.getBoundingClientRect(), p = center(r);
      var dx = p[0] - c[0], dy = p[1] - c[1];
      var primary, ortho;
      if (dir === 'LEFT') { if (r.right > rc.left + 2 && dx >= -2) return; primary = -dx; ortho = Math.abs(dy); }
      if (dir === 'RIGHT') { if (r.left < rc.right - 2 && dx <= 2) return; primary = dx; ortho = Math.abs(dy); }
      if (dir === 'UP') { if (r.bottom > rc.top + 2 && dy >= -2) return; primary = -dy; ortho = Math.abs(dx); }
      if (dir === 'DOWN') { if (r.top < rc.bottom - 2 && dy <= 2) return; primary = dy; ortho = Math.abs(dx); }
      if (primary <= 0) return;
      var score = primary + ortho * 2.2;
      if (score < bestScore) { bestScore = score; best = el; }
    });
    if (best) {
      best.focus();
      if (best.scrollIntoView) best.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  }

  document.addEventListener('keydown', function (e) {
    var code = e.keyCode;
    var tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'SELECT') {
      // TV remotes: arrows up/down and OK leave the text field, so the form stays navigable
      if (isKey(code, 'UP')) { move('UP'); e.preventDefault(); }
      else if (isKey(code, 'DOWN') || code === 13) { move('DOWN'); e.preventDefault(); }
      else if (isKey(code, 'BACK') && code !== 8) back();
      return;
    }
    if (activeSession && activeSession.onKey && activeSession.onKey(code, e)) { e.preventDefault(); return; }
    if (isKey(code, 'LEFT')) { move('LEFT'); e.preventDefault(); }
    else if (isKey(code, 'RIGHT')) { move('RIGHT'); e.preventDefault(); }
    else if (isKey(code, 'UP')) { move('UP'); e.preventDefault(); }
    else if (isKey(code, 'DOWN')) { move('DOWN'); e.preventDefault(); }
    else if (isKey(code, 'OK')) { if (document.activeElement && document.activeElement.click) { document.activeElement.click(); e.preventDefault(); } }
    else if (isKey(code, 'BACK')) { back(); e.preventDefault(); }
  });

  root.addEventListener('click', function (e) {
    var el = e.target.closest('[data-go]');
    if (el) { go(el.getAttribute('data-go'), JSON.parse(el.getAttribute('data-p') || '{}')); }
  });

  // ---------------------------------------------------------------- router
  var activeSession = null;

  function teardown() {
    players.forEach(function (p) { p.destroy(); });
    players = [];
    cleanup.forEach(function (f) { f(); });
    cleanup = [];
    if (activeSession) { activeSession.destroy(); activeSession = null; }
    var pl = $('.player'); if (pl) pl.remove();
    root.innerHTML = '';
    keepAwake(false);
  }

  function go(screen, params, replace, fid) {
    if (!replace && stack.length) stack[stack.length - 1].focusIdx = focusables().indexOf(document.activeElement);
    if (replace) stack.pop();
    stack.push({ screen: screen, params: params || {} });
    render(false, fid);
  }
  // re-render the current screen, keeping focus on the element with the same data-fid
  function refresh(params) {
    var a = document.activeElement;
    var fid = a && a.getAttribute && a.getAttribute('data-fid');
    var top = stack[stack.length - 1];
    go(top.screen, params || top.params, true, fid);
  }
  function resetTo(screen, params) { stack = []; go(screen, params); }
  function back() {
    if (activeSession && activeSession.confirmExit && !activeSession.confirmExit()) return;
    if (stack.length <= 1) return;
    stack.pop();
    render(true);
  }

  function render(restoring, fid) {
    teardown();
    var top = stack[stack.length - 1];
    SCREENS[top.screen](top.params);
    var list = focusables();
    var scope = $('.player') || root;
    var idx = restoring && top.focusIdx >= 0 ? top.focusIdx : 0;
    var auto = (fid && $('[data-fid="' + fid + '"]', scope)) || $('[data-autofocus]', scope);
    var el = restoring ? list[idx] : (auto || list[0]);
    if (el) el.focus({ preventScroll: !!fid });
  }

  // store a generated / custom session in the profile and open it
  function startCustom(src, screen) {
    var key = 'C_' + Date.now().toString(36);
    state.customs[key] = src;
    Store.save();
    go(screen || 'overview', { key: key });
  }

  function avatar(p, big) {
    return '<span class="avatar' + (big ? ' big' : '') + '" style="background:' + p.color + '">' + esc((p.name || '?').trim().charAt(0).toUpperCase()) + '</span>';
  }

  // ---------------------------------------------------------------- figure helpers
  function mountFigure(el, id, opts) {
    var e = ex(id);
    if (!e) return null;
    var p = new Figure.Player(el, opts);
    p.speed = (e.speed || 1) * (opts && opts.speed || 1);
    p.load(e.anim);
    players.push(p);
    return p;
  }
  // static thumbnails, animate on focus / hover
  function mountThumbs() {
    $$('[data-thumb]').forEach(function (el) {
      var p = mountFigure(el, el.getAttribute('data-thumb'), { aspect: el.clientWidth / Math.max(1, el.clientHeight) });
      if (!p) return;
      var e = ex(el.getAttribute('data-thumb'));
      p.stop(); p.setTime(Figure.totalDur(e.anim) * 0.3);
      var host = el.closest('.focusable') || el;
      var on = function () { p.start(); }, off = function () { p.stop(); };
      host.addEventListener('focus', on); host.addEventListener('blur', off);
      host.addEventListener('mouseenter', on); host.addEventListener('mouseleave', off);
    });
  }

  function rx(item) {
    var e = ex(item.id);
    if (item.cardio) return item.cardio.min ? item.cardio.min + ' min' : item.cardio.rounds + '× ' + item.cardio.work + '/' + item.cardio.easy + ' s';
    if (item.time) return item.sets + '× ' + item.time + ' s' + ((item.perSide || e.perSide) ? '/str.' : '');
    var r = item.reps[0] === item.reps[1] ? item.reps[0] : item.reps[0] + '–' + item.reps[1];
    return item.sets + '× ' + r + ((item.perSide || e.perSide) ? '/str.' : '');
  }
  function loadTxt(e, load) {
    if (e.unit === 'kg') return load ? load + ' kg' : 'lastna teža';
    if (e.unit === 'stopnja') return 'stopnja ' + load;
    return 'lastna teža';
  }

  // ---------------------------------------------------------------- screens
  var SCREENS = {};

  SCREENS.home = function () {
    var plan = Program.PLANS[state.settings.days];
    var nextKey = Program.nextSessionKey(state);
    var sess = Program.build(state, nextKey);
    var mins = Program.estimateMin(sess);
    var exCount = 0; sess.blocks.forEach(function (b) { exCount += b.items.length; });
    var heroEx = sess.blocks[1].items[0].id;

    // week strip
    var now = new Date(), monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7)); monday.setHours(0, 0, 0, 0);
    var daysHtml = '';
    var weekDone = 0;
    for (var i = 0; i < 7; i++) {
      var d = new Date(monday); d.setDate(monday.getDate() + i);
      var ds = d.toISOString().slice(0, 10);
      var done = state.log.some(function (l) { return l.date.slice(0, 10) === ds; });
      if (done) weekDone++;
      var planned = plan.days.indexOf((i + 1) % 7) >= 0;
      daysHtml += '<div class="day' + (done ? ' done' : '') + (d.toDateString() === now.toDateString() ? ' today' : '') + '">' +
        DAYN[d.getDay()] + '<b>' + d.getDate() + '</b>' + (done ? '✓' : planned ? '•' : '&nbsp;') + '</div>';
    }
    var totalMin = state.log.reduce(function (s, l) { return s + (l.min || 0); }, 0);
    var streak = weeksStreak();

    var cards = plan.order.map(function (k) {
      var s = Program.SESSIONS[k];
      return '<div class="session-card focusable' + (k === nextKey ? ' next' : '') + '" tabindex="0" data-go="overview" data-p=\'{"key":"' + k + '"}\'>' +
        '<div class="tag" style="color:' + s.color + '">' + (k === nextKey ? 'NASLEDNJI' : 'TRENING ' + (plan.order.indexOf(k) + 1)) + '</div>' +
        '<h3>' + esc(s.name) + '</h3><p>' + esc(s.short) + '</p></div>';
    }).join('');

    root.innerHTML =
      '<div class="screen">' +
      '<div class="topbar"><div class="brand">Home<b>Gym</b> Coach</div><span class="chip">' + esc(plan.name) + '</span><span class="chip on">' + esc(sess.weekInfo.label) + '</span><div class="spacer"></div>' +
      '<button class="btn sm focusable" data-go="builder">＋ Sestavi trening</button>' +
      '<button class="btn sm ghost focusable" data-go="library">Knjižnica vaj</button>' +
      '<button class="btn sm ghost focusable" data-go="history">Napredek</button>' +
      '<button class="btn sm ghost focusable" data-go="settings">Nastavitve</button>' +
      '<button class="btn sm ghost focusable who" data-go="profiles" title="Zamenjaj osebo">' + avatar(state) + esc(state.name) + '</button></div>' +
      '<div class="hero"><div class="hero-card"><div class="eyebrow">Današnji trening · ' + esc(sess.weekInfo.label) + '</div>' +
      '<h1>' + esc(sess.name) + '</h1>' +
      '<div class="meta"><div><b>~' + mins + ' min</b>trajanje</div><div><b>' + exCount + '</b>vaj</div><div><b>RIR ' + sess.weekInfo.rir + '</b>napor</div></div>' +
      '<div class="hint">' + esc(sess.weekInfo.note) + '</div>' +
      '<div class="actions"><button class="btn primary focusable" data-autofocus data-go="player" data-p=\'{"key":"' + nextKey + '"}\'>▶ Začni trening</button>' +
      '<button class="btn focusable" data-go="preview" data-p=\'{"key":"' + nextKey + '"}\'>📺 Predogled vaj</button>' +
      '<button class="btn ghost focusable" data-go="overview" data-p=\'{"key":"' + nextKey + '"}\'>Podrobnosti</button></div>' +
      '<div class="hero-fig" id="heroFig"></div></div>' +
      '<div class="week"><h3>Ta teden · ' + weekDone + ' / ' + plan.order.length + ' treningov</h3><div class="days">' + daysHtml + '</div>' +
      '<div class="stats"><div class="stat"><b>' + state.log.length + '</b><span>treningov skupaj</span></div>' +
      '<div class="stat"><b>' + Math.round(totalMin / 60) + ' h</b><span>skupni čas</span></div>' +
      '<div class="stat"><b>' + streak + '</b><span>zaporednih tednov</span></div></div></div></div>' +
      '<div class="section-title"><h2>Tvoj program</h2><span>' + plan.order.length + ' treningi v rotaciji · zamujen dan ne podre plana</span></div>' +
      '<div class="row">' + cards + '</div>' +
      '<div class="section-title"><h2>Trening po izbiri</h2><span>izberi fokus ali vrsto – sestavi se samo iz tvoje opreme</span></div>' +
      '<div class="row">' + QUICK.map(function (q, i) {
        return '<div class="session-card focusable quick" tabindex="0" data-quick="' + i + '"><div class="tag" style="color:' + q.color + '">' + q.tag + '</div><h3>' + esc(q.name) + '</h3><p>' + esc(q.sub) + '</p></div>';
      }).join('') + '<div class="session-card focusable quick" tabindex="0" data-go="builder"><div class="tag">PO MERI</div><h3>＋ Sestavi svoj trening</h3><p>moč / kardio / kombinirano · fokus · trajanje</p></div></div>' +
      (state.saved.length ? '<div class="section-title"><h2>Moji shranjeni treningi</h2></div><div class="row">' + state.saved.filter(function (k) { return state.customs[k]; }).map(function (k) {
        var c = state.customs[k];
        return '<div class="session-card focusable" tabindex="0" data-go="overview" data-p=\'{"key":"' + k + '"}\'><div class="tag" style="color:' + c.color + '">SHRANJENO</div><h3>' + esc(c.name) + '</h3><p>' + esc(c.short) + '</p></div>';
      }).join('') + '</div>' : '') +
      '</div>';
    mountFigure($('#heroFig'), heroEx, { aspect: 1 });
    $$('[data-quick]').forEach(function (el) {
      el.onclick = function () {
        var o = Object.assign({ level: state.settings.level }, QUICK[+el.getAttribute('data-quick')].opts);
        startCustom(Program.generate(o));
      };
    });
  };

  var QUICK = [
    { tag: 'MOČ', name: 'Celo telo', sub: '45 min · vse glavne skupine', color: '#c6ff3d', opts: { type: 'moc', focus: ['noge', 'prsa', 'hrbet', 'zadnjica', 'rame', 'trup'], min: 45 } },
    { tag: 'MOČ', name: 'Noge & zadnjica', sub: '40 min', color: '#ffb547', opts: { type: 'moc', focus: ['noge', 'zadnjica'], min: 40 } },
    { tag: 'MOČ', name: 'Zgornji del', sub: '40 min · prsa, hrbet, rame, roke', color: '#b48cff', opts: { type: 'moc', focus: ['prsa', 'hrbet', 'rame', 'roke'], min: 40 } },
    { tag: 'TRUP', name: 'Trebušne & hrbet', sub: '20 min', color: '#4dffb8', opts: { type: 'moc', focus: ['trup'], min: 20 } },
    { tag: 'KARDIO', name: 'Intervali kolo + veslač', sub: '30 min', color: '#38e1ff', opts: { type: 'kardio', machine: 'both', intensity: 'hiit', min: 30 } },
    { tag: 'KARDIO', name: 'Cona 2 – vzdržljivost', sub: '40 min · lahkotno', color: '#38e1ff', opts: { type: 'kardio', machine: 'both', intensity: 'z2', min: 40 } }
  ];

  function weeksStreak() {
    var n = 0, wk = 0;
    var now = new Date();
    for (var w = 0; w < 52; w++) {
      var end = new Date(now); end.setDate(now.getDate() - w * 7);
      var start = new Date(end); start.setDate(end.getDate() - 7);
      var c = state.log.filter(function (l) { var d = new Date(l.date); return d > start && d <= end; }).length;
      if (c >= Math.min(3, state.settings.days)) n++; else if (w > 0) break;
      wk++;
    }
    return n;
  }

  SCREENS.overview = function (p) {
    var sess = Program.build(state, p.key);
    var mins = Program.estimateMin(sess);
    var html = '<div class="screen"><div class="ov-head"><div><div class="chip on" style="display:inline-block;margin-bottom:.6rem">' + esc(sess.weekInfo.label) + '</div>' +
      '<h1>' + esc(sess.name) + '</h1><p>~' + mins + ' min · ' + esc(sess.weekInfo.note) + '</p></div><div class="spacer"></div>' +
      (sess.custom ? '<button class="btn ghost focusable" id="saveTgl">' + (state.saved.indexOf(p.key) >= 0 ? '★ Shranjeno' : '☆ Shrani') + '</button>' : '') +
      '<button class="btn focusable" data-go="preview" data-p=\'{"key":"' + p.key + '"}\'>📺 Predogled</button>' +
      '<button class="btn primary focusable" data-autofocus data-go="player" data-p=\'{"key":"' + p.key + '"}\'>▶ Začni</button></div><div class="blocks">';
    sess.blocks.forEach(function (b, bi) {
      html += '<div class="block"><h3>' + esc(b.title) + '</h3>';
      b.items.forEach(function (it, ii) {
        var e = ex(it.id);
        var gl = Program.groupLetter(b.title, bi), tag = b.items.length > 1 && gl ? '<span class="lbl">' + gl + (ii + 1) + '</span>' : '';
        var load = it.sug ? '<small>' + esc(loadTxt(e, it.sug.load)) + '</small>' : '<small>' + (it.cardio ? 'kardio' : 'drži') + '</small>';
        html += '<div class="ex-row focusable" tabindex="0" data-go="exercise" data-p=\'{"id":"' + it.id + '"}\'>' +
          '<div class="ex-thumb" data-thumb="' + it.id + '"></div><div><h4>' + tag + esc(e.name) + '</h4><div class="sub">' + esc(e.muscles) +
          (it.sug && it.sug.why ? ' · <span style="color:var(--accent)">' + esc(it.sug.why) + '</span>' : '') + '</div></div>' +
          '<div class="rx">' + rx(it) + load + '</div></div>';
      });
      html += '</div>';
    });
    root.innerHTML = html + '</div></div>';
    mountThumbs();
    if ($('#saveTgl')) $('#saveTgl').onclick = function () {
      var i = state.saved.indexOf(p.key);
      if (i >= 0) state.saved.splice(i, 1); else state.saved.push(p.key);
      Store.save();
      this.textContent = i >= 0 ? '☆ Shrani' : '★ Shranjeno';
      toast(i >= 0 ? 'Odstranjeno iz shranjenih' : 'Shranjeno – najdeš ga na domačem zaslonu');
    };
  };

  SCREENS.library = function (p) {
    var f = p.f || 'all', g = p.g || 'all';
    function chip(kind, val, label, on) {
      return '<button class="chip focusable' + (on ? ' on' : '') + '" data-fid="lib-' + kind + '-' + val + '" data-lib="' + kind + '" data-val="' + val + '">' + label + '</button>';
    }
    var focusChips = chip('g', 'all', 'Vse skupine', g === 'all') +
      Object.keys(Exercises.FOCUS).map(function (k) { return chip('g', k, Exercises.FOCUS[k].icon + ' ' + Exercises.FOCUS[k].name, g === k); }).join('');
    var equipChips = chip('f', 'all', 'Vsa oprema', f === 'all') +
      Object.keys(Exercises.EQUIP).map(function (k) { return chip('f', k, Exercises.EQUIP[k].icon + ' ' + esc(Exercises.EQUIP[k].name), f === k); }).join('');
    var list = Exercises.LIST.filter(function (e) {
      return (f === 'all' || e.equip.indexOf(f) >= 0) && (g === 'all' || e.groups.indexOf(g) >= 0);
    });
    root.innerHTML = '<div class="screen"><div class="topbar"><h1>Knjižnica vaj</h1><span class="chip">' + list.length + ' vaj</span></div>' +
      '<div class="filters"><span class="flabel">Fokus</span>' + focusChips + '</div>' +
      '<div class="filters"><span class="flabel">Oprema</span>' + equipChips + '</div><div class="grid">' +
      (list.map(function (e) {
        return '<div class="lib-card focusable" tabindex="0" data-go="exercise" data-p=\'{"id":"' + e.id + '"}\'><div class="thumb" data-thumb="' + e.id + '"></div>' +
          '<div class="info"><h4>' + esc(e.name) + '</h4><div class="sub">' + esc(e.muscles) + '</div></div></div>';
      }).join('') || '<div class="hint">Za to kombinacijo ni vaj.</div>') + '</div></div>';
    mountThumbs();
    $$('[data-lib]').forEach(function (b) {
      b.onclick = function () {
        var np = { f: f, g: g }; np[b.getAttribute('data-lib')] = b.getAttribute('data-val');
        refresh(np);
      };
    });
  };

  SCREENS.exercise = function (p) {
    var e = ex(p.id);
    var h = state.ex[p.id];
    var el = document.createElement('div');
    el.className = 'player';
    el.innerHTML = '<div class="stage"><div class="fig" id="exFig"></div><div class="phase" id="exPhase"></div>' +
      '<div class="badge-top">' + e.equip.map(function (k) { return '<span class="chip">' + Exercises.EQUIP[k].icon + ' ' + esc(Exercises.EQUIP[k].name) + '</span>'; }).join('') + '</div></div>' +
      '<div class="side"><div class="kicker">' + esc(e.muscles) + '</div><h2>' + esc(e.name) + '</h2>' +
      '<div class="muscles">Tempo: <b>' + esc(e.tempo || '') + '</b>' + (h ? ' · Zadnjič: <b>' + esc(loadTxt(e, h.load)) + '</b> × ' + h.reps.join(', ') : '') + '</div>' +
      '<div class="label">Izvedba</div><ul class="cues">' + e.cues.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' +
      '<div class="label">Pogoste napake</div><ul class="cues bad">' + (e.mistakes || []).map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' +
      '<div class="controls"><button class="btn primary focusable" id="solo">▶ Treniraj to vajo</button><button class="btn focusable" id="spd">Hitrost: 1×</button><button class="btn focusable" id="pp">Pavza</button><button class="btn ghost focusable" id="bk">← Nazaj</button></div></div>';
    document.body.appendChild(el);
    var speeds = [1, 0.5, 0.25], si = 0;
    var pl = mountFigure($('#exFig'), p.id, { aspect: 1.45, onPhase: function (l) { $('#exPhase').textContent = l || ' '; } });
    $('#spd').onclick = function () { si = (si + 1) % speeds.length; pl.speed = (e.speed || 1) * speeds[si]; this.textContent = 'Hitrost: ' + speeds[si] + '×'; };
    $('#pp').onclick = function () { this.textContent = pl.toggle() ? 'Pavza' : 'Predvajaj'; };
    $('#bk').onclick = back;
    $('#solo').onclick = function () { startCustom(Program.single(p.id), 'player'); };
    $('#spd').setAttribute('data-autofocus', '');
  };

  SCREENS.history = function () {
    var log = state.log.slice().reverse();
    // weekly volume bars (sessions per week, last 12 weeks)
    var bars = '';
    for (var w = 11; w >= 0; w--) {
      var end = new Date(); end.setDate(end.getDate() - w * 7);
      var start = new Date(end); start.setDate(end.getDate() - 7);
      var c = state.log.filter(function (l) { var d = new Date(l.date); return d > start && d <= end; }).length;
      bars += '<i style="height:' + Math.max(3, c / 4 * 100) + '%" title="' + c + '"></i>';
    }
    var prs = Object.keys(state.ex).map(function (id) {
      var e = ex(id), h = state.ex[id];
      if (!e) return '';
      return '<div class="hist-item"><div class="d">' + esc(h.date ? h.date.slice(0, 10) : '') + '</div><div style="flex:1"><b>' + esc(e.name) + '</b></div><div>' + esc(loadTxt(e, h.load)) + ' × ' + h.reps.join(' / ') + '</div></div>';
    }).join('');
    root.innerHTML = '<div class="screen"><div class="topbar"><h1>Napredek</h1><div class="spacer"></div><button class="btn sm ghost focusable" data-autofocus data-go="settings">Varnostna kopija</button></div>' +
      '<div class="hero"><div class="panel"><h3>Treningi na teden (12 tednov)</h3><div class="bars">' + bars + '</div><div class="hint">Cilj: ' + state.settings.days + ' na teden</div></div>' +
      '<div class="panel"><h3>Zadnji treningi</h3><div class="hist">' + (log.slice(0, 6).map(function (l) {
        var s = Program.get(state, l.session);
        return '<div class="hist-item"><div class="d">' + new Date(l.date).toLocaleDateString('sl-SI') + '</div><div style="flex:1">' + esc(l.name || (s ? s.name : 'Trening')) + '</div><div>' + l.min + ' min · ' + l.sets.length + ' serij</div></div>';
      }).join('') || '<div class="hint">Še ni zabeleženih treningov.</div>') + '</div></div></div>' +
      '<div class="panel"><h3>Trenutne delovne teže (dvojna progresija)</h3><div class="hist">' + (prs || '<div class="hint">Po prvem treningu se tu pokažejo teže in ponovitve za vsako vajo.</div>') + '</div></div></div>';
  };

  SCREENS.settings = function () {
    var s = state.settings;
    function opt(key, val, label) {
      return '<button class="chip focusable' + (s[key] === val ? ' on' : '') + '" data-set="' + key + '" data-val=\'' + JSON.stringify(val) + '\'>' + label + '</button>';
    }
    var voiceInfo = Voice.v ? 'Glas: ' + Voice.v.name : 'Slovenski glas na tej napravi ni na voljo – uporabljam zvočne signale.';
    root.innerHTML = '<div class="screen"><div class="topbar"><h1>Nastavitve</h1><div class="spacer"></div>' +
      '<button class="btn sm ghost focusable who" data-go="profiles">' + avatar(state) + 'Zamenjaj osebo</button></div>' +
      '<div class="panel"><h3>Profil</h3><div class="opt-row">' + avatar(state, true) + '<div style="flex:1"><b style="font-size:1.3rem">' + esc(state.name) + '</b><div class="hint">' +
      (state.pin ? 'Zaklenjen s PIN-om' : 'Brez PIN-a') + ' · ' + state.log.length + ' treningov</div></div>' +
      '<button class="btn focusable" data-go="profileEdit" data-p=\'{"id":"' + state.id + '"}\'>Uredi profil</button></div></div><div class="panel">' +
      '<div class="opt-row"><div class="k">Treningov na teden</div>' + opt('days', 3, '3× – celo telo') + opt('days', 4, '4× – upper / lower') + '</div>' +
      '<div class="opt-row"><div class="k">Nivo</div>' + opt('level', 'beg', 'Začetnik') + opt('level', 'mid', 'Srednji') + opt('level', 'adv', 'Napreden') + '</div>' +
      '<div class="opt-row"><div class="k">Glasovna navodila</div>' + opt('voice', true, 'Vklopljeno') + opt('voice', false, 'Izklopljeno') + '<span class="hint">' + esc(voiceInfo) + '</span></div>' +
      '<div class="opt-row"><div class="k">Zvočni signali</div>' + opt('beeps', true, 'Vklopljeno') + opt('beeps', false, 'Izklopljeno') + '</div>' +
      '<div class="opt-row"><div class="k">Predogled – sekund na vajo</div>' + opt('previewSec', 10, '10 s') + opt('previewSec', 15, '15 s') + opt('previewSec', 25, '25 s') + '</div>' +
      '<div class="opt-row"><div class="k">Začetek 4-tedenskega bloka</div><span class="chip">' + esc(s.startDate) + '</span><button class="btn sm focusable" id="newBlock">Začni nov blok danes</button></div>' +
      '</div><div class="panel"><h3>Podatki</h3><div class="opt-row">' +
      '<button class="btn focusable" id="exp">⬇ Izvozi varnostno kopijo</button>' +
      '<label class="btn focusable" tabindex="0" id="impL">⬆ Uvozi<input type="file" id="imp" accept="application/json" hidden></label>' +
      '<button class="btn ghost focusable" id="rst">Ponastavi moj napredek</button></div>' +
      '<div class="hint">Podatki vseh oseb so shranjeni samo v tej napravi (brskalnik). Izvoz vsebuje vse profile – za prenos med telefonom in TV uporabi izvoz/uvoz.</div></div>' +
      '<div class="panel"><h3>Upravljanje z daljincem</h3><div class="hint"><span class="kbd">← ↑ → ↓</span> premikanje · <span class="kbd">OK</span> izberi / serija opravljena · <span class="kbd">Nazaj</span> nazaj · <span class="kbd">▶❚❚</span> pavza</div></div></div>';
    $$('[data-set]').forEach(function (b) {
      b.onclick = function () {
        s[b.getAttribute('data-set')] = JSON.parse(b.getAttribute('data-val'));
        Store.save();
        refresh();
      };
    });
    $('#newBlock').onclick = function () { s.startDate = new Date().toISOString().slice(0, 10); Store.save(); toast('Nov blok se začne danes – teden 1'); refresh(); };
    $('#exp').onclick = function () { Store.exportJSON(); };
    $('#impL').onclick = function (e) { if (e.target.id !== 'imp') $('#imp').click(); };
    $('#imp').onchange = function () {
      var f = this.files[0]; if (!f) return;
      f.text().then(function (t) { try { Store.importJSON(t); toast('Uvoženo – izberi osebo'); resetTo('profiles'); } catch (err) { toast('Napaka: ' + err.message); } });
    };
    $('#rst').onclick = function () {
      if (confirm('Res izbrišem vso zgodovino in teže za ' + state.name + '?')) { Store.resetProgress(state); toast('Ponastavljeno'); resetTo('home'); }
    };
  };

  // ---------------------------------------------------------------- TV preview (show mode)
  SCREENS.preview = function (p) {
    var sess = Program.build(state, p.key);
    var items = [];
    sess.blocks.forEach(function (b) { b.items.forEach(function (it) { if (!items.some(function (x) { return x.id === it.id; })) items.push({ it: it, block: b.title }); }); });
    var idx = 0, t0 = 0, paused = false, timer;
    var dur = state.settings.previewSec;

    var el = document.createElement('div');
    el.className = 'player preview';
    el.innerHTML = '<div class="stage"><div class="fig" id="pvFig"></div><div class="phase" id="pvPhase"></div><div class="badge-top"><span class="chip on" id="pvCount"></span><span class="chip" id="pvBlock"></span></div></div>' +
      '<div class="side"><div class="kicker" id="pvMus"></div><h2 id="pvName"></h2><div class="prescription" id="pvRx"></div>' +
      '<div class="label">Izvedba</div><ul class="cues" id="pvCues"></ul><div class="countdown"><i id="pvBar"></i></div>' +
      '<div class="controls"><button class="btn focusable" id="pvPrev">◀</button><button class="btn focusable" id="pvPause">Pavza</button><button class="btn focusable" id="pvNext">▶</button>' +
      '<button class="btn primary focusable" id="pvStart" data-autofocus>Začni trening</button></div></div>';
    document.body.appendChild(el);
    keepAwake(true);
    var pl = new Figure.Player($('#pvFig'), { aspect: 1.45, onPhase: function (l) { $('#pvPhase').textContent = l || ' '; } });
    players.push(pl);

    function show(i) {
      idx = (i + items.length) % items.length;
      var it = items[idx].it, e = ex(it.id);
      pl.speed = e.speed || 1; pl.load(e.anim);
      $('#pvCount').textContent = (idx + 1) + ' / ' + items.length;
      $('#pvBlock').textContent = items[idx].block;
      $('#pvMus').textContent = e.muscles;
      $('#pvName').textContent = e.name;
      $('#pvRx').innerHTML = '<div><b>' + esc(rx(it)) + '</b><span>serije</span></div><div><b>' + esc(it.sug ? loadTxt(e, it.sug.load) : it.cardio ? 'kardio' : 'drži') + '</b><span>breme</span></div><div><b>' + esc(e.tempo || '') + '</b><span>tempo</span></div>';
      $('#pvCues').innerHTML = e.cues.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('');
      t0 = Date.now();
      Voice.say(e.name + '. ' + e.cues[0]);
    }
    timer = setInterval(function () {
      if (paused) { t0 += 200; return; }
      var k = (Date.now() - t0) / 1000 / dur;
      $('#pvBar').style.width = Math.min(100, k * 100) + '%';
      if (k >= 1) show(idx + 1);
    }, 200);
    cleanup.push(function () { clearInterval(timer); el.remove(); if ('speechSynthesis' in window) speechSynthesis.cancel(); });
    $('#pvPrev').onclick = function () { show(idx - 1); };
    $('#pvNext').onclick = function () { show(idx + 1); };
    $('#pvPause').onclick = function () { paused = !paused; this.textContent = paused ? 'Nadaljuj' : 'Pavza'; if (paused) pl.stop(); else pl.start(); };
    $('#pvStart').onclick = function () { go('player', { key: p.key }, true); };
    activeSession = {
      onKey: function (code) {
        if (isKey(code, 'PLAY')) { $('#pvPause').click(); return true; }
        return false;
      },
      destroy: function () {}
    };
    show(0);
  };

  // ---------------------------------------------------------------- guided workout player
  SCREENS.player = function (p) {
    var sess = Program.build(state, p.key);
    var st = Program.steps(sess);
    var i = 0, phase = 'work', remain = 0, elapsed = 0, paused = false, startedAt = Date.now();
    var logged = [];
    var cur = { reps: 0, load: 0 };
    var itemsById = {};
    sess.blocks.forEach(function (b) { b.items.forEach(function (it) { itemsById[it.id] = it; }); });

    var el = document.createElement('div');
    el.className = 'player';
    el.innerHTML = '<div class="stage"><div class="fig" id="wFig"></div><div class="phase" id="wPhase"></div>' +
      '<div class="badge-top"><span class="chip on" id="wBlock"></span><span class="chip" id="wTag"></span></div>' +
      '<div class="rest-overlay" id="wRest" hidden><div class="t">POČITEK</div><div class="big" id="wRestT"></div><div class="t" id="wRestNext"></div></div></div>' +
      '<div class="side"><div class="kicker" id="wSet"></div><h2 id="wName"></h2><div class="muscles" id="wWhy"></div>' +
      '<div class="prescription" id="wRx"></div><div class="timer" id="wTimer">0:00</div>' +
      '<div class="logger" id="wLog"></div>' +
      '<ul class="cues" id="wCues"></ul>' +
      '<div class="controls"><button class="btn primary focusable" id="wDone" data-autofocus>✓ Serija opravljena</button>' +
      '<button class="btn focusable" id="wPause">Pavza</button><button class="btn focusable" id="wSkip">Preskoči ▶</button><button class="btn ghost focusable" id="wExit">Končaj</button></div></div>' +
      '<div class="bottom"><div class="next-up" id="wNext"></div><div class="progress" id="wProg"></div><div class="next-up" id="wClock"></div></div>';
    document.body.appendChild(el);
    keepAwake(true);
    var pl = new Figure.Player($('#wFig'), { aspect: 1.45, onPhase: function (l) { $('#wPhase').textContent = l || ' '; } });
    players.push(pl);
    var lastId = null;

    $('#wProg').innerHTML = st.map(function () { return '<i></i>'; }).join('');

    function stepper(key, val, step, unit) {
      return '<div class="stepper"><button class="focusable" data-k="' + key + '" data-d="-' + step + '">−</button><div class="val"><span id="v_' + key + '">' + val + '</span><small>' + unit + '</small></div>' +
        '<button class="focusable" data-k="' + key + '" data-d="' + step + '">+</button></div>';
    }

    function enter(n) {
      i = n;
      if (i >= st.length) return finish();
      var s = st[i], e = ex(s.id), it = s.item;
      phase = 'work'; elapsed = 0;
      $('#wRest').hidden = true;
      if (s.id !== lastId) { pl.speed = (e.speed || 1); pl.load(e.anim); lastId = s.id; }
      else { pl.speed = (e.speed || 1); }
      if (s.easy) pl.speed = (e.speed || 1) * 0.7;
      $('#wBlock').textContent = s.block;
      $('#wTag').textContent = s.tag ? s.tag : (s.hard ? 'INTERVAL ' + s.set + '/' + s.sets : '');
      $('#wTag').hidden = !$('#wTag').textContent;
      $('#wName').textContent = e.name;
      $('#wSet').textContent = s.kind === 'reps' ? 'Serija ' + s.set + ' / ' + s.sets : (s.sets > 1 ? 'Krog ' + s.set + ' / ' + s.sets : e.muscles);
      $('#wCues').innerHTML = e.cues.slice(0, 3).map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('');
      var bars = $$('#wProg i');
      bars.forEach(function (b, k) { b.className = k < i ? 'done' : k === i ? 'cur' : ''; });

      if (s.kind === 'reps') {
        var sug = it.sug;
        var prev = logged.filter(function (l) { return l.id === s.id; }).pop();
        cur.reps = prev ? prev.reps : sug.reps;
        cur.load = prev ? prev.load : sug.load;
        $('#wWhy').textContent = sug.why || ('Cilj: ' + it.reps[0] + '–' + it.reps[1] + ' ponovitev, RIR ' + sess.weekInfo.rir);
        $('#wRx').innerHTML = '<div><b>' + (it.reps[0] === it.reps[1] ? it.reps[0] : it.reps[0] + '–' + it.reps[1]) + '</b><span>ponovitev' + (s.perSide ? '/str.' : '') + '</span></div>' +
          '<div><b>RIR ' + sess.weekInfo.rir + '</b><span>v rezervi</span></div><div><b>' + esc(e.tempo || '') + '</b><span>tempo</span></div>';
        var lg = stepper('reps', cur.reps, 1, 'ponovitev');
        if (e.unit === 'kg') lg += stepper('load', cur.load, e.id.indexOf('kb_') === 0 ? 4 : (e.inc || 2), 'kg');
        if (e.unit === 'stopnja') lg += stepper('load', cur.load, 1, 'stopnja');
        $('#wLog').innerHTML = lg; $('#wLog').hidden = false;
        $('#wTimer').className = 'timer';
        $('#wDone').textContent = '✓ Serija opravljena';
        Voice.say(e.name + '. ' + (s.set === 1 ? e.cues[0] : 'Serija ' + s.set));
      } else {
        remain = s.sec;
        $('#wWhy').textContent = s.label || '';
        $('#wRx').innerHTML = '<div><b>' + fmt(s.sec) + '</b><span>' + (s.hard ? 'močno' : s.easy ? 'lahkotno' : 'trajanje') + '</span></div>' +
          '<div><b>' + (s.sets > 1 ? s.set + '/' + s.sets : '1') + '</b><span>' + (s.hard || s.easy ? 'interval' : 'serija') + '</span></div><div><b>' + esc(e.tempo || '') + '</b><span>tempo</span></div>';
        $('#wLog').innerHTML = ''; $('#wLog').hidden = true;
        $('#wTimer').className = 'timer' + (s.easy ? ' rest' : '');
        $('#wDone').textContent = '⏭ Naprej';
        if (s.hard) { Audio.beep(1200, 0.35); Voice.say('Močno!'); }
        else if (s.easy) { Audio.beep(600, 0.3); Voice.say('Lahkotno.'); }
        else Voice.say(e.name + '. ' + e.cues[0]);
      }
      var nx = st[i + 1];
      $('#wNext').innerHTML = nx ? 'Naslednje: <b>' + esc(ex(nx.id).name) + '</b>' : 'Zadnja serija 💪';
      bindSteppers();
      if (!el.contains(document.activeElement)) $('#wDone').focus();
    }

    function bindSteppers() {
      $$('[data-k]', el).forEach(function (b) {
        b.onclick = function () {
          var k = b.getAttribute('data-k'), d = parseFloat(b.getAttribute('data-d'));
          cur[k] = Math.max(0, Math.round((cur[k] + d) * 10) / 10);
          $('#v_' + k).textContent = cur[k];
        };
      });
    }

    function completeWork() {
      var s = st[i];
      if (s.kind === 'reps') logged.push({ id: s.id, reps: cur.reps, load: cur.load });
      if (s.rest > 0 && i < st.length - 1) startRest(s.rest);
      else enter(i + 1);
    }

    function startRest(sec) {
      phase = 'rest'; remain = sec;
      var nx = st[i + 1], ne = ex(nx.id);
      $('#wRest').hidden = false;
      $('#wRestNext').innerHTML = 'Naslednje: <b>' + esc(ne.name) + '</b>' + (nx.kind === 'reps' ? ' · serija ' + nx.set + '/' + nx.sets : '');
      $('#wDone').textContent = '⏭ Preskoči počitek';
      // show the next exercise animating behind the rest overlay
      if (nx.id !== lastId) { pl.speed = ne.speed || 1; pl.load(ne.anim); lastId = nx.id; }
      Voice.say('Počitek ' + sec + ' sekund. Naslednje: ' + ne.name);
    }

    function tick() {
      if (paused) return;
      var s = st[i]; if (!s) return;
      $('#wClock').textContent = fmt((Date.now() - startedAt) / 1000);
      if (phase === 'rest') {
        remain -= 0.25;
        $('#wRestT').textContent = fmt(remain);
        if (remain <= 3.01 && remain > 0 && Math.abs(remain - Math.round(remain)) < 0.01) Audio.beep(880, 0.12);
        if (remain <= 0) { Audio.beep(1320, 0.3); enter(i + 1); }
        return;
      }
      if (s.kind === 'time') {
        remain -= 0.25;
        $('#wTimer').textContent = fmt(remain);
        if (remain <= 3.01 && remain > 0 && Math.abs(remain - Math.round(remain)) < 0.01) Audio.beep(880, 0.12);
        if (s.sec >= 60 && Math.abs(remain - s.sec / 2) < 0.01) Voice.say('Polovica.');
        if (remain <= 0) { Audio.beep(1320, 0.3); completeWork(); }
      } else {
        elapsed += 0.25;
        $('#wTimer').textContent = fmt(elapsed);
      }
    }
    var iv = setInterval(tick, 250);

    function finish() {
      clearInterval(iv);
      var min = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
      if (logged.length || min >= 10) {
        Store.recordSession(state, { date: new Date().toISOString(), session: sess.key, name: sess.name, min: min, sets: logged, items: itemsById });
      }
      Voice.say('Odlično. Trening je končan.');
      pl.stop();
      $('#wRest').hidden = false;
      $('#wRest').innerHTML = '<div class="t">TRENING KONČAN</div><div class="big" style="color:var(--accent)">' + min + ' min</div><div class="t">' + logged.length + ' zabeleženih serij · napredek je shranjen</div>' +
        '<button class="btn primary focusable" id="wHome" style="margin-top:1.5rem">Domov</button>';
      $('.controls', el).innerHTML = '';
      $('#wHome').onclick = function () { stack = [{ screen: 'home', params: {} }]; render(); };
      $('#wHome').focus();
      activeSession.confirmExit = null;
      i = st.length;
    }

    $('#wDone').onclick = function () {
      if (phase === 'rest') { enter(i + 1); return; }
      completeWork();
    };
    $('#wSkip').onclick = function () { if (phase === 'rest') enter(i + 1); else enter(i + 1); };
    $('#wPause').onclick = function () { paused = !paused; this.textContent = paused ? 'Nadaljuj' : 'Pavza'; if (paused) pl.stop(); else pl.start(); };
    $('#wExit').onclick = function () { if (confirm('Končam trening in shranim opravljene serije?')) finish(); };

    activeSession = {
      onKey: function (code) {
        if (isKey(code, 'PLAY')) { $('#wPause').click(); return true; }
        return false;
      },
      confirmExit: function () { return confirm('Zapustim trening? Neshranjene serije se izgubijo.'); },
      destroy: function () { clearInterval(iv); el.remove(); if ('speechSynthesis' in window) speechSynthesis.cancel(); }
    };
    enter(0);
  };


  // ---------------------------------------------------------------- profiles ("Kdo trenira?")
  SCREENS.profiles = function () {
    var list = Store.list();
    var lastId = (Store.active() || {}).id;
    root.innerHTML = '<div class="screen center"><div class="brand big-brand">Home<b>Gym</b> Coach</div><h1 class="who-title">Kdo trenira?</h1><div class="profiles">' +
      list.map(function (pr, i) {
        return '<button class="profile focusable" data-pid="' + pr.id + '"' + (pr.id === lastId || (!lastId && i === 0) ? ' data-autofocus' : '') + '>' + avatar(pr, true) +
          '<b>' + esc(pr.name) + '</b><span>' + (pr.pin ? '🔒 ' : '') + pr.log.length + ' treningov</span></button>';
      }).join('') +
      '<button class="profile add focusable" data-go="profileEdit"><span class="avatar big">＋</span><b>Dodaj osebo</b><span>nov profil</span></button></div>' +
      '<div class="hint">Vsaka oseba ima svoj program, teže, napredek in nastavitve.</div></div>';
    $$('[data-pid]').forEach(function (b) {
      b.onclick = function () {
        var pr = Store.list().filter(function (x) { return x.id === b.getAttribute('data-pid'); })[0];
        if (pr.pin) go('pin', { id: pr.id }); else activate(pr);
      };
    });
  };

  function activate(pr) {
    state = Store.setActive(pr.id);
    resetTo('home');
    toast('Živjo, ' + pr.name + '!');
  }

  // on-screen keypad: works with the D-pad and with the remote's number keys
  function keypad() {
    var k = [1, 2, 3, 4, 5, 6, 7, 8, 9, '⌫', 0, '✓'];
    return '<div class="keypad">' + k.map(function (x) { return '<button class="focusable" data-key="' + x + '"' + (x === 5 ? ' data-autofocus' : '') + '>' + x + '</button>'; }).join('') + '</div>';
  }
  function bindKeypad(onDigit, onDel, onOk) {
    $$('[data-key]').forEach(function (b) {
      b.onclick = function () {
        var v = b.getAttribute('data-key');
        if (v === '⌫') onDel(); else if (v === '✓') onOk(); else onDigit(v);
      };
    });
    activeSession = {
      onKey: function (code) {
        if (code >= 48 && code <= 57) { onDigit(String(code - 48)); return true; }
        if (code >= 96 && code <= 105) { onDigit(String(code - 96)); return true; }
        return false;
      },
      destroy: function () {}
    };
  }

  SCREENS.pin = function (p) {
    var pr = Store.list().filter(function (x) { return x.id === p.id; })[0];
    var pin = '';
    root.innerHTML = '<div class="screen center">' + avatar(pr, true) + '<h1>' + esc(pr.name) + '</h1><div class="hint">Vnesi PIN</div><div class="dots" id="dots"></div>' + keypad() + '</div>';
    function draw() { $('#dots').innerHTML = [0, 1, 2, 3].map(function (i) { return '<i' + (i < pin.length ? ' class="on"' : '') + '></i>'; }).join(''); }
    function check() {
      if (Store.checkPin(pr, pin)) activate(pr);
      else { toast('Napačen PIN'); pin = ''; draw(); }
    }
    bindKeypad(function (d) { if (pin.length < 4) { pin += d; draw(); if (pin.length === 4) setTimeout(check, 150); } },
      function () { pin = pin.slice(0, -1); draw(); }, check);
    draw();
  };

  var pdraft = null;
  SCREENS.profileEdit = function (p) {
    var existing = p.id ? Store.list().filter(function (x) { return x.id === p.id; })[0] : null;
    if (!pdraft || pdraft.for !== (p.id || 'new')) {
      pdraft = {
        for: p.id || 'new',
        name: existing ? existing.name : '',
        color: existing ? existing.color : Store.COLORS[Store.list().length % Store.COLORS.length],
        level: existing ? existing.settings.level : 'mid',
        days: existing ? existing.settings.days : 3,
        pin: null, clearPin: false
      };
    }
    var d = pdraft;
    function chip(key, val, label) {
      return '<button class="chip focusable' + (d[key] === val ? ' on' : '') + '" data-fid="pe-' + key + '-' + val + '" data-pe="' + key + '" data-val=\'' + JSON.stringify(val) + '\'>' + label + '</button>';
    }
    root.innerHTML = '<div class="screen"><div class="topbar"><h1>' + (existing ? 'Uredi profil' : 'Nova oseba') + '</h1></div><div class="panel">' +
      '<div class="opt-row"><div class="k">Ime</div><input class="field focusable" id="pName" data-fid="pe-name" maxlength="20" placeholder="npr. Bojan" value="' + esc(d.name) + '"' + (existing ? '' : ' data-autofocus') + '></div>' +
      '<div class="opt-row"><div class="k">Barva</div>' + Store.COLORS.map(function (c) {
        return '<button class="swatch focusable' + (d.color === c ? ' on' : '') + '" data-fid="pe-color-' + c + '" data-pe="color" data-val=\'"' + c + '"\' style="background:' + c + '"></button>';
      }).join('') + '</div>' +
      '<div class="opt-row"><div class="k">Nivo</div>' + chip('level', 'beg', 'Začetnik') + chip('level', 'mid', 'Srednji') + chip('level', 'adv', 'Napreden') + '</div>' +
      '<div class="opt-row"><div class="k">Treningov na teden</div>' + chip('days', 3, '3× – celo telo') + chip('days', 4, '4× – upper / lower') + '</div>' +
      '<div class="opt-row"><div class="k">PIN (neobvezno)</div><input class="field focusable" id="pPin" data-fid="pe-pin" type="password" inputmode="numeric" maxlength="4" placeholder="4 števke" value="' + esc(d.pin || '') + '">' +
      (existing && existing.pin ? '<button class="chip focusable' + (d.clearPin ? ' on' : '') + '" data-fid="pe-clear" id="pClear">Odstrani PIN</button>' : '') +
      '<span class="hint">Zaklene profil na skupnem TV-ju (zasebnost, ne varnost).</span></div>' +
      '</div><div class="nav-row"><button class="btn primary focusable" id="pSave">' + (existing ? 'Shrani' : 'Ustvari profil') + '</button>' +
      (Store.list().length ? '<button class="btn ghost focusable" id="pCancel">Prekliči</button>' : '') +
      (existing && Store.list().length > 1 ? '<button class="btn ghost focusable danger" id="pDel">Izbriši osebo</button>' : '') + '</div></div>';
    function readInputs() { d.name = $('#pName').value.trim(); var pv = $('#pPin').value.trim(); d.pin = pv || null; }
    $$('[data-pe]').forEach(function (b) {
      b.onclick = function () { readInputs(); d[b.getAttribute('data-pe')] = JSON.parse(b.getAttribute('data-val')); refresh(); };
    });
    if ($('#pClear')) $('#pClear').onclick = function () { readInputs(); d.clearPin = !d.clearPin; refresh(); };
    $('#pSave').onclick = function () {
      readInputs();
      if (!d.name) { toast('Vpiši ime'); $('#pName').focus(); return; }
      if (d.pin && !/^\d{4}$/.test(d.pin)) { toast('PIN mora imeti 4 števke'); $('#pPin').focus(); return; }
      var pr = existing || Store.addProfile(Store.newProfile());
      pr.name = d.name; pr.color = d.color; pr.settings.level = d.level; pr.settings.days = d.days;
      if (d.pin) Store.setPin(pr, d.pin); else if (d.clearPin) Store.setPin(pr, null);
      Store.save();
      pdraft = null;
      if (existing && state && existing.id === state.id) { toast('Shranjeno'); back(); }
      else activate(pr);
    };
    if ($('#pCancel')) $('#pCancel').onclick = function () { pdraft = null; back(); };
    if ($('#pDel')) $('#pDel').onclick = function () {
      if (!confirm('Izbrišem profil ' + existing.name + ' in vso njegovo zgodovino?')) return;
      Store.removeProfile(existing.id);
      pdraft = null; state = null;
      resetTo('profiles');
    };
  };

  // ---------------------------------------------------------------- session builder
  var bdraft = null;
  var ALL_FOCUS = ['noge', 'zadnjica', 'prsa', 'hrbet', 'rame', 'roke', 'trup'];
  SCREENS.builder = function () {
    if (!bdraft) bdraft = { opts: { type: 'moc', focus: ['noge', 'zadnjica'], min: 45, machine: 'both', intensity: 'mix' }, src: null, swap: {} };
    var o = bdraft.opts;
    o.level = state.settings.level;
    if (!bdraft.src) bdraft.src = Program.generate(o);
    var src = bdraft.src;
    var built = Program.build(state, (function () { state.customs.__draft = src; return '__draft'; })());
    delete state.customs.__draft;
    var mins = Program.estimateMin(built);

    function chip(key, val, label, on) {
      return '<button class="chip focusable' + (on ? ' on' : '') + '" data-fid="b-' + key + '-' + val + '" data-b="' + key + '" data-val="' + val + '">' + label + '</button>';
    }
    var html = '<div class="screen"><div class="ov-head"><div><div class="chip on" style="display:inline-block;margin-bottom:.6rem">Po meri</div><h1>Sestavi trening</h1>' +
      '<p>' + esc(src.name) + ' · ~' + mins + ' min</p></div><div class="spacer"></div>' +
      '<button class="btn ghost focusable" id="bSave" data-fid="b-save">☆ Shrani</button>' +
      '<button class="btn focusable" id="bPrev" data-fid="b-prev">📺 Predogled</button>' +
      '<button class="btn primary focusable" id="bGo" data-fid="b-go">▶ Začni</button></div>' +
      '<div class="panel builder">' +
      '<div class="opt-row"><div class="k">Vrsta</div>' + chip('type', 'moc', '🏋️ Moč', o.type === 'moc') + chip('type', 'kardio', '❤️ Kardio', o.type === 'kardio') + chip('type', 'mix', '⚡ Moč + kardio', o.type === 'mix') + '</div>';
    if (o.type !== 'kardio') {
      var all = ALL_FOCUS.every(function (f) { return o.focus.indexOf(f) >= 0; });
      html += '<div class="opt-row"><div class="k">Fokus <span class="hint">(več izbir)</span></div>' + chip('focus', 'all', 'Celo telo', all) +
        ALL_FOCUS.map(function (f) { return chip('focus', f, Exercises.FOCUS[f].icon + ' ' + Exercises.FOCUS[f].name, !all && o.focus.indexOf(f) >= 0); }).join('') + '</div>';
    } else {
      html += '<div class="opt-row"><div class="k">Naprava</div>' + chip('machine', 'bike', '🚴 Kolo', o.machine === 'bike') + chip('machine', 'rower', '🚣 Veslač', o.machine === 'rower') + chip('machine', 'both', 'Oboje', o.machine === 'both') + '</div>' +
        '<div class="opt-row"><div class="k">Intenzivnost</div>' + chip('intensity', 'z2', 'Lahkotno – cona 2', o.intensity === 'z2') + chip('intensity', 'hiit', 'Intervali', o.intensity === 'hiit') + chip('intensity', 'mix', 'Mešano', o.intensity === 'mix') + '</div>';
    }
    html += '<div class="opt-row"><div class="k">Trajanje</div>' + [20, 30, 45, 60].map(function (m) { return chip('min', m, m + ' min', o.min === m); }).join('') + '</div></div><div class="blocks">';
    var row = 0;
    built.blocks.forEach(function (b, bi) {
      html += '<div class="block"><h3>' + esc(b.title) + '</h3>';
      b.items.forEach(function (it, ii) {
        var e = ex(it.id), r = row++;
        var gl = Program.groupLetter(b.title, bi), tag = b.items.length > 1 && gl ? '<span class="lbl">' + gl + (ii + 1) + '</span>' : '';
        var canSwap = e.type !== 'mobility' && Program.alternatives(src, it.id).length;
        html += '<div class="ex-row b-row"><div class="ex-thumb" data-thumb="' + it.id + '"></div><div><h4>' + tag + esc(e.name) + '</h4><div class="sub">' + esc(e.muscles) + '</div></div>' +
          '<div class="rx">' + rx(it) + (it.sug ? '<small>' + esc(loadTxt(e, it.sug.load)) + '</small>' : '') + '</div>' +
          '<div class="row-actions">' + (canSwap ? '<button class="btn sm focusable" data-fid="sw-' + r + '" data-swap="' + it.id + '">⇄ Zamenjaj</button>' : '') +
          '<button class="btn sm ghost focusable" data-fid="rm-' + r + '" data-rm="' + it.id + '">✕</button></div></div>';
      });
      html += '</div>';
    });
    root.innerHTML = html + '</div></div>';
    mountThumbs();

    $$('[data-b]').forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute('data-b'), v = b.getAttribute('data-val');
        if (k === 'focus') {
          if (v === 'all') o.focus = ALL_FOCUS.slice();
          else {
            if (ALL_FOCUS.every(function (f) { return o.focus.indexOf(f) >= 0; })) o.focus = [];
            var i = o.focus.indexOf(v);
            if (i >= 0) o.focus.splice(i, 1); else o.focus.push(v);
            if (!o.focus.length) o.focus = [v];
          }
        } else o[k] = k === 'min' ? +v : v;
        bdraft.src = null; bdraft.swap = {};
        refresh();
      };
    });
    $$('[data-swap]').forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-swap'), alts = Program.alternatives(src, id);
        if (!alts.length) return;
        var fid = b.getAttribute('data-fid');
        var n = bdraft.swap[fid] = (bdraft.swap[fid] || 0) + 1;
        Program.replaceItem(src, id, alts[(n - 1) % alts.length]);
        refresh();
      };
    });
    $$('[data-rm]').forEach(function (b) {
      b.onclick = function () {
        var n = 0; src.blocks.forEach(function (bl) { n += bl.items.length; });
        if (n <= 1) { toast('Trening potrebuje vsaj eno vajo'); return; }
        Program.removeItem(src, b.getAttribute('data-rm'));
        refresh();
      };
    });
    function commit() { return JSON.parse(JSON.stringify(src)); }
    $('#bGo').onclick = function () { startCustom(commit(), 'player'); };
    $('#bPrev').onclick = function () { startCustom(commit(), 'preview'); };
    $('#bSave').onclick = function () {
      var key = 'C_' + Date.now().toString(36);
      state.customs[key] = commit(); state.saved.push(key); Store.save();
      toast('Shranjeno – najdeš ga na domačem zaslonu');
    };
  };

  // ---------------------------------------------------------------- boot
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
  (function boot() {
    var list = Store.list();
    if (!list.length) go('profileEdit', {});
    else if (list.length === 1 && !list[0].pin) { state = Store.setActive(list[0].id); go('home'); }
    else go('profiles');
  })();
})();
