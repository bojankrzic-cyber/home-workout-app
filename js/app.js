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
  // In-app confirm (native confirm() is unavailable in embedded viewers and ugly on TV)
  function ask(msg, yes, onYes) {
    closeAsk();
    var prev = document.activeElement;
    var d = document.createElement('div'); d.className = 'dlg';
    d.innerHTML = '<div class="dlg-box" role="alertdialog" aria-modal="true"><p>' + esc(msg) + '</p><div class="dlg-row">' +
      '<button class="btn ghost focusable" data-a="no">Prekliči</button><button class="btn primary focusable" data-a="yes">' + esc(yes) + '</button></div></div>';
    d.onclick = function (e) {
      var a = e.target.closest('[data-a]');
      if (!a && e.target !== d) return;
      closeAsk();
      if (a && a.getAttribute('data-a') === 'yes') onYes();
      else if (prev && prev.isConnected && prev.focus) prev.focus();
    };
    document.body.appendChild(d);
    $('[data-a="yes"]', d).focus();
  }
  function closeAsk() { var d = $('.dlg'); if (d) d.remove(); }
  var DAYN = ['Ne', 'Po', 'To', 'Sr', 'Če', 'Pe', 'So'];
  // Slovenian plural forms: [1, 2, 3–4, 5+]
  function pl(n, f) { var k = Math.abs(n) % 100; return n + ' ' + (k === 1 ? f[0] : k === 2 ? f[1] : k === 3 || k === 4 ? f[2] : f[3]); }
  var VAJ = ['vaja', 'vaji', 'vaje', 'vaj'], TRN = ['trening', 'treninga', 'treningi', 'treningov'], NAP = ['naprava', 'napravi', 'naprave', 'naprav'];

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
    var scope = $('.dlg') || $('.player') || root;
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
    if ($('.dlg') && isKey(code, 'BACK')) { closeAsk(); e.preventDefault(); return; }
    if (!$('.dlg') && activeSession && activeSession.onKey && activeSession.onKey(code, e)) { e.preventDefault(); return; }
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
    closeAsk();
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
    if (activeSession && activeSession.confirmExit) { activeSession.confirmExit(popScreen); return; }
    popScreen();
  }
  function popScreen() {
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

  // Wordmark: condensed italic caps read as "sport" (scoreboards, kits); the brand line sits underneath
  function brandMark(cls) {
    return '<div class="brand ' + (cls || '') + '"><div class="wm"><span class="wm-top">FORM<em>SHAPER</em></span>' +
      '<span class="wm-by">' + 'by nature\u2019s finest'.split('').map(function (c) { return '<i>' + (c === ' ' ? '&nbsp;' : c) + '</i>'; }).join('') + '</span></div></div>';
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
      var id = el.getAttribute('data-thumb');
      var p = mountFigure(el, id, { aspect: el.clientWidth / Math.max(1, el.clientHeight) });
      if (!p) return;
      var e = ex(id);
      p.stop(); p.setTime(Figure.totalDur(e.anim) * 0.3);
      // real photo by default; focusing the card flips to the live technique animation
      if (photo(id)) { el.classList.add('ph-thumb'); el.insertAdjacentHTML('afterbegin', '<img class="thumb-photo" src="' + photo(id) + '" alt="" loading="lazy">'); }
      var host = el.closest('.focusable') || el;
      var on = function () { el.classList.add('live'); p.start(); }, off = function () { el.classList.remove('live'); p.stop(); };
      host.addEventListener('focus', on); host.addEventListener('blur', off);
      host.addEventListener('mouseenter', on); host.addEventListener('mouseleave', off);
    });
  }

  function rx(item) {
    var e = ex(item.id);
    if (item.cardio) return item.cardio.min ? item.cardio.min + ' min' : item.cardio.rounds + '× ' + item.cardio.work + '/' + item.cardio.easy + ' s';
    if (item.dist) return item.dist + ' m';
    if (item.time && item.sets === 1) return item.time >= 60 ? fmt(item.time) + ' min' : item.time + ' s' + ((item.perSide || e.perSide) ? '/str.' : '');
    if (item.time) return item.sets + '× ' + item.time + ' s' + ((item.perSide || e.perSide) ? '/str.' : '');
    var r = item.reps[0] === item.reps[1] ? item.reps[0] : item.reps[0] + '–' + item.reps[1];
    return item.sets + '× ' + r + ((item.perSide || e.perSide) ? '/str.' : '');
  }
  function loadTxt(e, load) {
    if (e.unit === 'kg') return load ? load + ' kg' : 'lastna teža';
    if (e.unit === 'stopnja') return 'stopnja ' + load;
    return 'lastna teža';
  }

  // ---------------------------------------------------------------- photos + muscles
  // exercises that look identical on camera share one photo
  var PHOTO_ALIAS = { hx_bike_run: 'bike_hiit' };
  function photo(id) {
    id = PHOTO_ALIAS[id] && !(window.PHOTOS && PHOTOS.ex.indexOf(id) >= 0) ? PHOTO_ALIAS[id] : id;
    return window.PHOTOS && PHOTOS.ex.indexOf(id) >= 0 ? 'img/ex/' + id + '.jpg' : null;
  }
  function photoBg(url) { return url ? ' style="background-image:linear-gradient(90deg, rgba(5,10,7,.92) 0%, rgba(5,10,7,.55) 55%, rgba(5,10,7,.15) 100%), url(' + url + ')"' : ''; }
  function cardBg(url) { return url ? ' style="background-image:linear-gradient(0deg, rgba(5,10,7,.95) 8%, rgba(5,10,7,.35) 70%), url(' + url + ')"' : ''; }
  // first exercise of a session (after the warm-up) that has a real photo
  function sessionPhoto(src) {
    var ids = [];
    src.blocks.forEach(function (b) { b.items.forEach(function (it) { ids.push(it.id); }); });
    var main = ids.slice(1).concat(ids.slice(0, 1));
    for (var i = 0; i < main.length; i++) if (photo(main[i])) return photo(main[i]);
    return null;
  }
  var MUS_NAMES = Figure.MUSCLE_NAME;
  function musChips(mus, legend) {
    return '<div class="mus-chips">' + mus.p.map(function (m) { return '<span class="mchip p">' + esc(MUS_NAMES[m] || m) + '</span>'; }).join('') +
      mus.s.map(function (m) { return '<span class="mchip s">' + esc(MUS_NAMES[m] || m) + '</span>'; }).join('') + '</div>' +
      (legend ? '<div class="mus-legend"><span class="mchip p">glavne</span><span class="mchip s">pomožne</span></div>' : '');
  }
  // front + back anatomical map; muscles lit by role
  var MAP_FRONT = {
    delts: '<ellipse cx="30" cy="45" rx="7" ry="8"/><ellipse cx="70" cy="45" rx="7" ry="8"/>',
    chest: '<path d="M38 44 Q49 41 49 47 L49 60 Q41 63 36 57 Q34 49 38 44Z"/><path d="M62 44 Q51 41 51 47 L51 60 Q59 63 64 57 Q66 49 62 44Z"/>',
    biceps: '<ellipse cx="26" cy="64" rx="4.6" ry="10"/><ellipse cx="74" cy="64" rx="4.6" ry="10"/>',
    forearms: '<ellipse cx="22.5" cy="88" rx="4" ry="11"/><ellipse cx="77.5" cy="88" rx="4" ry="11"/>',
    abs: '<rect x="43" y="63" width="14" height="32" rx="5"/>',
    obliques: '<ellipse cx="38" cy="80" rx="4" ry="11"/><ellipse cx="62" cy="80" rx="4" ry="11"/>',
    hipflex: '<ellipse cx="43" cy="103" rx="4" ry="5"/><ellipse cx="57" cy="103" rx="4" ry="5"/>',
    quads: '<ellipse cx="41.5" cy="128" rx="7.4" ry="19"/><ellipse cx="58.5" cy="128" rx="7.4" ry="19"/>',
    calves: '<ellipse cx="41" cy="172" rx="4.4" ry="13"/><ellipse cx="59" cy="172" rx="4.4" ry="13"/>',
    traps: '<path d="M43 35 L50 38 L57 35 L62 41 L38 41Z"/>'
  };
  var MAP_BACK = {
    traps: '<path d="M50 34 L63 42 L50 62 L37 42Z"/>',
    delts: '<ellipse cx="30" cy="45" rx="7" ry="8"/><ellipse cx="70" cy="45" rx="7" ry="8"/>',
    lats: '<path d="M37 50 Q34 66 43 82 L48 66 L48 52Z"/><path d="M63 50 Q66 66 57 82 L52 66 L52 52Z"/>',
    triceps: '<ellipse cx="26" cy="64" rx="4.6" ry="10"/><ellipse cx="74" cy="64" rx="4.6" ry="10"/>',
    forearms: '<ellipse cx="22.5" cy="88" rx="4" ry="11"/><ellipse cx="77.5" cy="88" rx="4" ry="11"/>',
    lowback: '<rect x="44" y="80" width="12" height="15" rx="4"/>',
    glutes: '<ellipse cx="43" cy="106" rx="8" ry="8.5"/><ellipse cx="57" cy="106" rx="8" ry="8.5"/>',
    hams: '<ellipse cx="42" cy="133" rx="6.6" ry="17"/><ellipse cx="58" cy="133" rx="6.6" ry="17"/>',
    calves: '<ellipse cx="41.5" cy="170" rx="5.4" ry="13"/><ellipse cx="58.5" cy="170" rx="5.4" ry="13"/>'
  };
  var BODY = '<circle cx="50" cy="17" r="10"/><rect x="45" y="25" width="10" height="10" rx="3"/>' +
    '<path d="M34 37 Q50 31 66 37 L69 60 Q66 92 62 100 L38 100 Q34 92 31 60Z"/>' +
    '<rect x="21" y="38" width="11" height="40" rx="5.5"/><rect x="68" y="38" width="11" height="40" rx="5.5"/>' +
    '<rect x="18.5" y="74" width="8.5" height="30" rx="4"/><rect x="73" y="74" width="8.5" height="30" rx="4"/>' +
    '<rect x="34" y="96" width="15" height="58" rx="7"/><rect x="51" y="96" width="15" height="58" rx="7"/>' +
    '<rect x="36" y="150" width="11" height="44" rx="5"/><rect x="53" y="150" width="11" height="44" rx="5"/>';
  function mapHalf(defs, mus, x, label) {
    var o = '<g transform="translate(' + x + ' 0)"><g class="mm-body">' + BODY + '</g>';
    Object.keys(defs).forEach(function (m) {
      var c = mus.p.indexOf(m) >= 0 ? 'mm p' : mus.s.indexOf(m) >= 0 ? 'mm s' : 'mm';
      o += '<g class="' + c + '">' + defs[m] + '</g>';
    });
    return o + '<text x="50" y="210" class="mm-lbl">' + label + '</text></g>';
  }
  function muscleMap(mus) {
    return '<svg viewBox="0 0 210 216" class="mmap">' + mapHalf(MAP_FRONT, mus, 0, 'SPREDAJ') + mapHalf(MAP_BACK, mus, 106, 'ZADAJ') + '</svg>';
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
    var heroPhoto = sessionPhoto(sess) || photo('kb_goblet_squat');

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
      var cp = sessionPhoto(s);
      return '<div class="session-card focusable' + (cp ? ' photo-card' : '') + (k === nextKey ? ' next' : '') + '" tabindex="0" data-go="overview" data-p=\'{"key":"' + k + '"}\'' + cardBg(cp) + '>' +
        '<div class="tag" style="color:' + s.color + '">' + (k === nextKey ? 'NASLEDNJI' : 'TRENING ' + (plan.order.indexOf(k) + 1)) + '</div>' +
        '<h3>' + esc(s.name) + '</h3><p>' + esc(s.short) + '</p></div>';
    }).join('');

    root.innerHTML =
      '<div class="screen">' +
      '<div class="topbar">' + brandMark() + '<span class="chip on">' + esc(sess.weekInfo.label) + '</span><div class="spacer"></div>' +
      '<button class="btn sm focusable" data-go="builder">＋ Sestavi trening</button>' +
      '<button class="btn sm ghost focusable" data-go="library">Knjižnica vaj</button>' +
      '<button class="btn sm ghost focusable" data-go="history">Napredek</button>' +
      '<button class="btn sm ghost focusable" data-go="settings">Nastavitve</button>' +
      '<button class="btn sm ghost focusable who" data-go="profiles" title="Zamenjaj osebo">' + avatar(state) + esc(state.name) + '</button></div>' +
      '<div class="hero"><div class="hero-card' + (heroPhoto ? ' has-photo' : '') + '"' + photoBg(heroPhoto) + '><div class="eyebrow">Današnji trening · ' + esc(sess.weekInfo.label) + '</div>' +
      '<h1>' + esc(sess.name) + '</h1>' +
      '<div class="meta"><div><b>~' + mins + ' min</b>trajanje</div><div><b>' + exCount + '</b>vaj</div><div><b>RIR ' + sess.weekInfo.rir + '</b>napor</div></div>' +
      '<div class="hint">' + esc(sess.weekInfo.note) + '</div>' +
      '<div class="actions"><button class="btn primary focusable" data-autofocus data-go="player" data-p=\'{"key":"' + nextKey + '"}\'>▶ Začni trening</button>' +
      '<button class="btn focusable" data-go="preview" data-p=\'{"key":"' + nextKey + '"}\'>📺 Predogled vaj</button>' +
      '<button class="btn ghost focusable" data-go="overview" data-p=\'{"key":"' + nextKey + '"}\'>Podrobnosti</button></div>' +
      (heroPhoto ? '' : '<div class="hero-fig" id="heroFig"></div>') + '</div>' +
      '<div class="week"><h3>Ta teden · ' + weekDone + ' / ' + plan.order.length + ' treningov</h3><div class="days">' + daysHtml + '</div>' +
      '<div class="stats"><div class="stat"><b>' + state.log.length + '</b><span>treningov skupaj</span></div>' +
      '<div class="stat"><b>' + Math.round(totalMin / 60) + ' h</b><span>skupni čas</span></div>' +
      '<div class="stat"><b>' + streak + '</b><span>zaporednih tednov</span></div></div></div></div>' +
      '<div class="section-title"><h2>Tvoj program</h2><span>' + plan.order.length + ' treningi v rotaciji · zamujen dan ne podre plana</span></div>' +
      '<div class="row">' + cards + '</div>' +
      '<div class="section-title"><h2>Trening po izbiri</h2><span>izberi fokus ali vrsto – sestavi se samo iz tvoje opreme</span></div>' +
      '<div class="row">' + QUICK.map(function (q, i) {
        var qp = q.photo && photo(q.photo);
        return '<div class="session-card focusable quick' + (qp ? ' photo-card' : '') + '" tabindex="0" data-quick="' + i + '"' + cardBg(qp) + '><div class="tag" style="color:' + q.color + '">' + q.tag + '</div><h3>' + esc(q.name) + '</h3><p>' + esc(q.sub) + '</p></div>';
      }).join('') + '<div class="session-card focusable quick" tabindex="0" data-go="builder"><div class="tag">PO MERI</div><h3>＋ Sestavi svoj trening</h3><p>moč / kardio / kombinirano · fokus · trajanje</p></div></div>' +
      '<div class="section-title"><h2>🏁 HYROX</h2><span>simulacija tekme na tvoji opremi – na čas, z vmesnimi časi</span></div>' +
      '<div class="row">' + Program.HX_KEYS.map(function (k) {
        var hs = Program.SESSIONS[k];
        return '<div class="session-card hx focusable photo-card" tabindex="0" data-go="overview" data-p=\'{"key":"' + k + '"}\'' + cardBg(photo(['kb_swing', 'row_hiit', 'kb_deadlift'][Program.HX_KEYS.indexOf(k)])) + '><div class="tag">' + (hs.race ? 'NA ČAS' : 'TRENING') + '</div><h3>' + esc(hs.name) + '</h3><p>' + esc(hs.short) + '</p></div>';
      }).join('') + '</div>' +
      (state.saved.length ? '<div class="section-title"><h2>Moji shranjeni treningi</h2></div><div class="row">' + state.saved.filter(function (k) { return state.customs[k]; }).map(function (k) {
        var c = state.customs[k];
        return '<div class="session-card focusable" tabindex="0" data-go="overview" data-p=\'{"key":"' + k + '"}\'><div class="tag" style="color:' + c.color + '">SHRANJENO</div><h3>' + esc(c.name) + '</h3><p>' + esc(c.short) + '</p></div>';
      }).join('') + '</div>' : '') +
      '</div>';
    if ($('#heroFig')) mountFigure($('#heroFig'), heroEx, { aspect: 1 });
    $$('[data-quick]').forEach(function (el) {
      el.onclick = function () {
        var o = Object.assign({ level: state.settings.level, owned: Program.owned(state) }, QUICK[+el.getAttribute('data-quick')].opts);
        startCustom(Program.generate(o));
      };
    });
  };

  var QUICK = [
    { tag: 'MOČ', name: 'Celo telo', photo: 'kb_goblet_squat', sub: '45 min · vse glavne skupine', color: '#3ec46d', opts: { type: 'moc', focus: ['noge', 'prsa', 'hrbet', 'zadnjica', 'rame', 'trup'], min: 45 } },
    { tag: 'MOČ', name: 'Noge & zadnjica', photo: 'kb_deadlift', sub: '40 min', color: '#f08a5d', opts: { type: 'moc', focus: ['noge', 'zadnjica'], min: 40 } },
    { tag: 'MOČ', name: 'Zgornji del', photo: 'db_bench', sub: '40 min · prsa, hrbet, rame, roke', color: '#b6c99b', opts: { type: 'moc', focus: ['prsa', 'hrbet', 'rame', 'roke'], min: 40 } },
    { tag: 'TRUP', name: 'Trebušne & hrbet', sub: '20 min', color: '#a99be8', opts: { type: 'moc', focus: ['trup'], min: 20 } },
    { tag: 'KARDIO', name: 'Intervali kolo + veslač', photo: 'bike_hiit', sub: '30 min', color: '#5ad1b8', opts: { type: 'kardio', machine: 'both', intensity: 'hiit', min: 30 } },
    { tag: 'KARDIO', name: 'Cona 2 – vzdržljivost', photo: 'row_steady', sub: '40 min · lahkotno', color: '#5ad1b8', opts: { type: 'kardio', machine: 'both', intensity: 'z2', min: 40 } }
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
          '<div class="ex-thumb" data-thumb="' + it.id + '"></div><div><h4>' + tag + esc(e.name) + '</h4><div class="sub">' +
          (it.swappedFrom ? '<span class="swap-note">⇄ namesto: ' + esc(ex(it.swappedFrom).name) + '</span> · ' : '') + esc(e.muscles) +
          (it.sug && it.sug.why ? ' · <span style="color:var(--accent)">' + esc(it.sug.why) + '</span>' : '') + '</div></div>' +
          '<div class="rx">' + rx(it) + load + '</div></div>';
      });
      html += '</div>';
    });
    if (sess.missing.length) html += '<div class="missing-note">Izpuščeno, ker ni ustrezne opreme: ' + sess.missing.map(function (id) { return esc(ex(id).name); }).join(', ') +
      ' · <button class="btn sm ghost focusable" data-go="equipment">Uredi opremo</button></div>';
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
    var f = p.f || 'mine', g = p.g || 'all';
    var own = Program.owned(state);
    function chip(kind, val, label, on) {
      return '<button class="chip focusable' + (on ? ' on' : '') + '" data-fid="lib-' + kind + '-' + val + '" data-lib="' + kind + '" data-val="' + val + '">' + label + '</button>';
    }
    var focusChips = chip('g', 'all', 'Vse skupine', g === 'all') +
      Object.keys(Exercises.FOCUS).map(function (k) { return chip('g', k, Exercises.FOCUS[k].name, g === k); }).join('');
    var equipKeys = Object.keys(Exercises.EQUIP).filter(function (k) { return k === 'floor' || own.indexOf(k) >= 0; });
    var equipChips = chip('f', 'mine', 'Moja oprema', f === 'mine') + chip('f', 'all', 'Vse vaje', f === 'all') +
      equipKeys.map(function (k) { return chip('f', k, '<span class="chip-ico">' + equipIcon(k) + '</span>' + esc(Exercises.EQUIP[k].name), f === k); }).join('');
    var list = Exercises.LIST.filter(function (e) {
      return (f === 'all' || (f === 'mine' ? Exercises.available(e.id, own) : e.equip.indexOf(f) >= 0)) && (g === 'all' || e.groups.indexOf(g) >= 0);
    });
    root.innerHTML = '<div class="screen"><div class="topbar"><h1>Knjižnica vaj</h1><span class="chip">' + pl(list.length, VAJ) + '</span><div class="spacer"></div>' +
      '<button class="btn sm ghost focusable" data-go="equipment">Moja oprema →</button></div>' +
      '<div class="filters"><span class="flabel">Fokus</span>' + focusChips + '</div>' +
      '<div class="filters"><span class="flabel">Oprema</span>' + equipChips + '</div><div class="grid">' +
      (list.map(function (e) {
        var ok = Exercises.available(e.id, own);
        var need = e.equip.filter(function (k) { return k !== 'floor' && own.indexOf(k) < 0; }).map(function (k) { return Exercises.EQUIP[k].name; }).join(', ');
        return '<div class="lib-card focusable' + (ok ? '' : ' locked') + '" tabindex="0" data-go="exercise" data-p=\'{"id":"' + e.id + '"}\'><div class="thumb" data-thumb="' + e.id + '"></div>' +
          '<div class="info"><h4>' + esc(e.name) + '</h4><div class="sub">' + (ok ? esc(e.muscles) : '🔒 Potrebuješ: ' + esc(need)) + '</div></div></div>';
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
    var ph = photo(p.id);
    var mus = e.anim.muscles;
    var steps = [];
    (e.anim.frames || []).forEach(function (f, i) { if (f.l && steps.every(function (s) { return s.l !== f.l; })) steps.push({ l: f.l, i: i }); });
    if (!steps.length && e.anim.label) steps.push({ l: e.anim.label, i: 0 });
    var el = document.createElement('div');
    el.className = 'player exd';
    el.innerHTML = '<div class="stage"><div class="fig" id="exFig"></div><div class="phase" id="exPhase"></div>' +
      '<div class="badge-top">' + e.equip.map(function (k) { return '<span class="chip"><span class="chip-ico">' + equipIcon(k) + '</span>' + esc(Exercises.EQUIP[k].name) + '</span>'; }).join('') + '</div>' +
      (ph ? '<button class="pip focusable" id="exPip"><img src="' + ph + '" alt=""><span>Prava izvedba · povečaj</span></button><div class="photo-full" id="exPhoto" hidden><img src="' + ph + '" alt=""><span>' + esc(e.name) + '</span></div>' : '') +
      '</div><div class="side"><div class="kicker">' + esc(e.muscles) + '</div><h2>' + esc(e.name) + '</h2>' +
      '<div class="why">Tempo <b>' + esc(e.tempo || '') + '</b>' + (h ? ' · zadnjič <b>' + esc(loadTxt(e, h.load)) + '</b> × ' + h.reps.join(', ') : '') + '</div>' +
      '<div class="mus-block"><div class="mus-map">' + muscleMap(mus) + '</div><div class="mus-list"><div class="label">Delajo</div>' + musChips(mus, true) + '</div></div>' +
      '<div class="label">Pravilna izvedba – po fazah</div><ol class="steps" id="exSteps">' + steps.map(function (s, k) { return '<li data-i="' + s.i + '"><b>' + (k + 1) + '</b>' + esc(s.l) + '</li>'; }).join('') + '</ol>' +
      '<div class="label">Ključne točke</div><ul class="cues ok">' + e.cues.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' +
      '<div class="label">Pogoste napake</div><ul class="cues bad">' + (e.mistakes || []).map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' +
      '<div class="controls"><button class="btn primary focusable" id="solo">▶ Treniraj to vajo</button><button class="btn focusable" id="spd">Hitrost 1×</button>' +
      '<button class="btn focusable" id="gd">Kontrolne točke: vklop</button><button class="btn ghost focusable" id="bk">← Nazaj</button></div></div>';
    document.body.appendChild(el);
    var speeds = [1, 0.5, 0.25], si = 0;
    var pl = mountFigure($('#exFig'), p.id, {
      aspect: 1.45, labels: true, guides: true,
      onPhase: function (l, idx) {
        $('#exPhase').textContent = l || ' ';
        var cur = null;
        $$('#exSteps li').forEach(function (li) { if (+li.getAttribute('data-i') <= idx) cur = li; });
        $$('#exSteps li').forEach(function (li) { li.classList.toggle('on', li === cur); });
      }
    });
    $('#spd').onclick = function () { si = (si + 1) % speeds.length; pl.speed = (e.speed || 1) * speeds[si]; this.textContent = 'Hitrost ' + speeds[si] + '×'; };
    $('#gd').onclick = function () { pl.guides = pl.labels = !pl.guides; this.textContent = 'Kontrolne točke: ' + (pl.guides ? 'vklop' : 'izklop'); };
    $('#bk').onclick = back;
    $('#solo').onclick = function () { startCustom(Program.single(p.id), 'player'); };
    if (ph) {
      $('#exPip').onclick = function () { var f = $('#exPhoto'); f.hidden = !f.hidden; this.querySelector('span').textContent = f.hidden ? 'Prava izvedba · povečaj' : 'Nazaj na animacijo'; };
    }
    $('#solo').setAttribute('data-autofocus', '');
    setTimeout(function () { var sd = $('.exd .side'); if (sd) sd.scrollTop = 0; }, 30);
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
      (state.pin ? 'Zaklenjen s PIN-om' : 'Brez PIN-a') + ' · ' + pl(state.log.length, TRN) + '</div></div>' +
      '<button class="btn focusable" data-go="profileEdit" data-p=\'{"id":"' + state.id + '"}\'>Uredi profil</button></div></div>' +
      '<div class="panel"><h3>Moja oprema</h3><div class="opt-row"><div class="eq-strip">' + (state.settings.equipment || []).map(function (k) { return '<span class="eq-mini" title="' + esc(Exercises.EQUIP[k].name) + '">' + equipIcon(k) + '</span>'; }).join('') +
      '</div><div class="spacer"></div><button class="btn focusable" data-go="equipment">' + pl((state.settings.equipment || []).length, NAP) + ' · ' + pl(unlocked(state.settings.equipment || []), VAJ) + ' · uredi →</button></div></div><div class="panel">' +
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
      ask('Res izbrišem vso zgodovino in teže za ' + state.name + '?', 'Ponastavi', function () { Store.resetProgress(state); toast('Ponastavljeno'); resetTo('home'); });
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
    el.innerHTML = '<div class="stage"><div class="fig" id="pvFig"></div><div class="phase" id="pvPhase"></div><div class="badge-top"><span class="chip on" id="pvCount"></span><span class="chip" id="pvBlock"></span></div>' +
      '<div class="pip" id="pvPip" hidden><img alt=""><span>Prava izvedba</span></div></div>' +
      '<div class="side"><div class="kicker" id="pvMus"></div><h2 id="pvName"></h2><div class="prescription" id="pvRx"></div>' +
      '<div class="mus-block"><div class="mus-map" id="pvMap"></div><div class="mus-list"><div class="label">Delajo</div><div id="pvChips"></div></div></div>' +
      '<div class="label">Ključne točke</div><ul class="cues ok" id="pvCues"></ul><div class="countdown"><i id="pvBar"></i></div>' +
      '<div class="controls"><button class="btn focusable" id="pvPrev">◀</button><button class="btn focusable" id="pvPause">Pavza</button><button class="btn focusable" id="pvNext">▶</button>' +
      '<button class="btn primary focusable" id="pvStart" data-autofocus>Začni trening</button></div></div>';
    document.body.appendChild(el);
    keepAwake(true);
    var pl = new Figure.Player($('#pvFig'), { aspect: 1.45, labels: true, guides: true, onPhase: function (l) { $('#pvPhase').textContent = l || ' '; } });
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
      $('#pvMap').innerHTML = muscleMap(e.anim.muscles);
      $('#pvChips').innerHTML = musChips(e.anim.muscles, true);
      var pp = photo(it.id); $('#pvPip').hidden = !pp; if (pp) $('#pvPip img').src = pp;
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
  // Layout follows proven workout-player patterns (Ladder, Runna, Hevy on Mobbin):
  // always-visible total clock + segmented session progress, "Next →" card, one big ring
  // (countdown for timed work/rest, tempo rep-pacer for rep sets), ±15 s on rest.
  var RING_C = 2 * Math.PI * 54;
  function ring(id) {
    return '<div class="ring-wrap"><svg class="ring" viewBox="0 0 120 120"><defs><linearGradient id="rg-' + id + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="var(--ring-a)"/><stop offset="1" stop-color="var(--ring-b)"/></linearGradient></defs>' +
      '<circle class="ring-bg" cx="60" cy="60" r="54"/><circle class="ring-fg" id="' + id + '" cx="60" cy="60" r="54" stroke="url(#rg-' + id + ')" ' +
      'stroke-dasharray="' + RING_C.toFixed(1) + '" stroke-dashoffset="0" transform="rotate(-90 60 60)"/></svg>' +
      '<div class="ring-center"><small id="' + id + 'Top"></small><b id="' + id + 'Val"></b><span id="' + id + 'Sub"></span></div></div>';
  }
  function setRing(id, frac) {
    var el = document.getElementById(id);
    if (el) el.style.strokeDashoffset = (RING_C * (1 - Math.max(0, Math.min(1, frac)))).toFixed(1);
  }

  SCREENS.player = function (p) {
    var sess = Program.build(state, p.key);
    var st = Program.steps(sess);
    var race = sess.race;
    var i = 0, phase = 'work', remain = 0, elapsed = 0, paused = false, total = 0, restTotal = 0;
    var logged = [], splits = [];
    var cur = { reps: 0, load: 0 };
    var pacerBase = 0, pacerHit = false;
    var itemsById = {};
    sess.blocks.forEach(function (b) { b.items.forEach(function (it) { itemsById[it.id] = it; }); });
    // block index per step for the segmented progress bar
    var blockTitles = [];
    st.forEach(function (s) { if (blockTitles[blockTitles.length - 1] !== s.block) blockTitles.push(s.block); });

    var el = document.createElement('div');
    el.className = 'player p2' + (race ? ' race' : '');
    el.innerHTML = '<div class="stage"><div class="fig" id="wFig"></div><div class="phase" id="wPhase"></div>' +
      '<div class="hud-top"><div class="hud-prog"><div class="segs" id="wSegs">' + blockTitles.map(function () { return '<i><b></b></i>'; }).join('') + '</div>' +
      '<div class="hud-meta" id="wMeta"></div></div>' +
      '<div class="hud-clock"><small>' + (race ? 'RACE ČAS' : 'SKUPAJ') + '</small><b id="wClock">0:00</b></div></div>' +
      '<div class="next-card" id="wNextCard"><div class="nc-thumb" id="wNextThumb"></div><div><small id="wNextLbl"></small><b id="wNextName"></b></div></div>' +
      '<div class="pip" id="wPip" hidden><img alt=""><span>Prava izvedba</span></div>' +
      '<div class="finish" id="wFinish" hidden></div></div>' +
      '<div class="side"><div class="kicker"><span id="wBlock"></span><span class="dots-set" id="wDots"></span></div>' +
      '<h2 id="wName"></h2><div class="why" id="wWhy"></div><div id="wMus"></div>' +
      ring('wRing') +
      '<div class="chips-row" id="wRx"></div>' +
      '<div class="logger" id="wLog"></div>' +
      '<div class="controls"><button class="btn primary focusable" id="wDone" data-autofocus></button>' +
      '<button class="btn focusable" id="wMinus" hidden>−15 s</button><button class="btn focusable" id="wPlus" hidden>+15 s</button>' +
      '<button class="btn focusable" id="wPause">Pavza</button><button class="btn ghost focusable" id="wSkip">Preskoči</button>' +
      '<button class="btn ghost focusable" id="wExit">Končaj</button></div>' +
      (race ? '<div class="splits" id="wSplits"></div>' : '') + '</div>';
    document.body.appendChild(el);
    keepAwake(true);
    var pl = new Figure.Player($('#wFig'), { aspect: 1.45, labels: true, onPhase: function (l) { $('#wPhase').textContent = l || ' '; } });
    players.push(pl);
    var nextPl = new Figure.Player($('#wNextThumb'), { aspect: 1.2 });
    players.push(nextPl);
    var lastId = null;

    function showAnim(id, speedMul) {
      var e = ex(id);
      if (id !== lastId) { pl.load(e.anim); lastId = id; }
      pl.speed = (e.speed || 1) * (speedMul || 1);
    }
    function pacerReps() {
      var e = ex(st[i].id);
      var T = Figure.totalDur(e.anim);
      return Math.floor((pl.time - pacerBase) * pl.speed / T) * (e.repsPerCycle || 1);
    }

    function stepper(key, val, step, unit) {
      return '<div class="stepper"><button class="focusable" data-k="' + key + '" data-d="-' + step + '">−</button><div class="val"><span id="v_' + key + '">' + val + '</span><small>' + unit + '</small></div>' +
        '<button class="focusable" data-k="' + key + '" data-d="' + step + '">+</button></div>';
    }
    function chips(list) { return list.map(function (c) { return '<div class="chip-stat"><b>' + esc(c[0]) + '</b><span>' + esc(c[1]) + '</span></div>'; }).join(''); }

    function renderNext() {
      var nx = st[i + 1];
      if (!nx) { $('#wNextLbl').textContent = 'Zadnji del'; $('#wNextName').textContent = 'Še malo – zmoreš 💪'; nextPl.stop(); return; }
      var ne = ex(nx.id);
      $('#wNextLbl').textContent = 'Naslednje →' + (nx.kind === 'reps' && nx.sets > 1 ? ' serija ' + nx.set + '/' + nx.sets : '') + (nx.rest === 0 && phase === 'rest' ? '' : '');
      $('#wNextName').textContent = (nx.kind === 'reps' ? (nx.item.reps[0] === nx.item.reps[1] ? nx.item.reps[0] : nx.item.reps[0] + '–' + nx.item.reps[1]) + '× ' :
        nx.kind === 'dist' ? nx.dist + ' m ' : fmt(nx.sec) + ' ') + ne.name;
      nextPl.speed = ne.speed || 1; nextPl.load(ne.anim);
    }

    function progressUI() {
      var bi = blockTitles.indexOf(st[Math.min(i, st.length - 1)].block);
      var segs = $$('#wSegs i');
      var inBlock = st.filter(function (s) { return s.block === blockTitles[bi]; });
      var posInBlock = st.slice(0, i).filter(function (s) { return s.block === blockTitles[bi]; }).length;
      segs.forEach(function (sg, k) {
        sg.className = k < bi ? 'done' : k === bi ? 'cur' : '';
        sg.firstChild.style.width = (k < bi ? 100 : k === bi ? Math.round(posInBlock / inBlock.length * 100) : 0) + '%';
      });
      $('#wMeta').textContent = 'Blok ' + (bi + 1) + '/' + blockTitles.length + ' · ' + Math.round(i / st.length * 100) + ' %';
    }

    function enter(n) {
      i = n;
      if (i >= st.length) return finish();
      var s = st[i], e = ex(s.id), it = s.item;
      phase = 'work'; elapsed = 0; pacerHit = false;
      el.classList.remove('resting');
      showAnim(s.id, s.easy ? 0.7 : 1);
      pacerBase = pl.time;
      $('#wBlock').textContent = s.block + (s.tag ? ' · ' + s.tag : '');
      $('#wDots').innerHTML = s.sets > 1 ? Array.apply(null, Array(s.sets)).map(function (_, k) { return '<i' + (k < s.set - 1 ? ' class="done"' : k === s.set - 1 ? ' class="cur"' : '') + '></i>'; }).join('') : '';
      $('#wName').textContent = e.name;
      $('#wMus').innerHTML = musChips(e.anim.muscles);
      var pp = photo(s.id), pip = $('#wPip');
      pip.hidden = !pp; if (pp) pip.querySelector('img').src = pp;
      $('#wMinus').hidden = $('#wPlus').hidden = true;
      $('#wSkip').hidden = false;
      el.classList.toggle('hard', !!s.hard);
      el.classList.toggle('easy', !!s.easy);

      if (s.kind === 'reps') {
        var sug = it.sug;
        var prev = logged.filter(function (l) { return l.id === s.id; }).pop();
        cur.reps = prev ? prev.reps : (race ? it.reps[1] : sug.reps);
        cur.load = prev ? prev.load : sug.load;
        var target = it.reps[0] === it.reps[1] ? it.reps[0] : it.reps[0] + '–' + it.reps[1];
        $('#wWhy').textContent = race ? 'Na čas – ' + target + ' ponovitev' + (s.perSide ? ' na stran' : '') : (sug.why || 'Cilj ' + target + ' ponovitev, RIR ' + sess.weekInfo.rir);
        $('#wRx').innerHTML = chips([[target + (s.perSide ? '/str.' : ''), 'cilj'], [loadTxt(e, cur.load), 'breme'], [race ? 'na čas' : 'RIR ' + sess.weekInfo.rir, race ? 'način' : 'napor'], [e.tempo || '—', 'tempo']]);
        var lg = stepper('reps', cur.reps, 1, 'ponovitev');
        if (e.unit === 'kg') lg += stepper('load', cur.load, e.id.indexOf('kb_') === 0 ? 4 : (e.inc || 2), 'kg');
        if (e.unit === 'stopnja') lg += stepper('load', cur.load, 1, 'stopnja');
        $('#wLog').innerHTML = lg; $('#wLog').hidden = false;
        $('#wDone').textContent = race ? '✓ Postaja končana' : '✓ Serija opravljena';
        Voice.say(e.name + '. ' + (s.set === 1 ? e.cues[0] : 'Serija ' + s.set));
      } else if (s.kind === 'dist') {
        $('#wWhy').textContent = 'Cilj ' + s.dist + ' m – ko monitor pokaže razdaljo, pritisni OK';
        $('#wRx').innerHTML = chips([[s.dist + ' m', 'razdalja'], ['~' + fmt(s.dist * (e.secPerM || 0.27)), 'ciljni čas'], [e.tempo || '—', 'tempo']]);
        $('#wLog').innerHTML = ''; $('#wLog').hidden = true;
        $('#wDone').textContent = '✓ ' + s.dist + ' m končano';
        Voice.say(e.name + '. ' + s.dist + ' metrov.');
      } else {
        remain = s.sec;
        $('#wWhy').textContent = race && /^Postaja/.test(s.block) ? 'Postaja na čas – ' + fmt(s.sec) : s.sec >= 60 && !s.hard && !s.easy ? fmt(s.sec) + ' min' : (s.label || '');
        var rx = [[fmt(s.sec), s.hard ? 'močno' : s.easy ? 'lahkotno' : 'trajanje']];
        if (s.sets > 1) rx.push([s.set + '/' + s.sets, s.hard || s.easy ? 'interval' : 'serija']);
        if (e.unit === 'stopnja' || e.unit === 'kg') rx.push([loadTxt(e, it.sug ? it.sug.load : (state.ex[s.id] || {}).load || e.load), 'breme']);
        rx.push([e.tempo || '—', 'tempo']);
        $('#wRx').innerHTML = chips(rx);
        $('#wLog').innerHTML = ''; $('#wLog').hidden = true;
        $('#wDone').textContent = race ? '✓ Postaja končana' : '⏭ Naprej';
        if (s.hard) { Audio.beep(1200, 0.35); Voice.say('Močno!'); }
        else if (s.easy) { Audio.beep(600, 0.3); Voice.say('Lahkotno.'); }
        else Voice.say(e.name + '. ' + e.cues[0]);
      }
      bindSteppers();
      renderNext();
      progressUI();
      draw();
      if (!el.contains(document.activeElement) || document.activeElement.hidden) $('#wDone').focus();
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
      splits.push({ name: s.block.replace(/^Postaja \d+ · /, ''), id: s.id, sec: elapsed || (s.sec - Math.max(0, remain)) || 0, station: /^Postaja|^Tek/.test(s.block) });
      if (race) renderSplits();
      if (s.rest > 0 && i < st.length - 1) startRest(s.rest);
      else enter(i + 1);
    }

    function startRest(sec) {
      phase = 'rest'; remain = sec; restTotal = sec;
      el.classList.add('resting');
      var nx = st[i + 1], ne = ex(nx.id);
      showAnim(nx.id);
      $('#wName').textContent = 'Počitek';
      $('#wMus').innerHTML = musChips(ne.anim.muscles);
      var np = photo(nx.id); $('#wPip').hidden = !np; if (np) $('#wPip img').src = np;
      $('#wWhy').textContent = 'Pripravi se: ' + ne.name + (nx.kind === 'reps' ? ' · serija ' + nx.set + '/' + nx.sets : '');
      $('#wLog').hidden = true;
      $('#wRx').innerHTML = chips([[fmt(sec), 'počitek'], [ne.name.split(' (')[0], 'naslednje']]);
      $('#wDone').textContent = '⏭ Preskoči počitek';
      $('#wMinus').hidden = $('#wPlus').hidden = false;
      $('#wSkip').hidden = true;
      $('#wNextLbl').textContent = 'Med počitkom: tehnika naslednje vaje';
      Voice.say('Počitek ' + sec + ' sekund. Naslednje: ' + ne.name);
      draw();
    }

    function renderSplits() {
      var w = $('#wSplits'); if (!w) return;
      var rows = splits.filter(function (x) { return x.station; }).slice(-5);
      w.innerHTML = '<div class="label">Vmesni časi</div>' + rows.map(function (r) { return '<div class="split"><span>' + esc(r.name) + '</span><b>' + fmt(r.sec) + '</b></div>'; }).join('');
    }

    // single place that paints the ring + clocks
    function draw() {
      $('#wClock').textContent = fmt(total);
      var s = st[i]; if (!s) return;
      var top = $('#wRingTop'), val = $('#wRingVal'), sub = $('#wRingSub');
      if (phase === 'rest') {
        top.textContent = 'POČITEK'; val.textContent = fmt(remain); sub.textContent = 'od ' + fmt(restTotal);
        setRing('wRing', remain / restTotal);
        return;
      }
      if (s.kind === 'reps') {
        var tgt = s.item.reps[1], pr = Math.min(pacerReps(), tgt);
        top.textContent = 'TEMPO ŠTEVEC'; val.textContent = pr; sub.textContent = '/ ' + tgt + ' · ' + fmt(elapsed);
        setRing('wRing', pr / tgt);
        if (pr >= tgt && !pacerHit) { pacerHit = true; Audio.beep(1320, 0.2); $('#wPhase').textContent = 'Cilj dosežen – OK za konec'; }
      } else if (s.kind === 'dist') {
        var est = s.dist * (ex(s.id).secPerM || 0.27);
        top.textContent = s.dist + ' m'; val.textContent = fmt(elapsed); sub.textContent = 'cilj ~' + fmt(est);
        setRing('wRing', elapsed / est);
      } else {
        top.textContent = s.hard ? 'MOČNO' : s.easy ? 'LAHKOTNO' : race ? 'POSTAJA' : 'ČAS';
        val.textContent = fmt(remain);
        var e = ex(s.id);
        sub.textContent = e.type === 'cardio' && !/^(bike|row|hx_)/.test(s.id) ? '≈ ' + pacerReps() + ' ponovitev' : 'od ' + fmt(s.sec);
        setRing('wRing', remain / s.sec);
      }
    }

    function tick() {
      if (paused || !st[i]) return;
      total += 0.25;
      if (phase === 'rest') {
        remain -= 0.25;
        if (remain <= 3.01 && remain > 0 && Math.abs(remain - Math.round(remain)) < 0.01) Audio.beep(880, 0.12);
        if (remain <= 0) { Audio.beep(1320, 0.3); enter(i + 1); return; }
      } else {
        elapsed += 0.25;
        var s = st[i];
        if (s.kind === 'time') {
          remain -= 0.25;
          if (remain <= 3.01 && remain > 0 && Math.abs(remain - Math.round(remain)) < 0.01) Audio.beep(880, 0.12);
          if (s.sec >= 60 && Math.abs(remain - s.sec / 2) < 0.01) Voice.say('Polovica.');
          if (remain <= 0) { Audio.beep(1320, 0.3); completeWork(); return; }
        }
      }
      draw();
    }
    var iv = setInterval(tick, 250);

    function finish() {
      clearInterval(iv);
      var min = Math.max(1, Math.round(total / 60));
      if (logged.length || min >= 10) {
        Store.recordSession(state, { date: new Date().toISOString(), session: sess.key, name: sess.name, min: min, sec: Math.round(total), splits: race ? splits : undefined, sets: logged, items: itemsById });
      }
      Voice.say('Odlično. Trening je končan.');
      pl.stop(); nextPl.stop();
      var vol = logged.reduce(function (a, l) { return a + (ex(l.id).unit === 'kg' ? l.reps * l.load : 0); }, 0);
      var reps = logged.reduce(function (a, l) { return a + l.reps; }, 0);
      var f = $('#wFinish');
      f.hidden = false;
      f.innerHTML = '<div class="fin-card"><div class="kicker">' + (race ? 'HYROX ČAS' : 'TRENING KONČAN') + '</div><div class="fin-time">' + fmt(total) + '</div>' +
        '<div class="fin-stats"><div><b>' + logged.length + '</b><span>serij</span></div><div><b>' + reps + '</b><span>ponovitev</span></div><div><b>' + Math.round(vol) + ' kg</b><span>volumen</span></div></div>' +
        (race ? '<div class="splits fin-splits">' + splits.filter(function (x) { return x.station; }).map(function (r) { return '<div class="split"><span>' + esc(r.name) + '</span><b>' + fmt(r.sec) + '</b></div>'; }).join('') + '</div>' : '') +
        '<button class="btn primary focusable" id="wHome">Domov</button></div>';
      $('.side', el).hidden = true;
      el.classList.add('done');
      $('#wHome').onclick = function () { resetTo('home'); };
      $('#wHome').focus();
      activeSession.confirmExit = null;
      i = st.length;
    }

    $('#wDone').onclick = function () {
      if (phase === 'rest') { enter(i + 1); return; }
      completeWork();
    };
    $('#wSkip').onclick = function () { enter(i + 1); };
    $('#wMinus').onclick = function () { remain = Math.max(1, remain - 15); restTotal = Math.max(restTotal - 15, remain); draw(); };
    $('#wPlus').onclick = function () { remain += 15; restTotal += 15; draw(); };
    $('#wPause').onclick = function () {
      paused = !paused; this.textContent = paused ? 'Nadaljuj' : 'Pavza';
      el.classList.toggle('paused', paused);
      if (paused) pl.stop(); else pl.start();
    };
    $('#wExit').onclick = function () { ask('Končam trening in shranim opravljene serije?', 'Končaj', finish); };

    activeSession = {
      onKey: function (code) {
        if (isKey(code, 'PLAY')) { $('#wPause').click(); return true; }
        return false;
      },
      confirmExit: function (leave) { ask('Zapustim trening? Neshranjene serije se izgubijo.', 'Zapusti', leave); },
      destroy: function () { clearInterval(iv); el.remove(); if ('speechSynthesis' in window) speechSynthesis.cancel(); }
    };
    enter(0);
  };

  // ---------------------------------------------------------------- profiles ("Kdo trenira?")
  SCREENS.profiles = function () {
    var list = Store.list();
    var lastId = (Store.active() || {}).id;
    root.innerHTML = '<div class="screen center">' + brandMark('big-brand') + '<h1 class="who-title">Kdo trenira?</h1><div class="profiles">' +
      list.map(function (pr, i) {
        return '<button class="profile focusable" data-pid="' + pr.id + '"' + (pr.id === lastId || (!lastId && i === 0) ? ' data-autofocus' : '') + '>' + avatar(pr, true) +
          '<b>' + esc(pr.name) + '</b><span>' + (pr.pin ? '🔒 ' : '') + pl(pr.log.length, TRN) + '</span></button>';
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
    root.innerHTML = '<div class="screen center">' + avatar(pr, true) + '<h1>' + esc(pr.name) + '</h1><div class="hint">Vnesi PIN</div><div class="dots" id="dots"></div>' + keypad() +
      (p.quick ? '<button class="btn ghost sm focusable" data-go="profiles">Nisi ' + esc(pr.name) + '? Izberi osebo</button>' : '') + '</div>';
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
        pin: null, clearPin: false, more: !!existing,
        equipment: (existing ? existing.settings.equipment : (state ? state.settings.equipment : null) || Exercises.HOME_GYM).slice()
      };
    }
    var d = pdraft;
    function chip(key, val, label) {
      return '<button class="chip focusable' + (d[key] === val ? ' on' : '') + '" data-fid="pe-' + key + '-' + val + '" data-pe="' + key + '" data-val=\'' + JSON.stringify(val) + '\'>' + label + '</button>';
    }
    root.innerHTML = '<div class="screen"><div class="topbar"><h1>' + (existing ? 'Uredi profil' : Store.list().length ? 'Nova oseba' : 'Dobrodošli – kdo bo treniral?') + '</h1></div>' +
      (Store.list().length || existing ? '' : '<div class="hint">Vsak član gospodinjstva ima svoj profil: program, teže, napredek. Več oseb dodaš kasneje v Nastavitvah ali ob zagonu.</div>') +
      '<div class="panel">' +
      '<div class="opt-row"><div class="k">Ime</div><input class="field focusable" id="pName" data-fid="pe-name" maxlength="20" placeholder="npr. Bojan" value="' + esc(d.name) + '"' + (existing ? '' : ' data-autofocus') + '></div>' +
      '<div class="opt-row"><div class="k">Barva</div>' + Store.COLORS.map(function (c) {
        return '<button class="swatch focusable' + (d.color === c ? ' on' : '') + '" data-fid="pe-color-' + c + '" data-pe="color" data-val=\'"' + c + '"\' style="background:' + c + '"></button>';
      }).join('') + '</div>' +
      '<div class="opt-row"><div class="k">Nivo</div>' + chip('level', 'beg', 'Začetnik') + chip('level', 'mid', 'Srednji') + chip('level', 'adv', 'Napreden') + '</div>' +
      (d.more ? '' : '<div class="opt-row"><button class="btn sm ghost focusable" id="pMore" data-fid="pe-more">Več možnosti (treningi/teden, oprema, PIN) ▾</button></div>') +
      (d.more ? '<div class="opt-row"><div class="k">Treningov na teden</div>' + chip('days', 3, '3× – celo telo') + chip('days', 4, '4× – upper / lower') + '</div>' +
      '<div class="opt-row"><div class="k">Oprema</div><div class="eq-strip">' + d.equipment.slice(0, 9).map(function (k) { return '<span class="eq-mini" title="' + esc(Exercises.EQUIP[k].name) + '">' + equipIcon(k) + '</span>'; }).join('') +
      '</div><button class="btn sm focusable" id="pEquip" data-fid="pe-equip">' + pl(d.equipment.length, NAP) + ' · uredi →</button></div>' +
      '<div class="opt-row"><div class="k">PIN (neobvezno)</div><input class="field focusable" id="pPin" data-fid="pe-pin" type="password" inputmode="numeric" maxlength="4" placeholder="4 števke" value="' + esc(d.pin || '') + '">' +
      (existing && existing.pin ? '<button class="chip focusable' + (d.clearPin ? ' on' : '') + '" data-fid="pe-clear" id="pClear">Odstrani PIN</button>' : '') +
      '<span class="hint">Zaklene profil na skupnem TV-ju (zasebnost, ne varnost).</span></div>' : '') +
      '</div><div class="nav-row"><button class="btn primary focusable" id="pSave">' + (existing ? 'Shrani' : 'Ustvari profil') + '</button>' +
      (Store.list().length ? '<button class="btn ghost focusable" id="pCancel">Prekliči</button>' : '') +
      (existing && Store.list().length > 1 ? '<button class="btn ghost focusable danger" id="pDel">Izbriši osebo</button>' : '') + '</div></div>';
    function readInputs() { d.name = $('#pName').value.trim(); if ($('#pPin')) d.pin = $('#pPin').value.trim() || null; }
    if ($('#pMore')) $('#pMore').onclick = function () { readInputs(); d.more = true; refresh(); var f = $('[data-fid="pe-days-3"]'); if (f) f.focus(); };
    $$('[data-pe]').forEach(function (b) {
      b.onclick = function () { readInputs(); d[b.getAttribute('data-pe')] = JSON.parse(b.getAttribute('data-val')); refresh(); };
    });
    if ($('#pClear')) $('#pClear').onclick = function () { readInputs(); d.clearPin = !d.clearPin; refresh(); };
    if ($('#pEquip')) $('#pEquip').onclick = function () { readInputs(); eqDraft = null; go('equipment', { draft: true }); };
    $('#pSave').onclick = function () {
      readInputs();
      if (!d.name) { toast('Vpiši ime'); $('#pName').focus(); return; }
      if (d.pin && !/^\d{4}$/.test(d.pin)) { toast('PIN mora imeti 4 števke'); $('#pPin').focus(); return; }
      var pr = existing || Store.addProfile(Store.newProfile());
      pr.name = d.name; pr.color = d.color; pr.settings.level = d.level; pr.settings.days = d.days;
      pr.settings.equipment = d.equipment.slice();
      if (d.pin) Store.setPin(pr, d.pin); else if (d.clearPin) Store.setPin(pr, null);
      Store.save();
      pdraft = null;
      if (existing && state && existing.id === state.id) { toast('Shranjeno'); back(); }
      else if (!existing) { eqDraft = null; activate(pr); }
      else activate(pr);
    };
    if ($('#pCancel')) $('#pCancel').onclick = function () { pdraft = null; back(); };
    if ($('#pDel')) $('#pDel').onclick = function () {
      ask('Izbrišem profil ' + existing.name + ' in vso njegovo zgodovino?', 'Izbriši', function () {
        Store.removeProfile(existing.id);
        pdraft = null; state = null;
        resetTo('profiles');
      });
    };
  };

  // ---------------------------------------------------------------- equipment ("Moja oprema")
  function equipIcon(k) { return Figure.icon(Exercises.EQUIP[k].icon); }
  function exCountFor(k) { return Exercises.LIST.filter(function (e) { return e.equip.indexOf(k) >= 0; }).length; }
  function unlocked(list) { return Exercises.LIST.filter(function (e) { return Exercises.available(e.id, list); }).length; }
  var EQ_PRESETS = [
    { id: 'home', name: 'Domača telovadnica', list: function () { return Exercises.HOME_GYM.slice(); } },
    { id: 'bw', name: 'Samo lastna teža', list: function () { return []; } },
    { id: 'all', name: 'Polno opremljen fitnes', list: function () { return Object.keys(Exercises.EQUIP).filter(function (k) { return !Exercises.EQUIP[k].always; }); } }
  ];

  var eqDraft = null;
  SCREENS.equipment = function (p) {
    var target = p.draft && pdraft ? pdraft : state.settings;
    if (!eqDraft || eqDraft.key !== (p.draft ? 'draft' : state.id)) {
      eqDraft = { key: p.draft ? 'draft' : state.id, list: (target.equipment || Exercises.HOME_GYM).slice() };
    }
    var list = eqDraft.list;
    var total = Exercises.LIST.length, un = unlocked(list);
    var who = p.draft ? (pdraft.name || 'Nova oseba') : state.name;
    var html = '<div class="screen eq-screen"><div class="eq-head"><div><div class="kicker">' + (p.onboard ? 'Korak 2 / 2 · ' : '') + 'Profil · ' + esc(who) + '</div>' +
      '<h1>Moja oprema</h1><p>Izberi vse, kar imaš na voljo – doma ali v svoji telovadnici. Program, HYROX in sestavljalnik vzamejo samo to, kar izbereš, in manjkajoče vaje zamenjajo z enakovrednimi.</p></div>' +
      '<div class="eq-score"><div class="eq-num"><b>' + list.length + '</b><span>' + pl(list.length, NAP).replace(/^\d+ /, '') + '</span></div><div class="eq-num"><b>' + un + '<small>/' + total + '</small></b><span>vaj odklenjenih</span></div>' +
      '<div class="eq-bar"><i style="width:' + Math.round(un / total * 100) + '%"></i></div></div></div>' +
      '<div class="filters"><span class="flabel">Hitra izbira</span>' + EQ_PRESETS.map(function (pr) {
        return '<button class="chip focusable" data-fid="eqp-' + pr.id + '" data-preset="' + pr.id + '">' + esc(pr.name) + '</button>';
      }).join('') + '</div>';
    Exercises.EQUIP_GROUPS.forEach(function (g) {
      var keys = Object.keys(Exercises.EQUIP).filter(function (k) { return Exercises.EQUIP[k].group === g.id; });
      var n = keys.filter(function (k) { return list.indexOf(k) >= 0; }).length;
      html += '<div class="eq-group"><h3>' + esc(g.name) + ' <span>' + n + '/' + keys.length + '</span></h3><div class="eq-grid">' + keys.map(function (k) {
        var E = Exercises.EQUIP[k], on = list.indexOf(k) >= 0;
        return '<button class="eq-tile focusable' + (on ? ' on' : '') + '" data-fid="eq-' + k + '" data-eq="' + k + '" aria-pressed="' + on + '">' +
          '<span class="eq-check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>' +
          '<div class="eq-art">' + equipIcon(k) + '</div><div class="eq-info"><b>' + esc(E.name) + '</b><span>' + esc(E.desc) + '</span></div>' +
          '<div class="eq-meta">' + pl(exCountFor(k), VAJ) + '</div></button>';
      }).join('') + '</div></div>';
    });
    html += '<div class="eq-foot"><div class="hint">Lastna teža je vedno vključena (' + pl(exCountFor('floor'), VAJ) + ').</div><div class="spacer"></div>' +
      (p.onboard ? '' : '<button class="btn ghost focusable" id="eqCancel">Prekliči</button>') +
      '<button class="btn primary focusable" id="eqSave" data-fid="eq-save">' + (p.onboard ? 'Začni trenirati →' : 'Shrani opremo') + '</button></div></div>';
    root.innerHTML = html;
    $$('[data-eq]').forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute('data-eq'), i = list.indexOf(k);
        if (i >= 0) list.splice(i, 1); else list.push(k);
        refresh();
      };
    });
    $$('[data-preset]').forEach(function (b) {
      b.onclick = function () {
        var pr = EQ_PRESETS.filter(function (x) { return x.id === b.getAttribute('data-preset'); })[0];
        eqDraft.list = pr.list();
        refresh();
      };
    });
    if ($('#eqCancel')) $('#eqCancel').onclick = function () { eqDraft = null; back(); };
    $('#eqSave').onclick = function () {
      target.equipment = list.slice();
      eqDraft = null;
      if (!p.draft) { Store.save(); toast('Oprema shranjena · ' + pl(unlocked(list), VAJ) + ' na voljo'); }
      if (p.onboard) resetTo('home'); else back();
    };
  };

  // ---------------------------------------------------------------- session builder
  var bdraft = null;
  var ALL_FOCUS = ['noge', 'zadnjica', 'prsa', 'hrbet', 'rame', 'roke', 'trup'];
  SCREENS.builder = function () {
    if (!bdraft) bdraft = { opts: { type: 'moc', focus: ['noge', 'zadnjica'], min: 45, machine: 'both', intensity: 'mix' }, src: null, swap: {} };
    var o = bdraft.opts;
    o.level = state.settings.level; o.owned = Program.owned(state);
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
      '<div class="opt-row"><div class="k">Vrsta</div>' + chip('type', 'moc', 'Moč', o.type === 'moc') + chip('type', 'kardio', 'Kardio', o.type === 'kardio') + chip('type', 'mix', 'Moč + kardio', o.type === 'mix') + chip('type', 'hyrox', 'HYROX', o.type === 'hyrox') + '</div>';
    if (o.type === 'hyrox') {
      html += '<div class="opt-row"><div class="k">Format</div>' + chip('format', 'full', 'Celotna simulacija (8 postaj)', o.format === 'full') +
        chip('format', 'half', 'Polovica (4 postaje)', (o.format || 'half') === 'half') + chip('format', 'stations', 'Trening postaj', o.format === 'stations') + '</div>' +
        '<div class="hint">Nadomestki: tek → kolo · SkiErg → Kinesis poteg · sled push → kolo stoje (težak upor) · sled pull → Kinesis roka-čez-roko · wall balls → DB thruster · sandbag → KB izpadni koraki. Količina se prilagodi nivoju.</div>';
    } else if (o.type !== 'kardio') {
      var all = ALL_FOCUS.every(function (f) { return o.focus.indexOf(f) >= 0; });
      html += '<div class="opt-row"><div class="k">Fokus <span class="hint">(več izbir)</span></div>' + chip('focus', 'all', 'Celo telo', all) +
        ALL_FOCUS.map(function (f) { return chip('focus', f, Exercises.FOCUS[f].name, !all && o.focus.indexOf(f) >= 0); }).join('') + '</div>';
    } else {
      var mach = Program.cardioMachines(o.owned);
      html += '<div class="opt-row"><div class="k">Naprava</div>' + (mach.length > 1 ? chip('machine', 'all', 'Kombinirano', !o.machine || o.machine === 'all' || o.machine === 'both') : '') +
        mach.map(function (k) { return chip('machine', k, '<span class="chip-ico">' + (k === 'floor' ? equipIcon('floor') : equipIcon(k)) + '</span>' + Program.MACHINES[k].name, o.machine === k); }).join('') + '</div>' +
        '<div class="opt-row"><div class="k">Intenzivnost</div>' + chip('intensity', 'z2', 'Lahkotno – cona 2', o.intensity === 'z2') + chip('intensity', 'hiit', 'Intervali', o.intensity === 'hiit') + chip('intensity', 'mix', 'Mešano', o.intensity === 'mix') + '</div>';
    }
    if (o.type !== 'hyrox') html += '<div class="opt-row"><div class="k">Trajanje</div>' + [20, 30, 45, 60].map(function (m) { return chip('min', m, m + ' min', o.min === m); }).join('') + '</div>';
    html += '</div><div class="blocks">';
    var row = 0;
    built.blocks.forEach(function (b, bi) {
      html += '<div class="block"><h3>' + esc(b.title) + '</h3>';
      b.items.forEach(function (it, ii) {
        var e = ex(it.id), r = row++;
        var gl = Program.groupLetter(b.title, bi), tag = b.items.length > 1 && gl ? '<span class="lbl">' + gl + (ii + 1) + '</span>' : '';
        var sid = it.swappedFrom || it.id;
        var canSwap = e.type !== 'mobility' && Program.alternatives(src, sid, o.owned).length;
        html += '<div class="ex-row b-row"><div class="ex-thumb" data-thumb="' + it.id + '"></div><div><h4>' + tag + esc(e.name) + '</h4><div class="sub">' + esc(e.muscles) + '</div></div>' +
          '<div class="rx">' + rx(it) + (it.sug ? '<small>' + esc(loadTxt(e, it.sug.load)) + '</small>' : '') + '</div>' +
          '<div class="row-actions">' + (canSwap ? '<button class="btn sm focusable" data-fid="sw-' + r + '" data-swap="' + sid + '">⇄ Zamenjaj</button>' : '') +
          '<button class="btn sm ghost focusable" data-fid="rm-' + r + '" data-rm="' + sid + '">✕</button></div></div>';
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
        var id = b.getAttribute('data-swap'), alts = Program.alternatives(src, id, o.owned);
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
    // Fast login: this device remembers who trained last – straight in (or straight to their PIN)
    var list = Store.list(), last = Store.active();
    if (!list.length) go('profileEdit', {});
    else if (last && !last.pin) { state = last; go('home'); }
    else if (last) go('pin', { id: last.id, quick: true });
    else if (list.length === 1 && !list[0].pin) { state = Store.setActive(list[0].id); go('home'); }
    else go('profiles');
  })();
})();
