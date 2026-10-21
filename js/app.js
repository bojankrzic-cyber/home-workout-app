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
  // phones/tablets: tap-driven, so focus must never scroll the page (focus rings are for the TV remote)
  var TOUCH = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
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
      '<button class="btn ghost focusable" data-a="no">Cancel</button><button class="btn primary focusable" data-a="yes">' + esc(yes) + '</button></div></div>';
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
  // short weekday names in the chosen language (Sun..Sat); 1 Jan 2023 was a Sunday
  var DAYN = [0, 1, 2, 3, 4, 5, 6].map(function (i) {
    try { var n = new Date(2023, 0, 1 + i).toLocaleDateString((window.I18N && I18N.locale) || 'en-GB', { weekday: 'short' }).replace(/\.$/, ''); return n.charAt(0).toUpperCase() + n.slice(1); }
    catch (e) { return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]; }
  });
  // English plural forms: [singular, plural]
  function pl(n, f) { return n + ' ' + (Math.abs(n) === 1 ? f[0] : f[1]); }
  var VAJ = ['exercise', 'exercises'], TRN = ['workout', 'workouts'], NAP = ['item', 'items'];

  // ---------------------------------------------------------------- audio / voice
  var Audio = {
    ctx: null,
    beep: function (freq, dur) {
      if (!state || !state.settings.beeps) return;
      try {
        this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
        if (this.ctx.state === 'suspended') this.ctx.resume();
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
    // English voices ranked by how human they sound. iOS lists robotic "Eloquence" and novelty
    // voices first, so the first en-GB match is often the worst one; premium/enhanced/neural win.
    list: function () {
      if (!('speechSynthesis' in window)) return [];
      // the coach always speaks English, whatever the app language: device voices in other languages sound
      // too distorted for coaching (the texts on screen are translated)
      return speechSynthesis.getVoices().filter(function (v) { return /^en/i.test(v.lang); })
        .map(function (v) { return { v: v, score: Voice.score(v) }; })
        .sort(function (a, b) { return b.score - a.score; });
    },
    score: function (v) {
      var n = v.name, sc = 0;
      if (/premium/i.test(n)) sc += 60;
      if (/enhanced/i.test(n)) sc += 45;
      if (/neural|natural|online/i.test(n)) sc += 55;
      if (/^Google/i.test(n)) sc += 35;
      if (/\b(Daniel|Serena|Kate|Martha|Arthur|Oliver|Stephanie|Jamie|Ava|Zoe|Evan|Nathan|Samantha|Allison|Susan|Tom|Karen|Moira|Tessa|Libby|Ryan|Sonia|Aria|Jenny|Guy)\b/.test(n)) sc += 20;
      if (/\b(Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley|Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Fred|Good News|Jester|Junior|Kathy|Organ|Ralph|Superstar|Trinoids|Whisper|Wobble|Zarvox)\b/.test(n)) sc -= 100;
      if (/^en-GB/i.test(String(v.lang).replace('_', '-'))) sc += 4; else if (/^en-US/i.test(String(v.lang).replace('_', '-'))) sc += 3;
      if (v.localService === false) sc += 5;
      return sc;
    },
    pick: function () {
      var all = Voice.list(), want = state && state.settings.voiceName;
      var chosen = want && all.filter(function (x) { return x.v.name === want; })[0];
      Voice.v = chosen ? chosen.v : all[0] ? all[0].v : null;
    },
    init: function () {
      if (!('speechSynthesis' in window)) return;
      Voice.pick();
      if (speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', Voice.pick);
      else speechSynthesis.onvoiceschanged = Voice.pick;
    },
    // iOS often reports no voices until later; speak anyway with lang=en-GB and let the system choose
    say: function (text) {
      if (!state || !state.settings.voice || !('speechSynthesis' in window)) return;
      try {
        this.pick();
        var u = new SpeechSynthesisUtterance(Voice.clean(text));
        if (this.v) u.voice = this.v;
        u.lang = (this.v && this.v.lang) || 'en-GB'; u.rate = 0.98; u.pitch = 1;
        var busy = speechSynthesis.speaking || speechSynthesis.pending;
        if (busy) speechSynthesis.cancel();
        // Safari drops an utterance queued in the same tick as cancel()
        if (busy) setTimeout(function () { speechSynthesis.speak(u); }, 80); else speechSynthesis.speak(u);
        if (speechSynthesis.paused) speechSynthesis.resume();
      } catch (e) { /* ignore */ }
    }
  };
  // Recorded coach (ElevenLabs takes in audio/voice/, listed in js/voiceclips.js). Phrases are built
  // from clip keys; missing keys are skipped, and if nothing is recorded the device voice reads `text`.
  var Coach = {
    el: null, queue: [],
    has: function (k) { return (window.VOICE_CLIPS || []).indexOf(k) >= 0; },
    on: function () { return state && state.settings.voice && state.settings.coachVoice !== 'device' && (window.VOICE_CLIPS || []).length > 0; },
    element: function () {
      if (!this.el) {
        this.el = document.createElement('audio'); this.el.setAttribute('playsinline', ''); this.el.preload = 'auto';
        this.el.addEventListener('ended', function () { Coach.next(); });
        this.el.addEventListener('error', function () { Coach.next(); });
      }
      return this.el;
    },
    next: function () {
      var k = this.queue.shift(); if (!k) return;
      var el = this.element(); el.src = 'audio/voice/' + k + '.mp3';
      var pr = el.play(); if (pr && pr.catch) pr.catch(function () { Coach.queue = []; });
    },
    play: function (keys) {
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      this.queue = keys.slice(); this.next();
    }
  };
  // say(text, keys): recorded clips when available, device voice otherwise
  Voice.cue = function (text, keys) {
    if (!state || !state.settings.voice) return;
    var have = (keys || []).filter(function (k) { return Coach.has(k); });
    if (Coach.on() && have.length && Coach.has(keys[0])) Coach.play(have);
    else Voice.say(text);
  };

  // read like a coach, not a label: no dashes, symbols or abbreviations spelled out letter by letter
  Voice.clean = function (t) {
    return String(t)
      .replace(/\bKB\b/g, 'kettlebell').replace(/\bDB\b/g, 'dumbbell').replace(/\bRPM\b/g, 'R P M')
      .replace(/\bRPE\b/g, 'effort').replace(/\bRIR\b/g, 'reps in reserve').replace(/\bZ(\d)\b/g, 'zone $1')
      .replace(/(\d+)\s*×/g, '$1 times').replace(/\/side\b/g, ' per side').replace(/(\d+)\s*s\b/g, '$1 seconds')
      .replace(/(\d+)\s*m\b/g, '$1 meters').replace(/(\d)\s*[–-]\s*(\d)/g, '$1 to $2').replace(/\s*[–—]\s*/g, ', ').replace(/[()]/g, '').replace(/\s*\/\s*/g, ', ')
      .replace(/\s+/g, ' ').trim();
  };
  Voice.init();

  // iPhone/iPad: sound only starts after a tap, and the ring/silent switch mutes web audio.
  // On the first tap we unlock speech + Web Audio, and during workouts a silent looping
  // <audio> keeps the audio session in "playback" mode so beeps and voice play even in silent mode.
  var Sound = {
    unlocked: false, el: null,
    silent: function () {
      var n = 8000, b = new ArrayBuffer(44 + n), d = new DataView(b), w = function (o, t) { for (var i = 0; i < t.length; i++) d.setUint8(o + i, t.charCodeAt(i)); };
      w(0, 'RIFF'); d.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true);
      d.setUint32(24, 8000, true); d.setUint32(28, 8000, true); d.setUint16(32, 1, true); d.setUint16(34, 8, true); w(36, 'data'); d.setUint32(40, n, true);
      for (var i = 0; i < n; i++) d.setUint8(44 + i, 128);
      return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
    },
    session: function (on) {
      try {
        if (!this.el) { this.el = document.createElement('audio'); this.el.src = this.silent(); this.el.loop = true; this.el.setAttribute('playsinline', ''); }
        if (on) { var pr = this.el.play(); if (pr && pr.catch) pr.catch(function () {}); } else this.el.pause();
      } catch (e) { /* no media element */ }
    },
    unlock: function () {
      if (Sound.unlocked) return;
      Sound.unlocked = true;
      try {
        Audio.ctx = Audio.ctx || new (window.AudioContext || window.webkitAudioContext)();
        if (Audio.ctx.state === 'suspended') Audio.ctx.resume();
      } catch (e) { /* no web audio */ }
      try { if ('speechSynthesis' in window) { var u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } } catch (e) { /* ignore */ }
      try { var el = Coach.element(); el.src = Sound.silent(); var pr = el.play(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) { /* ignore */ }
    }
  };
  document.addEventListener('pointerdown', Sound.unlock, true);
  document.addEventListener('keydown', Sound.unlock, true);

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

  function scrollY() { var sc = $('.screen', root); return sc ? sc.scrollTop : 0; }
  function setScrollY(y) { var sc = $('.screen', root); if (sc && y) sc.scrollTop = y; }
  function go(screen, params, replace, fid) {
    if (!replace && stack.length) { stack[stack.length - 1].focusIdx = focusables().indexOf(document.activeElement); stack[stack.length - 1].y = scrollY(); }
    if (replace) stack.pop();
    stack.push({ screen: screen, params: params || {} });
    if (!replace && stack.length > 1) { try { history.pushState({ fs: stack.length }, ''); } catch (e) {} }
    render(false, fid);
  }
  // re-render the current screen, keeping focus on the element with the same data-fid
  function refresh(params) {
    var a = document.activeElement;
    var fid = a && a.getAttribute && a.getAttribute('data-fid');
    var top = stack[stack.length - 1], y = scrollY();
    go(top.screen, params || top.params, true, fid);
    setScrollY(y);
  }
  function resetTo(screen, params) { stack = []; go(screen, params); }
  // In-app back, browser back and the iOS edge swipe all end up here; history stays in step with the stack
  var skipPop = false;
  function back() {
    if (activeSession && activeSession.confirmExit) { activeSession.confirmExit(histBack); return; }
    histBack();
  }
  function histBack() {
    if (stack.length <= 1) return;
    if (history.state && history.state.fs) { skipPop = true; try { history.back(); } catch (e) { skipPop = false; } }
    popScreen();
  }
  window.addEventListener('popstate', function () {
    if (skipPop) { skipPop = false; return; }
    closeAsk();
    if (stack.length <= 1) return;
    if (activeSession && activeSession.confirmExit) {
      try { history.pushState({ fs: stack.length }, ''); } catch (e) {}
      activeSession.confirmExit(histBack);
      return;
    }
    popScreen();
  });
  function popScreen() {
    if (stack.length <= 1) return;
    stack.pop();
    render(true);
    setScrollY(stack[stack.length - 1].y);
  }

  function render(restoring, fid) {
    teardown();
    var top = stack[stack.length - 1];
    SCREENS[top.screen](top.params);
    addBackButton(top.screen);
    var list = focusables();
    var scope = $('.player') || root;
    var idx = restoring && top.focusIdx >= 0 ? top.focusIdx : 0;
    var auto = (fid && $('[data-fid="' + fid + '"]', scope)) || $('[data-autofocus]', scope);
    var el = restoring ? list[idx] : (auto || list[0]);
    // touch screens: no auto-focus (it scrolls iOS Safari and paints a TV focus ring on a random button)
    if (el && !TOUCH) el.focus({ preventScroll: !!fid || restoring });
  }

  // Every screen except home and the workout player gets the same "← Back" in the same place
  function addBackButton(screen) {
    if (stack.length <= 1 || screen === 'home' || screen === 'player') return;
    var b = document.createElement('button');
    b.className = 'btn sm ghost focusable back-top'; b.setAttribute('data-back', ''); b.setAttribute('data-fid', 'back-top');
    b.innerHTML = '← Back';
    var stage = $('.player .stage');
    if (stage) { b.classList.add('floating'); stage.appendChild(b); return; }
    var scr = $('.screen', root); if (!scr) return;
    var bar = document.createElement('div'); bar.className = 'back-bar'; bar.appendChild(b);
    scr.insertBefore(bar, scr.firstChild);
  }
  document.addEventListener('click', function (e) { if (e.target.closest('[data-back]')) back(); });

  // store a generated / custom session in the profile and open it
  function startCustom(src, screen) {
    var key = 'C_' + Date.now().toString(36);
    state.customs[key] = src;
    Store.save();
    go(screen || 'overview', { key: key });
  }

  // Wordmark: condensed italic caps read as "sport" (scoreboards, kits); the brand line sits underneath
  function brandMark(cls) {
    return '<div class="brand ' + (cls || '') + '" translate="no"><div class="wm"><span class="wm-top">FINEST<em>ME</em></span>' +
      '<span class="wm-by">' + 'by nature\u2019s finest'.split('').map(function (c) { return '<i>' + (c === ' ' ? '&nbsp;' : c) + '</i>'; }).join('') + '</span></div></div>';
  }

  function avatar(p, big) {
    return '<span class="avatar' + (big ? ' big' : '') + '" style="background:' + p.color + '">' + esc((p.name || '?').trim().charAt(0).toUpperCase()) + '</span>';
  }

  // Phase cues change with every keyframe (often < 1 s). Each cue stays up for at least 2.4 s
  // and the newest one waiting is shown next, so it can be read from across the room.
  function cueHolder(el) {
    var shown = null, since = 0, pending = null, t = 0;
    function show(l) {
      shown = l; since = Date.now(); pending = null;
      el.classList.remove('cue-in'); void el.offsetWidth; el.classList.add('cue-in');
      el.textContent = l || ' ';
    }
    return function (l) {
      l = l || '';
      if (l === shown) { pending = null; return; }
      var wait = 2400 - (Date.now() - since);
      if (wait <= 0) { show(l); return; }
      pending = l;
      clearTimeout(t);
      t = setTimeout(function () { if (pending !== null && el.isConnected) show(pending); }, wait);
    };
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

  // Prescription in plain words: "3 sets × 12–15 reps" – parts() feeds both the text and the card layout
  function rxParts(item) {
    var e = ex(item.id), side = (item.perSide || e.perSide) ? 'each side' : '';
    if (item.cardio) return item.cardio.min ? { amt: item.cardio.min, unit: 'min' } : { sets: item.cardio.rounds, setWord: 'rounds', amt: item.cardio.work + ' s hard', unit: '/ ' + item.cardio.easy + ' s easy' };
    if (item.dist) return { amt: item.dist, unit: 'm' };
    if (item.time && item.sets === 1) return item.time >= 60 ? { amt: fmt(item.time), unit: 'min' } : { amt: item.time, unit: 's', side: side };
    if (item.time) return { sets: item.sets, amt: item.time, unit: 's', side: side };
    var r = item.reps[0] === item.reps[1] ? item.reps[0] : item.reps[0] + '–' + item.reps[1];
    return { sets: item.sets, amt: r, unit: 'reps', side: side };
  }
  function rxHtml(item) {
    var x = rxParts(item);
    return '<span class="rx-line">' + (x.sets ? '<span class="rx-n"><b>' + x.sets + '</b>' + (x.setWord || (x.sets === 1 ? 'set' : 'sets')) + '</span><span class="rx-x">×</span>' : '') +
      '<span class="rx-n"><b>' + x.amt + '</b>' + x.unit + '</span></span>' + (x.side ? '<span class="rx-side">' + x.side + '</span>' : '');
  }
  function loadTxt(e, load) {
    if (e.unit === 'kg') return load ? load + ' kg' : 'bodyweight';
    if (e.unit === 'stopnja') return 'level ' + load;
    return 'bodyweight';
  }

  // ---------------------------------------------------------------- photos + muscles
  // exercises that look identical on camera share one photo
  var PHOTO_ALIAS = { hx_bike_run: 'bike_hiit' };
  function photo(id) {
    id = PHOTO_ALIAS[id] && !(window.PHOTOS && PHOTOS.ex.indexOf(id) >= 0) ? PHOTO_ALIAS[id] : id;
    return window.PHOTOS && PHOTOS.ex.indexOf(id) >= 0 ? 'img/ex/' + id + '.jpg' : null;
  }
  function photoBg(url) { return url ? ' style="background-image:linear-gradient(90deg, rgba(var(--scrim),.92) 0%, rgba(var(--scrim),.55) 55%, rgba(var(--scrim),.15) 100%), url(' + url + ')"' : ''; }
  function cardBg(url) { return url ? ' style="background-image:linear-gradient(0deg, rgba(var(--scrim),.95) 8%, rgba(var(--scrim),.35) 70%), url(' + url + ')"' : ''; }
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
      (legend ? '<div class="mus-legend"><span class="mchip p">primary</span><span class="mchip s">secondary</span></div>' : '');
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
    return '<svg viewBox="0 0 210 216" class="mmap">' + mapHalf(MAP_FRONT, mus, 0, 'FRONT') + mapHalf(MAP_BACK, mus, 106, 'BACK') + '</svg>';
  }

  // ---------------------------------------------------------------- motivation ("hype") lines
  // Short, coach-style lines for each moment of a set. Picked without repeating the last one.
  var HYPE = {
    start: ['Let’s go – own this one', 'Smooth reps, strong finish', 'Quality over speed', 'You’ve got this', 'Lock in. Breathe. Move.'],
    firstSet: ['Set the tone', 'First set – find your groove', 'Dial in the form'],
    lastSet: ['Last set – make it count', 'Final set. Leave nothing behind', 'One more set – finish strong'],
    finalExercise: ['Final exercise – finish strong!', 'Last one of the day. Bring it home', 'Almost there – empty the tank'],
    half: ['Halfway – keep the form', 'Halfway there, stay sharp', 'Good pace – keep it'],
    twoLeft: ['Two more – finish strong!', 'Two left – stay tight', 'Push – two more'],
    lastRep: ['Last rep – make it a good one!', 'Last one!', 'Final rep – own it'],
    hit: ['Nailed it! 💪', 'Great set!', 'Strong set!', 'That’s how it’s done!', 'Beautiful reps!', 'Crushed it!'],
    hard: ['All out – go!', 'Push the pace!', 'Drive, drive, drive!'],
    easy: ['Recover – breathe easy', 'Easy spin, slow the breath', 'Shake it out'],
    tenLeft: ['10 seconds – push!', 'Ten to go – dig deep', 'Finish strong – 10 seconds'],
    rest: ['Breathe in through the nose, long exhale out', 'Shoulders down, sip some water', 'Shake out your arms and legs', 'Picture the next set – crisp and controlled', 'Recovery is part of the work', 'Slow your breathing – heart rate down'],
    done: ['Workout crushed', 'That’s how it’s done', 'Stronger than yesterday', 'Another one in the bank', 'Consistency wins'],
    _last: {}
  };
  // recorded hype clips (tools/voice/clips_motivation.json): key = 'hype_' + slug of the phrase
  function hypeKey(t) { return 'hype_' + String(t).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40); }
  function hypeVoice(t) { var k = hypeKey(t); if (Coach.on() && Coach.has(k)) Coach.play([k]); }   // never falls back to the device voice
  function hype(kind) {
    var list = HYPE[kind], last = HYPE._last[kind], pick;
    do { pick = list[Math.floor(Math.random() * list.length)]; } while (list.length > 1 && pick === last);
    HYPE._last[kind] = pick;
    return pick;
  }

  // ---------------------------------------------------------------- Nature's Finest product tips (js/products.js)
  function productCard(it, campaign, compact) {
    return '<a class="prod-card focusable' + (compact ? ' compact' : '') + '" href="' + esc(Products.link(it, campaign)) + '" target="_blank" rel="noopener">' +
      '<div class="prod-img"><img src="' + esc(it.img) + '" alt="" loading="lazy"></div><div class="prod-body"><small>Nature’s Finest</small><h4>' + esc(it.name) + '</h4>' +
      '<p>' + esc(it.claim) + '</p><div class="prod-foot"><b>' + it.price.toFixed(2).replace('.', ',') + ' €</b><span>Shop →</span></div></div></a>';
  }
  function productSection(list, title, sub, campaign) {
    if (!list.length) return '';
    return '<div class="section-title"><h2>' + title + '</h2><span>' + esc(sub) + '</span></div>' +
      '<div class="prod-row">' + list.map(function (it) { return productCard(it, campaign); }).join('') + '</div>';
  }
  function homeProducts() {
    var s = state.settings, g = GOAL_BY[s.goal] || GOAL_BY.general, wk = Me.weeksTo(s), out = '', shown = [];
    if (s.goal === 'hyrox' && wk != null && wk >= 0 && wk <= 8) {
      shown = Products.pick(state, 'race', 3);
      out += productSection(shown, '🏁 Race prep · ' + pl(wk, ['week', 'weeks']) + ' to go', 'what to build into your routine before race day', 'race_prep');
    }
    var more = Products.pick(state, 'home', 6).filter(function (it) { return shown.indexOf(it) < 0; }).slice(0, 3);
    out += productSection(more, shown.length ? 'Everyday support' : 'Fuel your goal', g.ico + ' ' + g.name + ' – picked for your profile', 'home_goal');
    return out && out + '<div class="hint prod-disc">' + esc(Products.CONFIG.disclaimer) + ' · Tips can be switched off in Settings.</div>';
  }

  // goal + countdown + weight-to-target, one line on the home screen
  function goalLine() {
    var s = state.settings, g = GOAL_BY[s.goal] || GOAL_BY.general, wk = Me.weeksTo(s), bits = [];
    if (wk != null && wk >= 0) bits.push(pl(wk, ['week', 'weeks']) + ' to target date');
    if (s.weight && s.targetWeight) { var dlt = Math.round((s.targetWeight - s.weight) * 10) / 10; bits.push(dlt === 0 ? 'target weight reached 🎉' : (dlt > 0 ? '+' : '') + dlt + ' kg to target'); }
    return '<button class="goal-line focusable" data-go="profileEdit" data-p=\'{"id":"' + state.id + '"}\'><span>' + g.ico + ' ' + esc(g.name) + '</span>' +
      (bits.length ? '<small>' + esc(bits.join(' · ')) + '</small>' : '<small>Set your goal, body and heart-rate details →</small>') + '</button>';
  }

  // ---------------------------------------------------------------- screens
  var SCREENS = {};

  // Platform navigation: training, library, the sport tracker (centre), progress and "me".
  // Modules (window.FS_MODULES) plug their screens and home/progress panels in through window.App.
  function navBar() {
    var I = {
      today: '<path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z"/>',
      gym: '<path d="M6.5 8v8M17.5 8v8M3.5 10v4M20.5 10v4M6.5 12h11"/>',
      start: '<path d="M12 6v12M6 12h12"/>',
      progress: '<path d="M4 19h16M6 15l4-4 3 3 5-6"/>',
      me: '<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6"/>'
    };
    var cur = stack.length ? stack[stack.length - 1].screen : '';
    function b(go, ico, label) {
      return '<button class="btn sm ghost focusable' + (cur === go ? ' here' : '') + '" data-go="' + go + '"><i><svg viewBox="0 0 24 24">' + I[ico] + '</svg></i><span>' + label + '</span></button>';
    }
    return '<nav class="main-nav">' + b('home', 'today', 'Today') + b('train', 'gym', 'Gym') +
      '<button class="btn sm focusable start-tab" data-sheet="start" aria-label="Start"><i><svg viewBox="0 0 24 24">' + I.start + '</svg></i><span>Start</span></button>' +
      b('history', 'progress', 'Progress') + b('settings', 'me', 'Me') + '</nav>';
  }
  function hookHtml(where) {
    return App.hooks[where].map(function (f) { try { return f() || ''; } catch (e) { console.error(e); return ''; } }).join('');
  }

  // Gym: the training hub (program, quick workouts, hybrid race, saved). Home = Today (js/today.js).
  SCREENS.train = function () {
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
      var done = state.log.some(function (l) { return l.date.slice(0, 10) === ds; }) || (state.activities || []).some(function (a) { return a.start.slice(0, 10) === ds; });
      if (done) weekDone++;
      var pref = state.settings.prefDays || [];
      var planned = pref.length ? pref.indexOf(d.getDay()) >= 0 : plan.days.indexOf((i + 1) % 7) >= 0;
      daysHtml += '<div class="day' + (done ? ' done' : '') + (d.toDateString() === now.toDateString() ? ' today' : '') + '">' +
        DAYN[d.getDay()] + '<b>' + d.getDate() + '</b>' + (done ? '✓' : planned ? '•' : '&nbsp;') + '</div>';
    }
    var totalMin = state.log.reduce(function (s, l) { return s + (l.min || 0); }, 0);
    var streak = weeksStreak();

    var cards = plan.order.map(function (k) {
      var s = Program.SESSIONS[k], built = Program.build(state, k);   // names follow the equipment actually used
      var cp = sessionPhoto(s);
      return '<div class="session-card focusable' + (cp ? ' photo-card' : '') + (k === nextKey ? ' next' : '') + '" tabindex="0" data-go="overview" data-p=\'{"key":"' + k + '"}\'' + cardBg(cp) + '>' +
        '<div class="tag" style="color:' + s.color + '">' + (k === nextKey ? 'UP NEXT' : 'WORKOUT ' + (plan.order.indexOf(k) + 1)) + '</div>' +
        '<h3>' + esc(built.name) + '</h3><p>' + esc(built.short) + '</p></div>';
    }).join('');

    root.innerHTML =
      '<div class="screen">' +
      '<div class="topbar">' + brandMark() + '<span class="chip on">' + esc(sess.weekInfo.label) + '</span>' +
      '<button class="btn sm ghost focusable gym-lib" data-go="library">Library</button><button class="btn sm ghost focusable gym-lib" data-go="builder">＋ Build</button><div class="spacer"></div>' +
      navBar() +
      '<button class="btn sm ghost focusable who" data-go="profiles" title="Switch person" aria-label="Switch person">' + avatar(state) + '<span class="who-name" translate="no">' + esc(state.name) + '</span></button></div>' +
      '<div class="hero"><div class="hero-card' + (heroPhoto ? ' has-photo' : '') + '"' + photoBg(heroPhoto) + '><div class="eyebrow">Today’s workout · ' + esc(sess.weekInfo.label) + '</div>' +
      '<h1>' + esc(sess.name) + '</h1>' +
      '<div class="meta"><div><b>~' + mins + ' min</b>duration</div><div><b>' + exCount + '</b>' + (exCount === 1 ? 'exercise' : 'exercises') + '</div><div><b>' + sess.weekInfo.rir + ' in reserve</b>reps left at the end of a set</div></div>' +
      '<div class="hint">' + esc(sess.weekInfo.note) + '</div>' +
      '<div class="actions"><button class="btn primary focusable" data-autofocus data-go="player" data-p=\'{"key":"' + nextKey + '"}\'>▶ Start workout</button>' +
      '<button class="btn focusable" data-go="preview" data-p=\'{"key":"' + nextKey + '"}\'>📺 Preview</button>' +
      '<button class="btn ghost focusable" data-go="overview" data-p=\'{"key":"' + nextKey + '"}\'>Details</button></div>' +
      (heroPhoto ? '' : '<div class="hero-fig" id="heroFig"></div>') + '</div>' +
      '<div class="week"><h3>This week · ' + weekDone + ' / ' + plan.order.length + ' workouts</h3>' + goalLine() + '<div class="days">' + daysHtml + '</div>' +
      '<div class="stats"><div class="stat"><b>' + state.log.length + '</b><span>total workouts</span></div>' +
      '<div class="stat"><b>' + Math.round(totalMin / 60) + ' h</b><span>total time</span></div>' +
      '<div class="stat"><b>' + streak + '</b><span>week streak</span></div></div></div></div>' +
      hookHtml('train') +
      '<div class="section-title"><h2>Your program</h2><span>' + plan.order.length + ' workouts in rotation · a missed day won’t derail your plan</span></div>' +
      '<div class="row">' + cards + '</div>' +
      homeProducts() +
      '<div class="section-title"><h2>Quick workouts</h2><span>pick a focus or type – built only from your equipment</span></div>' +
      '<div class="row">' + QUICK.map(function (q, i) {
        var qp = q.photo && photo(q.photo), qn = q.name;
        // cardio cards are named after the machines this profile actually has (no bike/rower → no "Bike + rower")
        if (q.opts.type === 'kardio') {
          try {
            var g = Program.generate(Object.assign({ level: state.settings.level, owned: Program.owned(state) }, q.opts));
            qn = g.name.replace(/^Cardio: /, ''); qp = photo((g.blocks[1] || g.blocks[0]).items[0].id) || null;
          } catch (e) {}
        }
        return '<div class="session-card focusable quick' + (qp ? ' photo-card' : '') + '" tabindex="0" data-quick="' + i + '"' + cardBg(qp) + '><div class="tag" style="color:' + q.color + '">' + q.tag + '</div><h3>' + esc(qn) + '</h3><p>' + esc(q.sub) + '</p></div>';
      }).join('') + '<div class="session-card focusable quick" tabindex="0" data-go="builder"><div class="tag">CUSTOM</div><h3>＋ Build your own</h3><p>strength / cardio / mixed · focus · duration</p></div></div>' +
      '<div class="section-title"><h2>🏁 Hybrid race</h2><span>race simulation on your equipment – for time, with splits</span></div>' +
      '<div class="row">' + Program.HX_KEYS.map(function (k) {
        var hs = Program.SESSIONS[k];
        return '<div class="session-card hx focusable photo-card" tabindex="0" data-go="overview" data-p=\'{"key":"' + k + '"}\'' + cardBg(photo(['kb_swing', 'row_hiit', 'kb_deadlift'][Program.HX_KEYS.indexOf(k)])) + '><div class="tag">' + (hs.race ? 'FOR TIME' : 'WORKOUT') + '</div><h3>' + esc(hs.name) + '</h3><p>' + esc(hs.short) + '</p></div>';
      }).join('') + '</div>' +
      (state.saved.length ? '<div class="section-title"><h2>Saved workouts</h2></div><div class="row">' + state.saved.filter(function (k) { return state.customs[k]; }).map(function (k) {
        var c = state.customs[k];
        return '<div class="session-card focusable" tabindex="0" data-go="overview" data-p=\'{"key":"' + k + '"}\'><div class="tag" style="color:' + c.color + '">SAVED</div><h3>' + esc(c.name) + '</h3><p>' + esc(c.short) + '</p></div>';
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
    { tag: 'STRENGTH', name: 'Full body', photo: 'kb_goblet_squat', sub: '45 min · all major muscle groups', color: '#3ec46d', opts: { type: 'moc', focus: ['noge', 'prsa', 'hrbet', 'zadnjica', 'rame', 'trup'], min: 45 } },
    { tag: 'STRENGTH', name: 'Legs & glutes', photo: 'kb_deadlift', sub: '40 min', color: '#f08a5d', opts: { type: 'moc', focus: ['noge', 'zadnjica'], min: 40 } },
    { tag: 'STRENGTH', name: 'Upper body', photo: 'db_bench', sub: '40 min · chest, back, shoulders, arms', color: '#b6c99b', opts: { type: 'moc', focus: ['prsa', 'hrbet', 'rame', 'roke'], min: 40 } },
    { tag: 'CORE', name: 'Abs & back', sub: '20 min', color: '#a99be8', opts: { type: 'moc', focus: ['trup'], min: 20 } },
    { tag: 'CARDIO', name: 'Bike + rower intervals', photo: 'bike_hiit', sub: '30 min', color: '#5ad1b8', opts: { type: 'kardio', machine: 'both', intensity: 'hiit', min: 30 } },
    { tag: 'CARDIO', name: 'Zone 2 – endurance', photo: 'row_steady', sub: '40 min · easy', color: '#5ad1b8', opts: { type: 'kardio', machine: 'both', intensity: 'z2', min: 40 } }
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
      '<h1>' + esc(sess.name) + '</h1><p>~' + mins + ' min · ' + esc(sess.weekInfo.note) + '</p>' +
      '<p class="hint">Tuned for: ' + esc((GOAL_BY[sess.goal] || GOAL_BY.general).name) + (sess.trimmed ? ' · trimmed to fit ' + sess.trimmed + ' min' : '') +
      ((state.settings.limits || []).length ? ' · joint-friendly swaps on' : '') + '</p></div><div class="spacer"></div>' +
      (sess.custom ? '<button class="btn ghost focusable" id="saveTgl">' + (state.saved.indexOf(p.key) >= 0 ? '★ Saved' : '☆ Save') + '</button>' : '') +
      '<button class="btn focusable" data-go="preview" data-p=\'{"key":"' + p.key + '"}\'>📺 Preview</button>' +
      '<button class="btn primary focusable" data-autofocus data-go="player" data-p=\'{"key":"' + p.key + '"}\'>▶ Start</button></div>' +
      '<div class="rx-help"><b>How to read it:</b> <i>3 sets × 12–15 reps</i> = do 12–15 repetitions, rest, and repeat until you have done 3 rounds (sets). ' +
      'Choose a weight – or an easier variation – where the last 2–3 reps feel hard. <i>A1 / A2</i> = do them back to back, then rest.</div><div class="blocks">';
    sess.blocks.forEach(function (b, bi) {
      html += '<div class="block"><h3>' + esc(b.title) + '</h3>';
      b.items.forEach(function (it, ii) {
        var e = ex(it.id);
        var gl = Program.groupLetter(b.title, bi), tag = b.items.length > 1 && gl ? '<span class="lbl">' + gl + (ii + 1) + '</span>' : '';
        var load = it.sug ? '<small>' + esc(loadTxt(e, it.sug.load)) + '</small>' : '<small>' + (it.cardio ? 'cardio' : 'hold') + '</small>';
        html += '<div class="ex-row focusable" tabindex="0" data-go="exercise" data-p=\'{"id":"' + it.id + '"}\'>' +
          '<div class="ex-thumb" data-thumb="' + it.id + '"></div><div><h4>' + tag + esc(e.name) + '</h4><div class="sub">' +
          (it.swappedFrom ? '<span class="swap-note">⇄ ' + (it.joint ? 'joint-friendly swap for' : 'swapped for') + ': ' + esc(ex(it.swappedFrom).name) + '</span> · ' : '') + (it.caution ? '<span class="caution-note">⚠ loads a joint you flagged – go light or skip</span> · ' : '') + esc(e.muscles) +
          (it.sug && it.sug.why ? ' · <span style="color:var(--accent)">' + esc(it.sug.why) + '</span>' : '') + '</div></div>' +
          '<div class="rx">' + rxHtml(it) + load + '</div></div>';
      });
      html += '</div>';
    });
    if (sess.missing.length) html += '<div class="missing-note">Skipped – missing equipment: ' + sess.missing.map(function (id) { return esc(ex(id).name); }).join(', ') +
      ' · <button class="btn sm ghost focusable" data-go="equipment">Edit equipment</button></div>';
    root.innerHTML = html + '</div></div>';
    mountThumbs();
    if ($('#saveTgl')) $('#saveTgl').onclick = function () {
      var i = state.saved.indexOf(p.key);
      if (i >= 0) state.saved.splice(i, 1); else state.saved.push(p.key);
      Store.save();
      this.textContent = i >= 0 ? '☆ Save' : '★ Saved';
      toast(i >= 0 ? 'Removed from saved' : 'Saved – you’ll find it on the home screen');
    };
  };

  SCREENS.library = function (p) {
    var f = p.f || 'mine', g = p.g || 'all';
    var own = Program.owned(state);
    function chip(kind, val, label, on) {
      return '<button class="chip focusable' + (on ? ' on' : '') + '" data-fid="lib-' + kind + '-' + val + '" data-lib="' + kind + '" data-val="' + val + '">' + label + '</button>';
    }
    var focusChips = chip('g', 'all', 'All groups', g === 'all') +
      Object.keys(Exercises.FOCUS).map(function (k) { return chip('g', k, Exercises.FOCUS[k].name, g === k); }).join('');
    var equipKeys = Object.keys(Exercises.EQUIP).filter(function (k) { return k === 'floor' || own.indexOf(k) >= 0; });
    var equipChips = chip('f', 'mine', 'My equipment', f === 'mine') + chip('f', 'all', 'All exercises', f === 'all') +
      equipKeys.map(function (k) { return chip('f', k, '<span class="chip-ico">' + equipIcon(k) + '</span>' + esc(Exercises.EQUIP[k].name), f === k); }).join('');
    var list = Exercises.LIST.filter(function (e) {
      return (f === 'all' || (f === 'mine' ? Exercises.available(e.id, own) : e.equip.indexOf(f) >= 0)) && (g === 'all' || e.groups.indexOf(g) >= 0);
    });
    root.innerHTML = '<div class="screen"><div class="topbar"><h1>Library</h1><span class="chip">' + pl(list.length, VAJ) + '</span><div class="spacer"></div>' +
      '<button class="btn sm ghost focusable" data-go="equipment">My equipment →</button></div>' +
      '<div class="filters"><span class="flabel">Focus</span>' + focusChips + '</div>' +
      '<div class="filters"><span class="flabel">Equipment</span>' + equipChips + '</div><div class="grid">' +
      (list.map(function (e) {
        var ok = Exercises.available(e.id, own);
        var need = e.equip.filter(function (k) { return k !== 'floor' && own.indexOf(k) < 0; }).map(function (k) { return Exercises.EQUIP[k].name; }).join(', ');
        return '<div class="lib-card focusable' + (ok ? '' : ' locked') + '" tabindex="0" data-go="exercise" data-p=\'{"id":"' + e.id + '"}\'><div class="thumb" data-thumb="' + e.id + '"></div>' +
          '<div class="info"><h4>' + esc(e.name) + '</h4><div class="sub">' + (ok ? esc(e.muscles) : '🔒 Requires: ' + esc(need)) + '</div></div></div>';
      }).join('') || '<div class="hint">No exercises match these filters.</div>') + '</div></div>';
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
      (ph ? '<button class="pip focusable" id="exPip"><img src="' + ph + '" alt=""><span>Real form · enlarge</span></button><div class="photo-full" id="exPhoto" hidden><img src="' + ph + '" alt=""><span>' + esc(e.name) + '</span></div>' : '') +
      '</div><div class="side"><div class="kicker">' + esc(e.muscles) + '</div><h2>' + esc(e.name) + '</h2>' +
      '<div class="why">Tempo <b>' + esc(e.tempo || '') + '</b>' + (h ? ' · last time <b>' + esc(loadTxt(e, h.load)) + '</b> × ' + h.reps.join(', ') : '') + '</div>' +
      '<div class="mus-block"><div class="mus-map">' + muscleMap(mus) + '</div><div class="mus-list"><div class="label">Muscles worked</div>' + musChips(mus, true) + '</div></div>' +
      '<div class="label">Proper form – step by step</div><ol class="steps" id="exSteps">' + steps.map(function (s, k) { return '<li data-i="' + s.i + '"><b>' + (k + 1) + '</b>' + esc(s.l) + '</li>'; }).join('') + '</ol>' +
      '<div class="label">Key cues</div><ul class="cues ok">' + e.cues.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' +
      '<div class="label">Common mistakes</div><ul class="cues bad">' + (e.mistakes || []).map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' +
      '<div class="controls"><button class="btn primary focusable" id="solo">▶ Train<span class="wide-only"> this exercise</span></button><button class="btn focusable" id="spd">Speed 1×</button>' +
      '<button class="btn focusable" id="gd">Guides: on</button><button class="btn ghost focusable" id="bk">← Back</button></div></div>';
    document.body.appendChild(el);
    var speeds = [1, 0.5, 0.25], si = 0;
    var exCue = cueHolder($('#exPhase'));
    var pl = mountFigure($('#exFig'), p.id, {
      aspect: 1.45, labels: true, guides: true,
      onPhase: function (l, idx) {
        exCue(l);
        var cur = null;
        $$('#exSteps li').forEach(function (li) { if (+li.getAttribute('data-i') <= idx) cur = li; });
        $$('#exSteps li').forEach(function (li) { li.classList.toggle('on', li === cur); });
      }
    });
    $('#spd').onclick = function () { si = (si + 1) % speeds.length; pl.speed = (e.speed || 1) * speeds[si]; this.textContent = 'Speed ' + speeds[si] + '×'; };
    $('#gd').onclick = function () { pl.guides = pl.labels = !pl.guides; this.textContent = 'Guides: ' + (pl.guides ? 'on' : 'off'); };
    $('#bk').onclick = back;
    $('#solo').onclick = function () { startCustom(Program.single(p.id), 'player'); };
    if (ph) {
      $('#exPip').onclick = function () { var f = $('#exPhoto'); f.hidden = !f.hidden; this.querySelector('span').textContent = f.hidden ? 'Real form · enlarge' : 'Back to animation'; };
    }
    $('#solo').setAttribute('data-autofocus', '');
    setTimeout(function () { var sd = $('.exd .side'); if (sd) sd.scrollTop = 0; }, 30);
  };

  SCREENS.history = function () {
    var log = state.log.slice().reverse(), fresh = !state.log.length && !(state.activities || []).length;
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
    var bs = state.settings, bl = (bs.bodyLog || []).slice(-20);
    var spark = '';
    if (bl.length > 1) {
      var vals = bl.map(function (x) { return x.kg; }).concat(bs.targetWeight ? [bs.targetWeight] : []);
      var lo = Math.min.apply(null, vals) - 0.5, hi = Math.max.apply(null, vals) + 0.5;
      var y = function (v) { return (100 - (v - lo) / (hi - lo) * 100).toFixed(1); };
      spark = '<svg class="spark" viewBox="0 0 100 100" preserveAspectRatio="none">' +
        (bs.targetWeight ? '<line x1="0" x2="100" y1="' + y(bs.targetWeight) + '" y2="' + y(bs.targetWeight) + '"/>' : '') +
        '<polyline points="' + bl.map(function (x, k) { return (k / (bl.length - 1) * 100).toFixed(1) + ',' + y(x.kg); }).join(' ') + '"/></svg>';
    }
    var first = bl.length ? bl[0].kg : null, change = first != null && bs.weight != null ? Math.round((bs.weight - first) * 10) / 10 : null;
    var weightPanel = '<div class="panel weight-panel"><h3>Body weight</h3>' +
      '<div class="wl-row"><div class="stepper"><button class="focusable" data-fid="wl-m" data-wl="-0.1">−</button><div class="val"><input class="num-in focusable" id="wlv" data-fid="wl-in" type="text" inputmode="decimal" autocomplete="off" step="0.1" placeholder="—" value="' + (bs.weight || '') + '"><small>kg today</small></div>' +
      '<button class="focusable" data-fid="wl-p" data-wl="0.1">+</button></div><button class="btn primary sm focusable" id="wlSave" data-fid="wl-save">Log weight</button>' +
      '<div class="hint">' + (change != null && bl.length > 1 ? (change > 0 ? '+' : '') + change + ' kg since ' + bl[0].date + ' · ' : '') + (bs.targetWeight ? 'target ' + bs.targetWeight + ' kg (dashed line)' : 'set a target weight in your profile') + '</div></div>' +
      (spark || '<div class="hint">Log your weight a few times to see the trend.</div>') + '</div>';
    root.innerHTML = '<div class="screen"><div class="topbar"><h1>Progress</h1><div class="spacer"></div><button class="btn sm ghost focusable" data-autofocus data-go="settings">Backup</button></div>' +
      (fresh ? '<div class="panel first-steps"><h3>Your first steps</h3><p class="hint">Charts and records appear here as soon as there is something to show.</p><div class="fs-list">' +
        '<button class="fs-item focusable" id="fsWeight"><span>⚖️</span><div><b>Log your first weight</b><small>the start of your trend line</small></div><span class="set-chev">›</span></button>' +
        '<button class="fs-item focusable" data-go="train"><span>🏋️</span><div><b>Do your first workout</b><small>sets, weights and records start here</small></div><span class="set-chev">›</span></button>' +
        '<button class="fs-item focusable" data-go="record" data-p=\'{"type":"walk"}\'><span>🚶</span><div><b>Record your first walk or run</b><small>distance, time and running records</small></div><span class="set-chev">›</span></button>' +
        '</div></div>' : '') +
      (fresh ? '' : '<div class="hero"><div class="panel"><h3>Workouts per week (12 weeks)</h3><div class="bars">' + bars + '</div><div class="hint">Goal: ' + state.settings.days + ' per week</div></div>' +
      '<div class="panel"><h3>Recent workouts</h3><div class="hist">' + (log.slice(0, 6).map(function (l) {
        var s = Program.get(state, l.session);
        return '<div class="hist-item"><div class="d">' + new Date(l.date).toLocaleDateString((window.I18N && I18N.locale || 'en-GB')) + '</div><div style="flex:1">' + esc(l.name || (s ? s.name : 'Workout')) + '</div><div>' + l.min + ' min · ' + l.sets.length + (l.sets.length === 1 ? ' set' : ' sets') + '</div></div>';
      }).join('') || '<div class="hint">No workouts logged yet.</div>') + '</div></div></div>') +
      hookHtml('progress') + weightPanel +
      (prs ? '<div class="panel"><h3>Current working weights (double progression)</h3><div class="hist">' + prs + '</div></div>' : '') + '</div>';
    var wv = bs.weight || 75;
    $$('[data-wl]').forEach(function (b) {
      b.onclick = function () { readW(); wv = Math.round((wv + parseFloat(b.getAttribute('data-wl'))) * 10) / 10; $('#wlv').value = wv; };
    });
    function readW() { var v = parseFloat(String($('#wlv').value).replace(',', '.')); if (v >= 30 && v <= 250) wv = v; }
    if ($('#fsWeight')) $('#fsWeight').onclick = function () { var w = $('.weight-panel'); w.scrollIntoView({ block: 'center', behavior: 'smooth' }); $('#wlv').focus(); };
    $('#wlSave').onclick = function () {
      readW(); logWeight(state, wv); Store.save(); toast('Logged ' + wv + ' kg'); refresh(); };
  };

  SCREENS.settings = function () {
    var s = state.settings;
    function opt(key, val, label) {
      return '<button class="chip focusable' + (s[key] === val ? ' on' : '') + '" data-set="' + key + '" data-val=\'' + JSON.stringify(val) + '\'>' + label + '</button>';
    }
    function tipChip(val, label) {   // the effective state (explicit choice, else the global pilot switch)
      return '<button class="chip focusable' + (Products.enabled(state) === val ? ' on' : '') + '" data-set="tips" data-val=\'' + val + '\'>' + label + '</button>';
    }
    // pick the coach voice; best-sounding voices first, ★ = premium/enhanced/neural quality
    function voiceRow() {
      var all = Voice.list().filter(function (x) { return x.score > -50; }).slice(0, 8);   // novelty/robotic voices hidden
      if (!all.length) return '';
      var cur = Voice.v && Voice.v.name, poor = all[0].score < 40;
      return '<div class="set-row"><span class="set-ico">🗣️</span><div class="set-lab"><b>Coach voice</b></div><div class="set-ctrl">' + all.map(function (x) {
        var nm = x.v.name.replace(/\s*\(.*\)\s*$/, '').replace(/^Microsoft\s+|\s+Online.*$/g, '');
        return '<button class="chip focusable' + (x.v.name === cur ? ' on' : '') + '" data-voice="' + esc(x.v.name) + '">' + (x.score >= 40 ? '★ ' : '') + esc(nm) + ' <small>' + esc(String(x.v.lang).replace('_', '-').slice(3)) + '</small></button>';
      }).join('') +
        (poor ? '<span class="hint">Only basic voices on this device. iPhone: Settings → Accessibility → Spoken Content → Voices → English → download a “Premium” or “Enhanced” voice (e.g. Serena, Zoe, Jamie, Evan), then reopen the app.</span>' : '') + '</div></div>';
    }
    var voiceInfo = !('speechSynthesis' in window) ? 'This browser has no speech – using beeps.' : Voice.v ? 'Voice: ' + Voice.v.name + '.' : 'Uses the device’s default English voice.';
    // grouped like a phone's settings: one card per topic, one row per setting, links end in ›
    function row(ico, label, sub, ctrl, cls) {
      return '<div class="set-row' + (cls ? ' ' + cls : '') + '"><span class="set-ico">' + ico + '</span><div class="set-lab"><b>' + label + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>' +
        (ctrl ? '<div class="set-ctrl">' + ctrl + '</div>' : '') + '</div>';
    }
    function link(ico, label, sub, go, p) {
      return '<button class="set-row set-link focusable" data-go="' + go + '"' + (p ? ' data-p=\'' + JSON.stringify(p) + '\'' : '') + '><span class="set-ico">' + ico + '</span><div class="set-lab"><b>' + label + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div><span class="set-chev">›</span></button>';
    }
    function group(title, rows) { return '<section class="set-group"><h2>' + title + '</h2><div class="set-card">' + rows + '</div></section>'; }
    var goal = GOAL_BY[s.goal] || GOAL_BY.general, nEq = (s.equipment || []).length, hasRoutine = (s.routine || []).length > 0;
    var facts = [Me.age(s) ? Me.age(s) + ' y' : '', s.height ? s.height + ' cm' : '', s.weight ? s.weight + ' kg' : '', Me.zone(s, .6, .7) ? 'Zone 2 ' + Me.zone(s, .6, .7).join('–') + ' bpm' : ''].filter(Boolean);
    root.innerHTML = '<div class="screen settings-screen"><div class="topbar"><h1>Settings</h1></div>' +
      '<div class="me-hero">' + avatar(state, true) + '<div class="me-id"><b translate="no">' + esc(state.name) + '</b><span>' + goal.ico + ' ' + esc(goal.name) + '</span>' +
      (facts.length ? '<div class="me-facts">' + facts.map(function (f) { return '<span class="chip">' + esc(f) + '</span>'; }).join('') + '</div>' : '') +
      '<small>' + (state.pin ? '🔒 PIN locked' : 'No PIN') + ' · ' + pl(state.log.length, TRN) + '</small></div>' +
      '<div class="me-act"><button class="btn primary focusable" data-go="profileEdit" data-p=\'{"id":"' + state.id + '"}\'>Edit profile</button><button class="btn ghost focusable who" data-go="profiles">' + avatar(state) + 'Switch person</button></div></div>' +
      hookHtml('settings') +
      group('General', (window.I18N ? row('🌐', 'Language', 'Texts in your language – the coach voice stays English', I18N.select('setLang')) : '') +
        (window.Theme ? row('🌗', 'Appearance', 'Light or dark – “System” follows your phone.', ['light', 'dark', 'system'].map(function (t) {
          return '<button class="chip focusable' + (Theme.choice() === t ? ' on' : '') + '" data-theme-pick="' + t + '">' + { light: '☀️ Light', dark: '🌙 Dark', system: '📱 System' }[t] + '</button>';
        }).join('')) : '') +
        (window.FinestQR && FinestQR.canInstall && FinestQR.canInstall() ? '<button class="set-row set-link focusable" id="setInstall"><span class="set-ico">📲</span><div class="set-lab"><b>Add FinestMe to your home screen</b><small>opens like an app, full screen, with reminders</small></div><span class="set-chev">›</span></button>' : '')) +
      group('Health & routine',
        link('📷', 'Scan a product', 'QR code on your Nature’s Finest pack → how to use it + your routine', 'scan') +
        (hasRoutine ? link('🏅', 'My program & reminders', 'check-ins, rewards, supply, reminder time', 'program') : '') +
        (hasRoutine ? link('📦', 'My shelf', 'what’s left in each pack · reorder · never run out', 'shelf') : '') +
        link('🗓️', 'My supplement routine', hasRoutine ? (s.routine.length + ' in your routine') : 'pick from Nature’s Finest or add your own', 'routine') +
        row('💡', 'Nature’s Finest product tips', Products.eligible(state) ? 'Goal-based tips on Today and after workouts – matched on this device only' : 'Shown only to adults – add your age in your profile', tipChip(true, 'On') + tipChip(false, 'Off'))) +
      group('Training',
        link('🏋️', 'My equipment', pl(nEq, NAP) + ' · ' + pl(unlocked(s.equipment || []), VAJ), 'equipment') +
        row('📅', 'Workouts per week', '', opt('days', 3, '3× – full body') + opt('days', 4, '4× – upper / lower')) +
        row('📈', 'Level', '', opt('level', 'beg', 'Beginner') + opt('level', 'mid', 'Intermediate') + opt('level', 'adv', 'Advanced')) +
        row('🙌', 'Hands-free sets', 'The set completes itself 6 s after the rep pacer reaches the target', opt('autoNext', true, 'On') + opt('autoNext', false, 'Off')) +
        row('🗓️', '4-week block', 'started ' + esc(s.startDate), '<button class="btn sm focusable" id="newBlock">Start new block today</button>')) +
      group('Sound & voice',
        row('🔊', 'Voice coaching', esc(voiceInfo) + ' On iPhone, silent mode can mute sound outside workouts.', opt('voice', true, 'On') + opt('voice', false, 'Off') + '<button class="btn sm focusable" id="vTest">▶ Test</button>') +
        ((window.VOICE_CLIPS || []).length ? row('🎙️', 'Coach', 'Recorded studio voice for exercise names, sets, rest and countdowns – English in every language', opt('coachVoice', 'recorded', '★ Premium recorded coach') + opt('coachVoice', 'device', 'Device voice')) : '') +
        (s.coachVoice === 'device' ? voiceRow() : '') +
        row('🔔', 'Beeps', '', opt('beeps', true, 'On') + opt('beeps', false, 'Off')) +
        row('📺', 'TV preview – seconds per exercise', '', opt('previewSec', 10, '10 s') + opt('previewSec', 15, '15 s') + opt('previewSec', 25, '25 s'))) +
      group('Data & privacy',
        row('💾', 'Backup', 'Everyone’s data is stored on this device. The export includes all profiles – use it to move data between phone and TV.',
          '<button class="btn sm focusable" id="exp">⬇ Export</button><label class="btn sm focusable" tabindex="0" id="impL">⬆ Import<input type="file" id="imp" accept="application/json" hidden></label>') +
        row('🗑️', 'Reset my progress', 'Deletes your history and weights on this device', '<button class="btn sm ghost focusable danger" id="rst">Reset</button>')) +
      '<div class="set-foot hint"><span class="kbd">← ↑ → ↓</span> move · <span class="kbd">OK</span> select / set done · <span class="kbd">↩</span> back · <span class="kbd">▶❚❚</span> pause</div></div>';
    $$('[data-set]').forEach(function (b) {
      b.onclick = function () {
        s[b.getAttribute('data-set')] = JSON.parse(b.getAttribute('data-val'));
        Store.save();
        refresh();
      };
    });
    $$('[data-voice]').forEach(function (b) {
      b.onclick = function () {
        s.voiceName = b.getAttribute('data-voice'); Store.save(); Voice.pick();
        Sound.unlock(); Voice.say('Hi ' + state.name + '. I will be your coach today. Three, two, one, go!');
        refresh();
      };
    });
    $('#vTest').onclick = function () {
      Sound.unlock(); Sound.session(true);
      Audio.beep(880, 0.15); setTimeout(function () { Audio.beep(1320, 0.25); }, 250);
      Voice.cue('Voice coaching is on. Three, two, one, go!', ['hello', 'go']);
      setTimeout(function () { Sound.session(false); }, 4000);
    };
    $$('[data-theme-pick]').forEach(function (b) { b.onclick = function () { Theme.set(b.getAttribute('data-theme-pick')); refresh(); }; });
    if ($('#setInstall')) $('#setInstall').onclick = function () { FinestQR.installSheet('settings'); };
    $('#newBlock').onclick = function () { s.startDate = new Date().toISOString().slice(0, 10); Store.save(); toast('New block starts today – Week 1'); refresh(); };
    $('#exp').onclick = function () { Store.exportJSON(); };
    $('#impL').onclick = function (e) { if (e.target.id !== 'imp') $('#imp').click(); };
    $('#imp').onchange = function () {
      var f = this.files[0]; if (!f) return;
      f.text().then(function (t) { try { Store.importJSON(t); toast('Imported – choose a person'); resetTo('profiles'); } catch (err) { toast('Error: ' + err.message); } });
    };
    $('#rst').onclick = function () {
      ask('Delete all history and weights for ' + state.name + '?', 'Reset', function () { Store.resetProgress(state); toast('Progress reset'); resetTo(window.__HOME || 'home'); });
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
      '<div class="pip" id="pvPip" hidden><img alt=""><span>Real form</span></div></div>' +
      '<div class="side"><div class="kicker" id="pvMus"></div><h2 id="pvName"></h2><div class="prescription" id="pvRx"></div>' +
      '<div class="mus-block"><div class="mus-map" id="pvMap"></div><div class="mus-list"><div class="label">Muscles worked</div><div id="pvChips"></div></div></div>' +
      '<div class="label">Key cues</div><ul class="cues ok" id="pvCues"></ul><div class="countdown"><i id="pvBar"></i></div>' +
      '<div class="controls"><button class="btn focusable" id="pvPrev" aria-label="Previous">◀</button><button class="btn focusable" id="pvPause">Pause</button><button class="btn focusable" id="pvNext" aria-label="Next">▶</button>' +
      '<button class="btn primary focusable" id="pvStart" data-autofocus>Start workout</button></div></div>';
    document.body.appendChild(el);
    keepAwake(true);
    var pl = new Figure.Player($('#pvFig'), { aspect: 1.45, labels: true, guides: true, onPhase: cueHolder($('#pvPhase')) });
    players.push(pl);

    function show(i) {
      idx = (i + items.length) % items.length;
      var it = items[idx].it, e = ex(it.id);
      pl.speed = e.speed || 1; pl.load(e.anim);
      $('#pvCount').textContent = (idx + 1) + ' / ' + items.length;
      $('#pvBlock').textContent = items[idx].block;
      $('#pvMus').textContent = e.muscles;
      $('#pvName').textContent = e.name;
      var x = rxParts(it);
      $('#pvRx').innerHTML = (x.sets ? '<div><b>' + x.sets + '</b><span>' + (x.setWord || 'sets') + '</span></div>' : '') + '<div><b>' + esc(String(x.amt)) + '</b><span>' + esc(x.unit + (x.side ? ' ' + x.side : '')) + '</span></div><div><b>' + esc(it.sug ? loadTxt(e, it.sug.load) : it.cardio ? 'cardio' : 'hold') + '</b><span>load</span></div><div><b>' + esc(e.tempo || '') + '</b><span>tempo</span></div>';
      $('#pvCues').innerHTML = e.cues.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('');
      $('#pvMap').innerHTML = muscleMap(e.anim.muscles);
      $('#pvChips').innerHTML = musChips(e.anim.muscles, true);
      var pp = photo(it.id); $('#pvPip').hidden = !pp; if (pp) $('#pvPip img').src = pp;
      t0 = Date.now();
      Voice.cue(e.name + '. ' + e.cues[0], ['ex_' + it.id, 'cue_' + it.id]);
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
    $('#pvPause').onclick = function () { paused = !paused; this.textContent = paused ? 'Resume' : 'Pause'; if (paused) pl.stop(); else pl.start(); };
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
    // hands-free sets: once the rep pacer reaches the target, the set completes itself after a short
    // grace period (time to rack the weights) – no need to press "Set done" on the TV remote
    var AUTO_GRACE = 6, autoAt = 0;
    var bestBefore = JSON.parse(JSON.stringify(state.ex || {}));   // personal bests at session start
    var prs = [], lastHype = '', lastMilestone = -1;
    // each line stays up at least 4 s; a newer line waits (only the latest waiting one is shown)
    var hypeSince = 0, hypeWait = 0;
    function setHype(t, strong, now) {
      if (!t || t === lastHype) return;
      clearTimeout(hypeWait);
      var left = 4000 - (Date.now() - hypeSince);
      if (!now && left > 0) { hypeWait = setTimeout(function () { setHype(t, strong, true); }, left); return; }
      lastHype = t; hypeSince = Date.now();
      var h = $('#wHype'); if (!h) return;
      h.textContent = t;
      h.classList.remove('pop'); void h.offsetWidth; h.classList.add('pop'); h.classList.toggle('strong', !!strong);
    }
    function cheer(title, sub) {
      var c = $('#wCheer'); $('b', c).textContent = title; $('span', c).textContent = sub || '';
      c.hidden = false; c.classList.remove('go'); void c.offsetWidth; c.classList.add('go');
      clearTimeout(cheer.t); cheer.t = setTimeout(function () { c.hidden = true; }, 1900);
    }
    function isPR(id, reps, load) {
      var b = bestBefore[id]; if (!b || !b.reps || !b.reps.length) return false;
      return load > b.load || (load === b.load && reps > Math.max.apply(null, b.reps));
    }
    function lastWorkStep(k) { for (var x = k + 1; x < st.length; x++) if (st[x].id !== st[k].id) return false; return true; }
    function autoNext() { return state.settings.autoNext !== false && !race; }
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
      '<div class="hud-clock"><small>' + (race ? 'RACE TIME' : 'TOTAL') + '</small><b id="wClock">0:00</b></div></div>' +
      '<div class="next-card" id="wNextCard"><div class="nc-thumb" id="wNextThumb"></div><div><small id="wNextLbl"></small><b id="wNextName"></b></div></div>' +
      '<div class="pip" id="wPip" hidden><img alt=""><span>Real form</span></div>' +
      '<div class="mini-time" id="wMini"><small></small><b></b></div>' +
      '<div class="cheer" id="wCheer" hidden><div class="cheer-burst"></div><b></b><span></span></div>' +
      '<div class="finish" id="wFinish" hidden></div></div>' +
      '<div class="view-tabs" role="tablist"><button class="focusable" data-view="timer">Timer</button><button class="focusable" data-view="form">How to</button></div>' +
      '<div class="side"><div class="kicker"><span id="wBlock"></span><span class="dots-set" id="wDots"></span></div>' +
      '<h2 id="wName"></h2><div class="hype-line" id="wHype"></div><div class="why" id="wWhy"></div><div id="wMus"></div>' +
      ring('wRing') +
      '<div class="chips-row" id="wRx"></div>' +
      '<div class="logger" id="wLog"></div>' +
      '<div class="controls"><button class="btn primary focusable" id="wDone" data-autofocus></button>' +
      '<button class="btn focusable" id="wMinus" hidden>−15 s</button><button class="btn focusable" id="wPlus" hidden>+15 s</button>' +
      '<button class="btn focusable" id="wPause">Pause</button><button class="btn ghost focusable" id="wSkip">Skip exercise</button>' +
      '<button class="btn ghost focusable" id="wExit">End</button></div>' +
      (race ? '<div class="splits" id="wSplits"></div>' : '') + '</div>';
    document.body.appendChild(el);
    keepAwake(true);
    Sound.unlock(); Sound.session(true);
    // Phones: timer and technique can't both fit, so the screen alternates between them. Per step (exercise or rest):
    // first 15 s technique only, then timer 3 s / technique 6 s, and the last 3 s of a timed step always technique.
    // Tapping a tab takes over for 20 s. TVs/desktops show both side by side.
    var narrow = window.matchMedia('(max-width: 900px)');
    var view = 'form', stepT = 0, manualUntil = 0, done = false;
    if (narrow.matches) el.appendChild($('.controls', el));
    function setView(v) {
      view = v;
      el.classList.toggle('v-form', v === 'form');
      $$('[data-view]', el).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-view') === v); });
    }
    $$('[data-view]', el).forEach(function (b) {
      b.onclick = function () { setView(b.getAttribute('data-view')); manualUntil = Date.now() + 20000; };
    });
    function stepLeft() {   // seconds left in the current step, null when it ends on a tap (reps)
      var s = st[i];
      if (phase === 'rest' || (s && s.kind === 'time')) return remain;
      if (s && s.kind === 'dist') return s.dist * (ex(s.id).secPerM || 0.27) - elapsed;
      return null;
    }
    function autoView() {
      stepT += 0.25;
      if (!narrow.matches || done || Date.now() < manualUntil) return;
      var left = stepLeft(), want = stepT < 15 || (left != null && left <= 3) ? 'form' : (stepT - 15) % 9 < 3 ? 'timer' : 'form';
      if (want !== view) setView(want);
    }
    setView('form');
    var pl = new Figure.Player($('#wFig'), { aspect: 1.45, labels: true, onPhase: cueHolder($('#wPhase')) });
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
      if (!nx) { $('#wNextLbl').textContent = 'Final stretch'; $('#wNextName').textContent = 'Almost there – you’ve got this 💪'; nextPl.stop(); return; }
      var ne = ex(nx.id);
      $('#wNextLbl').textContent = 'Next →' + (nx.kind === 'reps' && nx.sets > 1 ? ' set ' + nx.set + '/' + nx.sets : '') + (nx.rest === 0 && phase === 'rest' ? '' : '');
      $('#wNextName').textContent = (nx.kind === 'reps' ? (nx.item.reps[0] === nx.item.reps[1] ? nx.item.reps[0] : nx.item.reps[0] + '–' + nx.item.reps[1]) + ' reps · ' :
        nx.kind === 'dist' ? nx.dist + ' m · ' : fmt(nx.sec) + ' · ') + ne.name;
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
      $('#wMeta').textContent = 'Block ' + (bi + 1) + '/' + blockTitles.length + ' · ' + Math.round(i / st.length * 100) + ' %';
    }

    function enter(n) {
      i = n;
      if (i >= st.length) return finish();
      var s = st[i], e = ex(s.id), it = s.item;
      phase = 'work'; elapsed = 0; stepT = 0; pacerHit = false; autoAt = 0; lastHype = '';
      var enterHype = lastWorkStep(n) && st.length > 3 ? hype('finalExercise') : n > 0 && s.sets > 1 && s.set === s.sets ? hype('lastSet') : s.set === 1 && s.sets > 1 ? hype('firstSet') : hype('start');
      lastMilestone = -1; setHype(enterHype, lastWorkStep(n), true);
      var hk = hypeKey(enterHype), spokenHype = Coach.has(hk) ? hk : null;   // e.g. 'Last set, make it count.' instead of 'Set four.'
      el.classList.remove('resting');
      if (Date.now() >= manualUntil) setView('form');
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
        $('#wWhy').textContent = race ? 'For time – ' + target + ' reps' + (s.perSide ? ' per side' : '') : (sug.why || 'Target ' + target + ' reps – stop when you could still do about ' + sess.weekInfo.rir + ' more');
        $('#wRx').innerHTML = chips([[target + (s.perSide ? '/side' : ''), 'target'], [loadTxt(e, cur.load), 'load'], [race ? 'for time' : sess.weekInfo.rir + ' in reserve', race ? 'mode' : 'effort'], [e.tempo || '—', 'tempo']]);
        var lg = stepper('reps', cur.reps, 1, 'reps');
        if (e.unit === 'kg') lg += stepper('load', cur.load, e.id.indexOf('kb_') === 0 ? 4 : (e.inc || 2), 'kg');
        if (e.unit === 'stopnja') lg += stepper('load', cur.load, 1, 'level');
        $('#wLog').innerHTML = lg; $('#wLog').hidden = false;
        $('#wDone').textContent = race ? '✓ Station done' : s.sets > 1 && s.set === s.sets ? '🏁 Last set done' : '✓ Done';
        Voice.cue(e.name + '. ' + (s.set === 1 ? e.cues[0] : 'Set ' + s.set), ['ex_' + s.id, s.set === 1 ? 'cue_' + s.id : spokenHype || 'set_' + s.set]);
      } else if (s.kind === 'dist') {
        $('#wWhy').textContent = 'Target ' + s.dist + ' m – press OK when the monitor shows the distance';
        $('#wRx').innerHTML = chips([[s.dist + ' m', 'distance'], ['~' + fmt(s.dist * (e.secPerM || 0.27)), 'target time'], [e.tempo || '—', 'tempo']]);
        $('#wLog').innerHTML = ''; $('#wLog').hidden = true;
        $('#wDone').textContent = '✓ ' + s.dist + ' m done';
        Voice.cue(e.name + '. ' + s.dist + ' meters.', ['ex_' + s.id, 'm_' + s.dist]);
      } else {
        remain = s.sec;
        $('#wWhy').textContent = race && /^(Postaja|Station)/.test(s.block) ? 'Station for time – ' + fmt(s.sec) : s.sec >= 60 && !s.hard && !s.easy ? fmt(s.sec) + ' min' : (s.label || '');
        var rx = [[fmt(s.sec), s.hard ? 'hard' : s.easy ? 'easy' : 'duration']];
        if (s.sets > 1) rx.push([s.set + '/' + s.sets, s.hard || s.easy ? 'interval' : 'set']);
        if (e.unit === 'stopnja' || e.unit === 'kg') rx.push([loadTxt(e, it.sug ? it.sug.load : (state.ex[s.id] || {}).load || e.load), 'load']);
        rx.push([e.tempo || '—', 'tempo']);
        if (e.type === 'cardio' && !race) {
          var hz = s.hard ? Me.zone(state.settings, .85, .95) : s.easy ? Me.zone(state.settings, .5, .6) : Me.zone(state.settings, .6, .7);
          if (hz) rx.push([hz[0] + '–' + hz[1] + ' bpm', s.hard ? 'Zone 4–5' : s.easy ? 'Zone 1' : 'Zone 2']);
        }
        $('#wRx').innerHTML = chips(rx);
        $('#wLog').innerHTML = ''; $('#wLog').hidden = true;
        $('#wDone').textContent = race ? '✓ Station done' : '✓ Done – next';
        if (s.hard) { Audio.beep(1200, 0.35); Voice.cue('Go hard!', ['hard']); setHype(hype('hard'), true); }
        else if (s.easy) { Audio.beep(600, 0.3); Voice.cue('Easy pace.', ['easy']); setHype(hype('easy')); }
        else Voice.cue(e.name + '. ' + e.cues[0], ['ex_' + s.id, 'cue_' + s.id]);
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
      if (s.kind === 'reps') {
        logged.push({ id: s.id, reps: cur.reps, load: cur.load });
        var e0 = ex(s.id), pr0 = e0.unit === 'kg' && isPR(s.id, cur.reps, cur.load) && prs.indexOf(s.id) < 0;
        if (pr0) { prs.push(s.id); hypeVoice('New personal best!'); }
        if (!race) cheer(pr0 ? '🏆 New personal best!' : hype('hit'),
          (s.sets > 1 ? 'Set ' + s.set + ' of ' + s.sets + ' · ' : '') + cur.reps + ' reps' + (e0.unit === 'kg' && cur.load ? ' × ' + cur.load + ' kg' : ''));
      } else if (!race && !s.easy && !s.hard && s.kind === 'time' && s.sec >= 30 && i < st.length - 1) cheer(hype('hit'), e0name(s));
      splits.push({ name: s.block.replace(/^(Postaja|Station) \d+ · /, ''), id: s.id, sec: elapsed || (s.sec - Math.max(0, remain)) || 0, station: /^(Postaja|Station|Tek|Run)\b/.test(s.block) });
      if (race) renderSplits();
      if (s.rest > 0 && i < st.length - 1) startRest(s.rest);
      else enter(i + 1);
    }

    function e0name(s) { return ex(s.id).name.split(' (')[0]; }
    function startRest(sec) {
      phase = 'rest'; remain = sec; restTotal = sec; stepT = 0;
      el.classList.add('resting');
      var nx = st[i + 1], ne = ex(nx.id);
      showAnim(nx.id);
      $('#wName').textContent = 'Rest';
      $('#wMus').innerHTML = musChips(ne.anim.muscles);
      var np = photo(nx.id); $('#wPip').hidden = !np; if (np) $('#wPip img').src = np;
      $('#wWhy').textContent = 'Get ready: ' + ne.name + (nx.kind === 'reps' ? ' · set ' + nx.set + '/' + nx.sets : '');
      lastHype = ''; setHype(Math.round((i + 1) / st.length * 100) + '% done · ' + hype('rest'), false, true);
      $('#wLog').hidden = true;
      $('#wRx').innerHTML = chips([[fmt(sec), 'rest'], [ne.name.split(' (')[0], 'up next']]);
      $('#wDone').textContent = '⏭ Skip rest';
      $('#wMinus').hidden = $('#wPlus').hidden = false;
      $('#wSkip').hidden = true;
      $('#wNextLbl').textContent = 'While you rest: next exercise technique';
      Voice.cue('Rest ' + sec + ' seconds. Next up: ' + ne.name, Coach.has('rest_' + sec) ? ['rest_' + sec, 'next', 'ex_' + nx.id] : ['next', 'ex_' + nx.id]);
      draw();
    }

    function renderSplits() {
      var w = $('#wSplits'); if (!w) return;
      var rows = splits.filter(function (x) { return x.station; }).slice(-5);
      w.innerHTML = '<div class="label">Splits</div>' + rows.map(function (r) { return '<div class="split"><span>' + esc(r.name) + '</span><b>' + fmt(r.sec) + '</b></div>'; }).join('');
    }

    // single place that paints the ring + clocks
    function draw() {
      drawRing();
      $('#wMini small').textContent = $('#wRingTop').textContent;
      $('#wMini b').textContent = $('#wRingVal').textContent;
    }
    function drawRing() {
      $('#wClock').textContent = fmt(total);
      var s = st[i]; if (!s) return;
      var top = $('#wRingTop'), val = $('#wRingVal'), sub = $('#wRingSub');
      if (phase === 'rest') {
        top.textContent = 'REST'; val.textContent = fmt(remain); sub.textContent = 'of ' + fmt(restTotal);
        setRing('wRing', remain / restTotal);
        return;
      }
      if (s.kind === 'reps') {
        var tgt = s.item.reps[1], pr = Math.min(pacerReps(), tgt);
        top.textContent = s.sets > 1 ? 'SET ' + s.set + ' OF ' + s.sets : 'REPS'; val.textContent = pr; sub.textContent = 'pace guide · of ' + tgt + ' reps';   // the pacer counts the tempo, it does not see your reps
        setRing('wRing', pr / tgt);
        if (!pacerHit && tgt >= 6 && pr !== lastMilestone) {
          lastMilestone = pr;
          if (tgt >= 10 && pr === Math.floor(tgt / 2)) setHype(hype('half'));
          else if (pr === tgt - 2) { var h2 = hype('twoLeft'); setHype(h2, true); hypeVoice(h2); }
        }
        if (pr >= tgt && !pacerHit) {
          pacerHit = true; Audio.beep(1320, 0.2);
          if (!race) { $('#wDone').textContent = '💪 Nailed it'; var hh = hype('hit'); setHype(hh, true); hypeVoice(hh); }
          if (autoNext()) autoAt = elapsed + AUTO_GRACE;
          $('#wPhase').textContent = autoAt ? 'Target hit – rack it, moving on' : 'Target hit – press OK to finish';
        }
        if (autoAt) {
          var left = Math.max(0, Math.ceil(autoAt - elapsed));
          sub.textContent = 'next in ' + left + ' s';
          $('#wDone').textContent = '💪 Nailed it · next in ' + left + ' s';
        }
      } else if (s.kind === 'dist') {
        var est = s.dist * (ex(s.id).secPerM || 0.27);
        top.textContent = s.dist + ' m'; val.textContent = fmt(elapsed); sub.textContent = 'target ~' + fmt(est);
        setRing('wRing', elapsed / est);
      } else {
        top.textContent = s.hard ? 'HARD' : s.easy ? 'EASY' : race ? 'STATION' : 'TIME';
        val.textContent = fmt(remain);
        var e = ex(s.id);
        sub.textContent = e.type === 'cardio' && !/^(bike|row|hx_|airbike|rope_waves)/.test(s.id) ? '≈ ' + pacerReps() + ' reps at the pace guide' : 'of ' + fmt(s.sec);
        setRing('wRing', remain / s.sec);
      }
    }

    function tick() {
      if (paused || !st[i]) return;
      total += 0.25;
      autoView();
      if (phase === 'rest') {
        remain -= 0.25;
        if (remain <= 3.01 && remain > 0 && Math.abs(remain - Math.round(remain)) < 0.01) Audio.beep(880, 0.12);
        if (remain <= 0) { Audio.beep(1320, 0.3); enter(i + 1); return; }
      } else {
        elapsed += 0.25;
        var s = st[i];
        if (s.kind === 'reps' && autoAt && elapsed >= autoAt) { Audio.beep(1320, 0.3); completeWork(); return; }
        if (s.kind === 'time') {
          remain -= 0.25;
          if (remain <= 3.01 && remain > 0 && Math.abs(remain - Math.round(remain)) < 0.01) Audio.beep(880, 0.12);
          if (s.sec >= 60 && Math.abs(remain - s.sec / 2) < 0.01) { Voice.cue('Halfway.', ['half']); setHype(hype('half')); }
          if (s.sec >= 30 && Math.abs(remain - 10) < 0.01) { var ht = hype('tenLeft'); setHype(ht, true); hypeVoice(ht); }
          if (remain <= 0) { Audio.beep(1320, 0.3); completeWork(); return; }
        }
      }
      draw();
    }
    var iv = setInterval(tick, 250);

    // partial = ended early with the end button: saved and labelled as such, never "workout complete"
    function finish(partial) {
      partial = partial === true;
      clearInterval(iv);
      done = true; setView('form');
      var min = Math.max(1, Math.round(total / 60));
      if (logged.length || min >= 10) {
        Store.recordSession(state, { date: new Date().toISOString(), session: sess.key, name: sess.name, min: min, sec: Math.round(total), splits: race ? splits : undefined, sets: logged, items: itemsById, partial: partial || undefined });
      }
      if (partial) Voice.say('Workout saved.'); else Voice.cue('Great job. Workout complete.', ['done']);
      pl.stop(); nextPl.stop();
      var vol = logged.reduce(function (a, l) { return a + (ex(l.id).unit === 'kg' ? l.reps * l.load : 0); }, 0);
      var reps = logged.reduce(function (a, l) { return a + l.reps; }, 0);
      var kg = state.settings.weight, met = race || sess.goal === 'hyrox' ? 8 : /cardio/i.test(sess.name) ? 7 : 5;
      var kcal = kg ? Math.round(met * kg * total / 3600) : 0;
      clearTimeout(cheer.t); $('#wCheer').hidden = true;   // the finish card takes over
      var f = $('#wFinish');
      f.hidden = false;
      var weekN = state.log.filter(function (l) { return (Date.now() - new Date(l.date)) < 7 * 864e5; }).length;
      var plan = Program.PLANS[state.settings.days], wk = Me.weeksTo(state.settings);
      var proud = [weekN + ' of ' + plan.order.length + ' workouts this week' + (weekN >= plan.order.length ? ' – weekly goal hit 🎯' : '')];
      if (prs.length) proud.unshift('🏆 ' + prs.length + (prs.length === 1 ? ' personal best: ' : ' personal bests: ') + prs.map(function (id) { return ex(id).name.split(' (')[0]; }).join(', '));
      if (wk != null && wk >= 0) proud.push(wk + (wk === 1 ? ' week' : ' weeks') + ' to your target date');
      f.innerHTML = '<div class="fin-card"><div class="fin-burst"></div><div class="kicker">' + (partial ? 'ENDED EARLY · SAVED' : race ? 'RACE TIME' : 'WORKOUT COMPLETE') + '</div>' +
        (race && !partial ? '' : '<div class="fin-head">' + esc(partial ? 'Good start' : hype('done')) + ', ' + (window.I18N ? I18N.nm(state.name) : esc(state.name)) + '!</div>') + '<div class="fin-time">' + fmt(total) + '</div>' +
        '<div class="fin-proud">' + proud.map(function (t) { return '<div>' + esc(t) + '</div>'; }).join('') + '</div>' +
        '<div class="fin-stats"><div><b>' + logged.length + '</b><span>sets</span></div><div><b>' + reps + '</b><span>reps</span></div><div><b>' + Math.round(vol) + ' kg</b><span>volume</span></div>' + (kcal ? '<div><b>~' + kcal + '</b><span>kcal</span></div>' : '') + '</div>' +
        (race ? '<div class="splits fin-splits">' + splits.filter(function (x) { return x.station; }).map(function (r) { return '<div class="split"><span>' + esc(r.name) + '</span><b>' + fmt(r.sec) + '</b></div>'; }).join('') + '</div>' : '') +
        (function () {
          var tip = Products.pick(state, 'finish', 1, { cardio: race || /cardio|race/i.test(sess.name) })[0];
          return tip ? '<div class="fin-tip"><div class="label">Recover well</div>' + productCard(tip, 'post_workout', true) + '</div>' : '';
        })() +
        '<div class="fin-actions">' + (App.share ? '<button class="btn focusable" id="wShare">↗ Share</button>' : '') + '<button class="btn primary focusable" id="wHome">Home</button></div></div>';
      $('.side', el).hidden = true;
      el.classList.add('done');
      $('#wHome').onclick = function () { resetTo(window.__HOME || 'home'); };
      if ($('#wShare')) $('#wShare').onclick = function () {
        App.share({ kind: race ? 'race' : 'workout', eyebrow: race ? 'Hybrid race' : 'Workout complete', title: race ? fmt(total) : sess.name.split(' – ')[0],
          subtitle: race ? sess.name : (sess.name.split(' – ')[1] || '') + (sess.name.indexOf(' – ') > 0 ? ' · ' : '') + new Date().toLocaleDateString((window.I18N && I18N.locale || 'en-GB'), { weekday: 'short', day: 'numeric', month: 'short' }),
          stats: [[fmt(total), 'time'], [logged.length, 'sets'], vol ? [Math.round(vol).toLocaleString((window.I18N && I18N.locale || 'en-GB')) + ' kg', 'lifted'] : [reps, 'reps']],
          badge: prs.length ? '🏆 ' + prs.length + (prs.length === 1 ? ' personal best' : ' personal bests') : '',
          caption: (race ? 'Hybrid race simulation done in ' + fmt(total) : sess.name + ' done – ' + logged.length + ' sets in ' + fmt(total)) + ' 💪' + (prs.length ? ' New personal best!' : ''),
          tags: ['#FinestMe', '#NaturesFinest', race ? '#hybridrace' : '#homeworkout'] });
      };
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
      paused = !paused; this.textContent = paused ? 'Resume' : 'Pause';
      el.classList.toggle('paused', paused);
      if (paused) pl.stop(); else pl.start();
    };
    $('#wExit').onclick = function () {
      // nothing done yet: leave without a record or a "workout complete" card
      if (!logged.length && total < 60) { ask('Leave without saving? Nothing has been recorded yet.', 'Leave', leaveUnsaved); return; }
      ask('End the workout now? The sets you completed are saved.', 'End and save', function () { finish(true); });
    };
    function leaveUnsaved() {
      clearInterval(iv); done = true; pl.stop(); nextPl.stop();
      activeSession.confirmExit = null;
      resetTo(window.__HOME || 'home');
    }

    activeSession = {
      onKey: function (code) {
        if (isKey(code, 'PLAY')) { $('#wPause').click(); return true; }
        return false;
      },
      confirmExit: function (leave) { ask('Leave workout? Unsaved sets will be lost.', 'Leave', leave); },
      destroy: function () { clearInterval(iv); el.remove(); Sound.session(false); if ('speechSynthesis' in window) speechSynthesis.cancel(); }
    };
    enter(0);
    // "Get ready" 3-2-1 before the clock starts (the first exercise already plays behind it); tap to skip.
    // Automated tests skip it unless they ask for it (window.__readyCountdown).
    if (navigator.webdriver && !window.__readyCountdown) return;
    paused = true;
    var rd = document.createElement('div'); rd.className = 'ready'; el.appendChild(rd);
    var rn = 3, go = function () { if (!rd.isConnected) return; rd.remove(); paused = false; Audio.beep(1320, 0.2); };
    (function count() {
      if (!rd.isConnected) return;
      if (!rn) return go();
      rd.innerHTML = '<div><span>Get ready</span><b>' + rn + '</b></div>'; Audio.beep(880, 0.08); rn--;
      setTimeout(count, 1000);
    })();
    rd.onclick = go;
  };

  // ---------------------------------------------------------------- first visit: what do you want to start?
  // Value first: a product or a supplement routine needs no training profile (a quiet local one is made);
  // the training questions come only with "Training & movement".
  SCREENS.welcome = function () {
    function quiet() { var me = Store.addProfile(Store.newProfile('Me')); me.settings.qr = true; Store.save(); state = Store.setActive(me.id); }
    root.innerHTML = '<div class="screen welcome-screen"><div class="topbar">' + brandMark() + '<div class="spacer"></div>' + (window.I18N ? '🌐 ' + I18N.select('wlLang') : '') + '</div>' +
      '<div class="wl-head"><h1>What would you like to start?</h1><p class="hint">Pick one – you can add the others any time.</p></div>' +
      '<div class="wl-list">' +
      '<button class="wl-opt focusable" data-wl="scan" data-autofocus><span class="wl-ico">📷</span><div><b>I have a Nature’s Finest product</b><small>scan the pack – how to use it, your daily routine and rewards</small></div><span class="set-chev">›</span></button>' +
      '<button class="wl-opt focusable" data-wl="routine"><span class="wl-ico">🌿</span><div><b>A daily supplement routine</b><small>what to take and when – I’ll remind you and count with you</small></div><span class="set-chev">›</span></button>' +
      '<button class="wl-opt focusable" data-wl="train"><span class="wl-ico">🏋️</span><div><b>Training & movement</b><small>home and gym workouts, walks, runs and rides – built for your equipment</small></div><span class="set-chev">›</span></button>' +
      '</div><p class="hint wl-note">🔒 Everything stays on this device. Create a free account any time to keep it on your phone and computer.</p></div>';
    $$('[data-wl]').forEach(function (b) {
      b.onclick = function () {
        var w = b.getAttribute('data-wl');
        if (w === 'train') { go('profileEdit', {}); return; }
        quiet(); resetTo('home'); go(w === 'scan' ? 'scan' : 'routine', {});
      };
    });
  };

  // ---------------------------------------------------------------- profiles ("Kdo trenira?")
  SCREENS.profiles = function () {
    var list = Store.list();
    var lastId = (Store.active() || {}).id;
    root.innerHTML = '<div class="screen center">' + brandMark('big-brand') + '<h1 class="who-title">Who’s training?</h1><div class="profiles">' +
      list.map(function (pr, i) {
        return '<button class="profile focusable" data-pid="' + pr.id + '"' + (pr.id === lastId || (!lastId && i === 0) ? ' data-autofocus' : '') + '>' + avatar(pr, true) +
          '<b>' + esc(pr.name) + '</b><span>' + (pr.pin ? '🔒 ' : '') + pl(pr.log.length, TRN) + '</span></button>';
      }).join('') +
      '<button class="profile add focusable" data-go="profileEdit"><span class="avatar big">＋</span><b>Add person</b><span>new profile</span></button></div>' +
      '<div class="hint">Everyone gets their own program, weights, progress and settings.</div></div>';
    $$('[data-pid]').forEach(function (b) {
      b.onclick = function () {
        var pr = Store.list().filter(function (x) { return x.id === b.getAttribute('data-pid'); })[0];
        if (pr.pin) go('pin', { id: pr.id }); else activate(pr);
      };
    });
  };

  function activate(pr) {
    state = Store.setActive(pr.id);
    resetTo(window.__HOME || 'home');   // __HOME: test hook – the Gym tests start on the Gym tab
    toast('Hi, ' + pr.name + '!');
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
    root.innerHTML = '<div class="screen center">' + avatar(pr, true) + '<h1>' + esc(pr.name) + '</h1><div class="hint">Enter PIN</div><div class="dots" id="dots"></div>' + keypad() +
      (p.quick ? '<button class="btn ghost sm focusable" data-go="profiles">Not ' + esc(pr.name) + '? Choose person</button>' : '') + '</div>';
    function draw() { $('#dots').innerHTML = [0, 1, 2, 3].map(function (i) { return '<i' + (i < pin.length ? ' class="on"' : '') + '></i>'; }).join(''); }
    function check() {
      if (Store.checkPin(pr, pin)) activate(pr);
      else { toast('Wrong PIN'); pin = ''; draw(); }
    }
    bindKeypad(function (d) { if (pin.length < 4) { pin += d; draw(); if (pin.length === 4) setTimeout(check, 150); } },
      function () { pin = pin.slice(0, -1); draw(); }, check);
    draw();
  };

  // ---------------------------------------------------------------- personal profile: goals, body, heart rate
  var GOALS = [
    { k: 'muscle', ico: '💪', name: 'Build muscle', sub: 'Hypertrophy · 8–12 reps, steady progression' },
    { k: 'strength', ico: '🏋️', name: 'Get stronger', sub: 'Heavier main lifts · 3–6 reps, longer rest' },
    { k: 'fatloss', ico: '🔥', name: 'Lose fat', sub: 'Shorter rest · extra intervals' },
    { k: 'endurance', ico: '🚴', name: 'Endurance', sub: 'Higher reps · longer cardio' },
    { k: 'hyrox', ico: '🏁', name: 'Hybrid race', sub: 'Race-pace conditioning · stations' },
    { k: 'general', ico: '🌿', name: 'Stay fit & healthy', sub: 'Balanced strength + cardio' }
  ];
  var GOAL_BY = {}; GOALS.forEach(function (g) { GOAL_BY[g.k] = g; });
  var LIMITS = [['knee', 'Knees'], ['back', 'Lower back'], ['shoulder', 'Shoulders'], ['wrist', 'Wrists']];
  var Me = {
    age: function (s) { return s.birthYear ? new Date().getFullYear() - s.birthYear : null; },
    bmi: function (s) { return s.height && s.weight ? s.weight / Math.pow(s.height / 100, 2) : null; },
    // Tanaka formula unless the person entered a measured max
    maxHr: function (s) { var a = Me.age(s); return s.maxHr || (a ? Math.round(208 - 0.7 * a) : null); },
    // Karvonen (heart-rate reserve) when resting HR is known, else % of max
    zone: function (s, lo, hi) {
      var mx = Me.maxHr(s); if (!mx) return null;
      var rest = s.restHr || 0, base = rest ? mx - rest : mx;
      return [Math.round(rest + base * lo), Math.round(rest + base * hi)];
    },
    weeksTo: function (s) { return s.targetDate ? Math.ceil((new Date(s.targetDate) - new Date()) / 6048e5) : null; }
  };
  var ZONES = [['Z1', 'Recovery', .5, .6], ['Z2', 'Endurance', .6, .7], ['Z3', 'Tempo', .7, .8], ['Z4', 'Threshold', .8, .9], ['Z5', 'Max', .9, 1]];

  var pdraft = null;
  SCREENS.profileEdit = function (p) {
    var existing = p.id ? Store.list().filter(function (x) { return x.id === p.id; })[0] : null;
    if (!pdraft || pdraft.for !== (p.id || 'new')) {
      var es = existing ? existing.settings : {};
      pdraft = {
        for: p.id || 'new',
        name: existing ? existing.name : '',
        color: existing ? existing.color : Store.COLORS[Store.list().length % Store.COLORS.length],
        level: es.level || 'mid', days: es.days || 3,
        goal: es.goal || 'general', why: es.why || '', targetWeight: es.targetWeight || null, targetDate: es.targetDate || null,
        sex: es.sex || null, birthYear: es.birthYear || null, height: es.height || null, weight: es.weight || null,
        maxHr: es.maxHr || null, restHr: es.restHr || null,
        limits: (es.limits || []).slice(), prefDays: (es.prefDays || []).slice(), sessionMin: es.sessionMin || null,
        pin: null, clearPin: false, more: !!existing,
        // new people: most own no equipment, so bodyweight is the default unless they share this household's gear
        eqMode: existing ? 'custom' : state ? 'same' : 'bw',
        equipment: (existing ? es.equipment : (state ? state.settings.equipment : null) || Exercises.HOME_GYM).slice()
      };
    }
    var d = pdraft;
    function chip(key, val, label) {
      return '<button class="chip focusable' + (d[key] === val ? ' on' : '') + '" data-fid="pe-' + key + '-' + val + '" data-pe="' + key + '" data-val=\'' + JSON.stringify(val) + '\'>' + label + '</button>';
    }
    function multi(key, val, label) {
      return '<button class="chip focusable' + (d[key].indexOf(val) >= 0 ? ' on' : '') + '" data-fid="pe-' + key + '-' + val + '" data-pm="' + key + '" data-val=\'' + JSON.stringify(val) + '\'>' + label + '</button>';
    }
    // TV-friendly number entry: − value +; the first press on an empty value jumps to a sensible default
    function num(key, label, unit, step) {
      var v = key === 'age' ? Me.age(d) : key === 'maxHr' ? Me.maxHr(d) : d[key];
      return '<div class="pfield"><div class="k">' + label + '</div><div class="stepper sm"><button class="focusable" data-fid="pe-' + key + '-m" data-ps="' + key + '" data-d="-' + step + '">−</button>' +
        '<div class="val"><input class="num-in focusable" type="text" inputmode="decimal" autocomplete="off" data-fid="pe-' + key + '-in" data-pi="' + key + '" step="' + step + '" placeholder="—" value="' + (v == null ? '' : v) + '"><small>' + unit + '</small></div>' +
        '<button class="focusable" data-fid="pe-' + key + '-p" data-ps="' + key + '" data-d="' + step + '">+</button></div></div>';
    }
    var age = Me.age(d), bmi = Me.bmi(d), z2 = Me.zone(d, .6, .7), mx = Me.maxHr(d), wk = Me.weeksTo(d), g = GOAL_BY[d.goal];
    var toGo = d.weight && d.targetWeight ? Math.round((d.targetWeight - d.weight) * 10) / 10 : null;
    var summary = '<div class="me-card"><div class="me-id"><span class="avatar big" style="background:' + d.color + '">' + esc((d.name || '?').charAt(0).toUpperCase()) + '</span>' +
      '<div><h2>' + esc(d.name || 'New person') + '</h2><div class="me-goal">' + g.ico + ' ' + esc(g.name) + (wk != null && wk >= 0 ? ' · <b>' + pl(wk, ['week', 'weeks']) + ' to go</b>' : '') + '</div>' +
      (d.why ? '<div class="me-why">“' + esc(d.why) + '”</div>' : '') + '</div></div>' +
      '<div class="me-stats">' +
      '<div><b>' + (age || '—') + '</b><span>age</span></div>' +
      '<div><b>' + (d.weight ? d.weight + '<small> kg</small>' : '—') + '</b><span>weight</span></div>' +
      '<div><b>' + (bmi ? bmi.toFixed(1) : '—') + '</b><span>BMI</span></div>' +
      '<div><b>' + (toGo != null ? (toGo > 0 ? '+' : '') + toGo + '<small> kg</small>' : '—') + '</b><span>to target</span></div>' +
      '<div><b>' + (z2 ? z2[0] + '–' + z2[1] : '—') + '</b><span>Zone 2 bpm</span></div></div></div>';

    var goalTiles = '<div class="goal-grid">' + GOALS.map(function (x) {
      return '<button class="goal-tile focusable' + (d.goal === x.k ? ' on' : '') + '" data-fid="pe-goal-' + x.k + '" data-pe="goal" data-val=\'"' + x.k + '"\'><span class="gi">' + x.ico + '</span><b>' + x.name + '</b><small>' + x.sub + '</small></button>';
    }).join('') + '</div>';

    var basics = '<div class="panel"><h3>Who’s training</h3>' +
      '<div class="opt-row"><div class="k">Name</div><input class="field focusable" id="pName" data-fid="pe-name" maxlength="20" placeholder="e.g. Alex" value="' + esc(d.name) + '"' + (existing ? '' : ' data-autofocus') + '></div>' +
      '<div class="opt-row"><div class="k">Color</div>' + Store.COLORS.map(function (c) {
        return '<button class="swatch focusable' + (d.color === c ? ' on' : '') + '" data-fid="pe-color-' + c + '" data-pe="color" data-val=\'"' + c + '"\' style="background:' + c + '"></button>';
      }).join('') + '</div>' +
      '<div class="opt-row"><div class="k">Training level</div>' + chip('level', 'beg', 'Beginner') + chip('level', 'mid', 'Intermediate') + chip('level', 'adv', 'Advanced') + '</div>' +
      (existing ? '' : '<div class="opt-row"><div class="k">Equipment</div>' + chip('eqMode', 'bw', '🤸 None – just my body') +
        (state ? chip('eqMode', 'same', 'Same as ' + esc(state.name)) : '') + chip('eqMode', 'pick', 'I have some – let me pick') +
        (d.eqMode === 'custom' ? chip('eqMode', 'custom', pl(d.equipment.length, NAP) + ' selected') : '') + '</div>') + '</div>';

    var goalPanel = '<div class="panel"><h3>Your goal</h3><div class="hint">Shapes your program: reps, rest, sets and cardio.</div>' + goalTiles +
      (d.more ? '<div class="pgrid">' + num('targetWeight', 'Target weight', 'kg', 0.5) +
        '<div class="pfield"><div class="k">Target date' + (d.goal === 'hyrox' ? ' (race day)' : '') + '</div><input class="field focusable" type="date" id="pDate" data-fid="pe-date" value="' + esc(d.targetDate || '') + '"></div></div>' +
        '<div class="opt-row"><div class="k">My why</div><input class="field focusable wide" id="pWhy" data-fid="pe-why" maxlength="80" placeholder="e.g. Finish my first hybrid race under 1:30" value="' + esc(d.why) + '"></div>' : '') + '</div>';

    var more = !d.more ? '<div class="opt-row"><button class="btn ghost focusable" id="pMore" data-fid="pe-more">More: body, training, heart rate, limitations, PIN ▾</button></div>' :
      '<div class="pe-cols"><div class="panel"><h3>About you</h3><div class="hint">Used for calories, heart-rate zones and BMI. Stays on this device.</div>' +
      '<div class="opt-row"><div class="k">Sex</div>' + chip('sex', 'm', 'Male') + chip('sex', 'f', 'Female') + chip('sex', null, 'Prefer not to say') + '</div>' +
      '<div class="pgrid">' + num('age', 'Age', 'years', 1) + num('height', 'Height', 'cm', 1) + num('weight', 'Body weight', 'kg', 0.5) + '</div></div>' +

      '<div class="panel"><h3>Training</h3>' +
      '<div class="opt-row"><div class="k">Workouts per week</div>' + chip('days', 3, '3× – full body') + chip('days', 4, '4× – upper / lower') + '</div>' +
      '<div class="opt-row"><div class="k">Preferred days</div>' + [1, 2, 3, 4, 5, 6, 0].map(function (n) { return multi('prefDays', n, DAYN[n]); }).join('') + '</div>' +
      '<div class="opt-row"><div class="k">Session length</div>' + chip('sessionMin', 30, '30 min') + chip('sessionMin', 45, '45 min') + chip('sessionMin', 60, '60 min') + chip('sessionMin', 75, '75 min') + chip('sessionMin', null, 'No limit') + '</div>' +
      '<div class="opt-row"><div class="k">Equipment</div><div class="eq-strip">' + d.equipment.slice(0, 9).map(function (k) { return '<span class="eq-mini" title="' + esc(Exercises.EQUIP[k].name) + '">' + equipIcon(k) + '</span>'; }).join('') +
      '</div><button class="btn sm focusable" id="pEquip" data-fid="pe-equip">' + pl(d.equipment.length, NAP) + ' · edit →</button></div></div>' +

      '<div class="panel"><h3>Heart rate</h3><div class="hint">Max HR is estimated from age (208 − 0.7 × age) unless you enter a measured value.</div>' +
      '<div class="pgrid">' + num('maxHr', 'Max HR' + (d.maxHr ? '' : ' (est.)'), 'bpm', 1) + num('restHr', 'Resting HR', 'bpm', 1) + '</div>' +
      (mx ? '<div class="zones">' + ZONES.map(function (z) {
        var r = Me.zone(d, z[2], z[3]);
        return '<div class="zone z' + z[0].charAt(1) + '"><b>' + z[0] + '</b><span>' + z[1] + '</span><em>' + r[0] + '–' + r[1] + '</em></div>';
      }).join('') + '</div>' : '<div class="hint">Add your age to see your training zones.</div>') + '</div>' +

      '<div class="panel"><h3>Limitations</h3><div class="hint">Exercises that load these joints are swapped for gentler options from the same movement pattern.</div>' +
      '<div class="opt-row">' + LIMITS.map(function (l) { return multi('limits', l[0], l[1]); }).join('') + '</div></div>' +

      '<div class="panel"><h3>Privacy</h3><div class="opt-row"><div class="k">PIN (optional)</div><input class="field focusable" id="pPin" data-fid="pe-pin" type="password" inputmode="numeric" maxlength="4" placeholder="4 digits" value="' + esc(d.pin || '') + '">' +
      (existing && existing.pin ? '<button class="chip focusable' + (d.clearPin ? ' on' : '') + '" data-fid="pe-clear" id="pClear">Remove PIN</button>' : '') +
      '<span class="hint">Locks the profile on a shared TV (privacy, not security).</span></div></div></div>';

    root.innerHTML = '<div class="screen pe"><div class="topbar"><h1>' + (existing ? 'Profile' : Store.list().length ? 'New person' : 'Welcome – who’s training?') + '</h1>' + (existing || !window.I18N ? '' : '<div class="spacer"></div>🌐 ' + I18N.select('peLang')) + '</div>' +
      (Store.list().length || existing ? '' : '<div class="hint">Everyone in your household gets their own profile: program, weights, progress.</div>') +
      summary + basics + goalPanel + more +
      '<div class="nav-row sticky-save"><button class="btn primary focusable" id="pSave">' + (existing ? 'Save profile' : 'Create profile') + '</button>' +
      (Store.list().length ? '<button class="btn ghost focusable" id="pCancel">Cancel</button>' : '') +
      (existing && Store.list().length > 1 ? '<button class="btn ghost focusable danger" id="pDel">Delete person</button>' : '') + '</div></div>';

    function readInputs() {
      d.name = $('#pName').value.trim();
      if ($('#pPin')) d.pin = $('#pPin').value.trim() || null;
      if ($('#pWhy')) d.why = $('#pWhy').value.trim();
      if ($('#pDate')) d.targetDate = $('#pDate').value || null;
      $$('[data-pi]').forEach(function (inp) {
        var k = inp.getAttribute('data-pi'), v = inp.value === '' ? null : parseFloat(String(inp.value).replace(',', '.'));
        if (v != null && (isNaN(v) || v < LIM[k][0] || v > LIM[k][1])) return;
        if (k === 'age') d.birthYear = v == null ? null : new Date().getFullYear() - Math.round(v);
        else if (k === 'maxHr') d.maxHr = v === Me.maxHr({ birthYear: d.birthYear }) ? d.maxHr : v;
        else d[k] = v;
      });
    }
    $$('[data-pi]').forEach(function (inp) { inp.onchange = function () { readInputs(); refresh(); }; });
    if ($('#pMore')) $('#pMore').onclick = function () { readInputs(); d.more = true; refresh(); };
    $$('[data-pe]').forEach(function (b) {
      b.onclick = function () { readInputs(); d[b.getAttribute('data-pe')] = JSON.parse(b.getAttribute('data-val')); refresh(); };
    });
    $$('[data-pm]').forEach(function (b) {
      b.onclick = function () {
        readInputs();
        var list = d[b.getAttribute('data-pm')], v = JSON.parse(b.getAttribute('data-val')), at = list.indexOf(v);
        if (at >= 0) list.splice(at, 1); else list.push(v);
        refresh();
      };
    });
    var DEF = { age: 35, height: 175, weight: 75, restHr: 60 };
    var LIM = { age: [12, 95], height: [120, 220], weight: [30, 250], targetWeight: [30, 250], maxHr: [120, 220], restHr: [35, 110] };
    $$('[data-ps]').forEach(function (b) {
      b.onclick = function () {
        readInputs();
        var k = b.getAttribute('data-ps'), dv = parseFloat(b.getAttribute('data-d'));
        var cur = k === 'age' ? Me.age(d) : k === 'maxHr' ? Me.maxHr(d) : d[k];
        if (cur == null && (k === 'targetWeight' || k === 'maxHr')) cur = k === 'maxHr' ? 185 : (d.weight || 75);
        if (cur == null) cur = DEF[k];
        else cur = Math.round((cur + dv) * 10) / 10;
        cur = Math.min(LIM[k][1], Math.max(LIM[k][0], cur));
        if (k === 'age') d.birthYear = new Date().getFullYear() - cur; else d[k] = cur;
        refresh();
      };
    });
    if ($('#pClear')) $('#pClear').onclick = function () { readInputs(); d.clearPin = !d.clearPin; refresh(); };
    if ($('#pEquip')) $('#pEquip').onclick = function () { readInputs(); eqDraft = null; d.eqMode = 'custom'; go('equipment', { draft: true }); };
    $('#pSave').onclick = function () {
      readInputs();
      if (!d.name) { toast('Enter a name'); $('#pName').focus(); return; }
      if (d.pin && !/^\d{4}$/.test(d.pin)) { toast('PIN must be 4 digits'); $('#pPin').focus(); return; }
      var pr = existing || Store.addProfile(Store.newProfile());
      var ps = pr.settings;
      pr.name = d.name; pr.color = d.color;
      ['level', 'days', 'goal', 'why', 'targetWeight', 'targetDate', 'sex', 'birthYear', 'height', 'maxHr', 'restHr', 'sessionMin'].forEach(function (k) { ps[k] = d[k]; });
      ps.limits = d.limits.slice(); ps.prefDays = d.prefDays.slice();
      ps.equipment = d.eqMode === 'bw' || d.eqMode === 'pick' ? [] : d.eqMode === 'same' && state ? (state.settings.equipment || []).slice() : d.equipment.slice();
      if (d.weight !== ps.weight) logWeight(pr, d.weight);
      if (d.pin) Store.setPin(pr, d.pin); else if (d.clearPin) Store.setPin(pr, null);
      Store.save();
      pdraft = null;
      if (existing && state && existing.id === state.id) { toast('Profile saved'); back(); }
      else if (!existing) { eqDraft = null; activate(pr); if (d.eqMode === 'pick') go('equipment', { onboard: true }); }
      else activate(pr);
    };
    if ($('#pCancel')) $('#pCancel').onclick = function () { pdraft = null; back(); };
    if ($('#pDel')) $('#pDel').onclick = function () {
      ask('Delete ' + existing.name + '’s profile and all their history?', 'Delete', function () {
        Store.removeProfile(existing.id);
        pdraft = null; state = null;
        resetTo('profiles');
      });
    };
  };
  // one body-weight entry per day; the latest entry is the current weight
  function logWeight(pr, kg) {
    var s = pr.settings; s.weight = kg;
    if (kg == null) return;
    var today = new Date().toISOString().slice(0, 10);
    s.bodyLog = (s.bodyLog || []).filter(function (x) { return x.date !== today; });
    s.bodyLog.push({ date: today, kg: kg });
    s.bodyLog.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }

  // ---------------------------------------------------------------- equipment ("Moja oprema")
  function equipIcon(k) { return Figure.icon(Exercises.EQUIP[k].icon); }
  function exCountFor(k) { return Exercises.LIST.filter(function (e) { return e.equip.indexOf(k) >= 0; }).length; }
  function unlocked(list) { return Exercises.LIST.filter(function (e) { return Exercises.available(e.id, list); }).length; }
  var EQ_PRESETS = [
    { id: 'home', name: 'Home gym', list: function () { return Exercises.HOME_GYM.slice(); } },
    { id: 'bw', name: 'Bodyweight only', list: function () { return []; } },
    { id: 'all', name: 'Fully equipped gym', list: function () { return Object.keys(Exercises.EQUIP).filter(function (k) { return !Exercises.EQUIP[k].always; }); } }
  ];

  var eqDraft = null;
  SCREENS.equipment = function (p) {
    var target = p.draft && pdraft ? pdraft : state.settings;
    if (!eqDraft || eqDraft.key !== (p.draft ? 'draft' : state.id)) {
      eqDraft = { key: p.draft ? 'draft' : state.id, list: (target.equipment || Exercises.HOME_GYM).slice() };
    }
    var list = eqDraft.list;
    var total = Exercises.LIST.length, un = unlocked(list);
    var who = p.draft ? (pdraft.name || 'New person') : state.name;
    var html = '<div class="screen eq-screen"><div class="eq-head"><div><div class="kicker">' + (p.onboard ? 'Step 2 of 2 · ' : '') + 'Profile · ' + esc(who) + '</div>' +
      '<h1>My equipment</h1><p>Select everything you have access to – at home or at your gym. Your program, race simulations and the workout builder only use what you select, and swap missing exercises for equivalent ones.</p></div>' +
      '<div class="eq-score"><div class="eq-num"><b>' + list.length + '</b><span>' + pl(list.length, NAP).replace(/^\d+ /, '') + '</span></div><div class="eq-num"><b>' + un + '<small>/' + total + '</small></b><span>exercises unlocked</span></div>' +
      '<div class="eq-bar"><i style="width:' + Math.round(un / total * 100) + '%"></i></div></div></div>' +
      '<div class="filters"><span class="flabel">Quick select</span>' + EQ_PRESETS.map(function (pr) {
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
    html += '<div class="eq-foot"><div class="hint">Bodyweight is always included (' + pl(exCountFor('floor'), VAJ) + ').</div><div class="spacer"></div>' +
      (p.onboard ? '' : '<button class="btn ghost focusable" id="eqCancel">Cancel</button>') +
      '<button class="btn primary focusable" id="eqSave" data-fid="eq-save">' + (p.onboard ? 'Start training →' : 'Save equipment') + '</button></div></div>';
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
      if (!p.draft) { Store.save(); toast('Equipment saved · ' + pl(unlocked(list), VAJ) + ' available'); }
      if (p.onboard) resetTo(window.__HOME || 'home'); else back();
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
    var html = '<div class="screen"><div class="ov-head"><div><div class="chip on" style="display:inline-block;margin-bottom:.6rem">Custom</div><h1>Build workout</h1>' +
      '<p>' + esc(src.name) + ' · ~' + mins + ' min</p></div><div class="spacer"></div>' +
      '<button class="btn ghost focusable" id="bSave" data-fid="b-save">☆ Save</button>' +
      '<button class="btn focusable" id="bPrev" data-fid="b-prev">📺 Preview</button>' +
      '<button class="btn primary focusable" id="bGo" data-fid="b-go">▶ Start</button></div>' +
      '<div class="panel builder">' +
      '<div class="opt-row"><div class="k">Type</div>' + chip('type', 'moc', 'Strength', o.type === 'moc') + chip('type', 'kardio', 'Cardio', o.type === 'kardio') + chip('type', 'mix', 'Strength + cardio', o.type === 'mix') + chip('type', 'hyrox', 'Hybrid race', o.type === 'hyrox') + '</div>';
    if (o.type === 'hyrox') {
      html += '<div class="opt-row"><div class="k">Format</div>' + chip('format', 'full', 'Full simulation (8 stations)', o.format === 'full') +
        chip('format', 'half', 'Half (4 stations)', (o.format || 'half') === 'half') + chip('format', 'stations', 'Station training', o.format === 'stations') + '</div>' +
        '<div class="hint">Substitutions: run → bike · ski machine → cable pull · sled push → standing bike (heavy resistance) · sled pull → cable hand-over-hand · wall balls → DB thruster · sandbag → KB lunges. Volume scales to your level.</div>';
    } else if (o.type !== 'kardio') {
      var all = ALL_FOCUS.every(function (f) { return o.focus.indexOf(f) >= 0; });
      html += '<div class="opt-row"><div class="k">Focus <span class="hint">(multi-select)</span></div>' + chip('focus', 'all', 'Full body', all) +
        ALL_FOCUS.map(function (f) { return chip('focus', f, Exercises.FOCUS[f].name, !all && o.focus.indexOf(f) >= 0); }).join('') + '</div>';
    } else {
      var mach = Program.cardioMachines(o.owned);
      html += '<div class="opt-row"><div class="k">Machine</div>' + (mach.length > 1 ? chip('machine', 'all', 'Mixed', !o.machine || o.machine === 'all' || o.machine === 'both') : '') +
        mach.map(function (k) { return chip('machine', k, '<span class="chip-ico">' + (k === 'floor' ? equipIcon('floor') : equipIcon(k)) + '</span>' + Program.MACHINES[k].name, o.machine === k); }).join('') + '</div>' +
        '<div class="opt-row"><div class="k">Intensity</div>' + chip('intensity', 'z2', 'Easy – Zone 2', o.intensity === 'z2') + chip('intensity', 'hiit', 'Intervals', o.intensity === 'hiit') + chip('intensity', 'mix', 'Mixed', o.intensity === 'mix') + '</div>';
    }
    if (o.type !== 'hyrox') html += '<div class="opt-row"><div class="k">Duration</div>' + [20, 30, 45, 60].map(function (m) { return chip('min', m, m + ' min', o.min === m); }).join('') + '</div>';
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
          '<div class="rx">' + rxHtml(it) + (it.sug ? '<small>' + esc(loadTxt(e, it.sug.load)) + '</small>' : '') + '</div>' +
          '<div class="row-actions">' + (canSwap ? '<button class="btn sm focusable" data-fid="sw-' + r + '" data-swap="' + sid + '">⇄ Swap</button>' : '') +
          '<button class="btn sm ghost focusable" data-fid="rm-' + r + '" data-rm="' + sid + '" aria-label="Remove" title="Remove">✕</button></div></div>';
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
        if (n <= 1) { toast('A workout needs at least one exercise'); return; }
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
      toast('Saved – you’ll find it on the home screen');
    };
  };

  // ---------------------------------------------------------------- boot
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
  window.__go = function (screen, params) { go(screen, params); };   // test hook (tools/*.cjs)
  // module API: feature modules (sport tracker now; body tracker, supplement routine next) register
  // screens and home/progress panels without touching the core
  var App = window.App = {
    SCREENS: SCREENS, hooks: { train: [], progress: [], settings: [] },
    go: go, back: back, refresh: refresh, resetTo: resetTo, toast: toast, ask: ask, esc: esc, fmt: fmt, pl: pl, $: $, $$: $$,
    state: function () { return state; }, save: function () { Store.save(); },
    // after cloud data arrived: re-pick the active person and redraw (the profile object may be new)
    reload: function () { state = Store.active() || Store.list()[0] || null; if (state) Store.setActive(state.id); if (!state) resetTo('welcome', {}); else if (stack.length) refresh(); },
    keepAwake: keepAwake, say: function (t) { Voice.say(t); }, beep: function (f, d) { Audio.beep(f, d); },
    // recorded coach when EVERY clip of the phrase exists (numbers must not have gaps), device voice otherwise
    cue: function (t, keys) { if (keys.every(function (k) { return Coach.has(k); })) Voice.cue(t, keys); else Voice.say(t); },
    session: function (o) { activeSession = o; }, onCleanup: function (f) { cleanup.push(f); }, isKey: isKey, TOUCH: TOUCH,
    logWeight: function (kg) { logWeight(state, kg); Store.save(); },
    startCustom: startCustom,
    ui: { navBar: navBar, avatar: avatar, brandMark: brandMark, homeProducts: homeProducts, goalLine: goalLine, weeksStreak: weeksStreak, photo: photo, sessionPhoto: sessionPhoto, DAYN: DAYN, GOAL_BY: GOAL_BY }
  };
  (window.FS_MODULES || []).forEach(function (m) { try { m(App); } catch (e) { console.error(e); } });
  if (!SCREENS.home) SCREENS.home = SCREENS.train;
  (function boot() {
    // Fast login: this device remembers who trained last – straight in (or straight to their PIN)
    var list = Store.list(), last = Store.active(), qr = null;
    // a new device: take the language the profile chose elsewhere (synced with the account)
    try { if (window.I18N && last && last.settings.lang && !localStorage.getItem('fs.lang') && last.settings.lang !== I18N.lang) { I18N.set(last.settings.lang); return; } } catch (e) {}
    try { qr = sessionStorage.getItem('fs.product'); } catch (e) {}
    // value before account: a scanned pack opens its guide at once – a quiet local profile is made for the routine
    if (!list.length && qr) { var me = Store.addProfile(Store.newProfile('Me')); me.settings.qr = true; Store.save(); state = Store.setActive(me.id); resetTo('home'); }
    else if (!list.length) go('welcome', {});
    else if (last && !last.pin) { state = last; go(window.__HOME || 'home'); }
    else if (last) go('pin', { id: last.id, quick: true });
    else if (list.length === 1 && !list[0].pin) { state = Store.setActive(list[0].id); go(window.__HOME || 'home'); }
    else go('profiles');
  })();
})();
