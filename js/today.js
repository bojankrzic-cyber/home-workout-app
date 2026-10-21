/*
 * Today – the personal home: a buddy ("Finn") that greets, reminds and cheers, and one checklist
 * for the day built from everything the platform knows:
 *   supplements from the person's routine (by time of day, training days only where it fits),
 *   today's workout or – on rest days – easy movement, a weekly weigh-in.
 * Plus the central ＋ Start menu: Trail (GPS + any sport) · Gym (workouts) · Health (supplements,
 * body weight; QR product scans and the body tracker plug in here next).
 *
 * Routine data lives in the profile settings (so it syncs with the account):
 *   settings.routine = [{ id, pid (catalog id | null), name, dose, slot, days: 'daily'|'training' }]
 *   settings.intake  = { 'YYYY-MM-DD': { itemId: ISO time taken } }   (kept 60 days)
 */
(window.FS_MODULES = window.FS_MODULES || []).push(function (App) {
  'use strict';
  var $ = App.$, $$ = App.$$, esc = App.esc, U = App.ui, P = window.Products, T = window.Track;
  function st() { return App.state(); }

  var SLOTS = [
    { k: 'morning', name: 'Morning', ico: '☀️', at: 7 },
    { k: 'midday', name: 'Midday', ico: '🌤️', at: 12 },
    { k: 'pre', name: 'Before training', ico: '⚡', at: null },
    { k: 'post', name: 'After training', ico: '🥤', at: null },
    { k: 'evening', name: 'Evening', ico: '🌙', at: 18 },
    { k: 'bed', name: 'Before bed', ico: '😴', at: 21 }
  ];
  var SLOT = {}; SLOTS.forEach(function (x, i) { SLOT[x.k] = Object.assign({ i: i }, x); });

  function ymd(d) { d = d || new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function plannedDay(s, d) {
    var pref = s.settings.prefDays || [], plan = Program.PLANS[s.settings.days] || Program.PLANS[3];
    return pref.length ? pref.indexOf(d.getDay()) >= 0 : plan.days.indexOf(d.getDay()) >= 0;
  }
  function workedOut(s, ds) { return s.log.some(function (l) { return ymd(new Date(l.date)) === ds; }); }
  function moved(s, ds) { return (s.activities || []).some(function (a) { return ymd(new Date(a.start)) === ds; }); }
  function routine(s) { return s.settings.routine || []; }
  function intake(s, ds) { var i = s.settings.intake || {}; return i[ds] || {}; }
  function catalog(pid) { return P && P.ITEMS.filter(function (x) { return x.id === pid; })[0]; }

  // ---------------------------------------------------------------- the day plan
  function dayPlan(s) {
    var now = new Date(), ds = ymd(now), training = plannedDay(s, now) || workedOut(s, ds), taken = intake(s, ds), items = [];
    routine(s).forEach(function (r) {
      if (r.days === 'training' && !training) return;
      var slot = r.slot;
      if (!training && (slot === 'pre' || slot === 'post')) slot = 'midday';     // rest day: no training to anchor it to
      var sl = SLOT[slot] || SLOT.morning;
      items.push({ key: 's:' + r.id, kind: 'supp', order: sl.i * 10 + (slot === 'pre' ? 3 : slot === 'post' ? 7 : 0), ico: sl.ico, when: sl.name,
        title: r.name, sub: r.dose || '', done: !!taken[r.id], id: r.id, due: sl.at != null && now.getHours() >= sl.at });
    });
    var key = Program.nextSessionKey(s), sess = Program.build(s, key), ex = 0;
    sess.blocks.forEach(function (b) { ex += b.items.length; });
    if (training) {
      items.push({ key: 'w', kind: 'workout', order: 25, ico: '🏋️', when: 'Workout', title: sess.name, sub: '~' + Program.estimateMin(sess) + ' min · ' + ex + ' exercises',
        done: workedOut(s, ds), go: 'player', p: { key: key }, cta: '▶ Start' });
    } else {
      items.push({ key: 'm', kind: 'move', order: 15, ico: '🚶', when: 'Rest day', title: 'Easy movement – 20 to 30 min', sub: 'a walk, an easy ride or mobility – recovery that counts',
        done: moved(s, ds) || workedOut(s, ds), go: 'record', p: { type: 'walk' }, cta: '▶ Start walk' });
    }
    var bl = s.settings.bodyLog || [], last = bl.length ? bl[bl.length - 1] : null;
    var weighToday = last && last.date === ds;
    var stale = !last || (Date.now() - Date.parse(last.date)) / 864e5 >= 7;
    if (weighToday || now.getDay() === 1 || stale) {
      items.push({ key: 'b', kind: 'weight', order: 1, ico: '⚖️', when: 'Weekly check-in', title: 'Weigh in', sub: weighToday ? last.kg + ' kg logged' : 'morning, before breakfast – same scale each week',
        done: !!weighToday, sheet: 'weight', cta: 'Log' });
    }
    items.sort(function (a, b) { return a.order - b.order; });
    return { items: items, training: training, done: items.filter(function (i) { return i.done; }).length };
  }

  // ---------------------------------------------------------------- buddy
  var BUDDY = '<svg class="buddy-svg" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="bg-leaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5ad1b8"/><stop offset="1" stop-color="#2f9e57"/></linearGradient></defs>' +
    '<path d="M32 5C17 13 9 25 9 37c0 12 10 22 23 22s23-10 23-22C55 25 47 13 32 5z" fill="url(#bg-leaf)"/>' +
    '<path d="M32 14v40" stroke="#0b3d22" stroke-width="2" stroke-linecap="round" opacity=".35"/>' +
    '<circle cx="24" cy="35" r="3.4" fill="#04140a"/><circle cx="40" cy="35" r="3.4" fill="#04140a"/><circle cx="25.2" cy="33.8" r="1.1" fill="#fff"/><circle cx="41.2" cy="33.8" r="1.1" fill="#fff"/>' +
    '<path d="M25 43c4 4 10 4 14 0" stroke="#04140a" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>';
  function pick(list, seed) { return list[Math.abs(seed) % list.length]; }
  function buddy(s, plan) {
    // names and titles go in as placeholders (I18N.nm / I18N.ph) so each sentence translates once for everyone
    var N = window.I18N ? I18N.nm : esc, P = window.I18N ? I18N.ph : esc;
    var h = new Date().getHours(), name = N(s.name), seed = new Date().getDate() + s.name.length;
    var hello = h < 5 ? 'Up late, ' + name + '?' : h < 11 ? 'Good morning, ' + name : h < 17 ? 'Hi ' + name : 'Good evening, ' + name;
    // the quiet profile from a scan or the welcome screen has no real name yet: greet without one
    if (s.settings.qr && s.name === 'Me') hello = h < 5 ? 'Up late?' : h < 11 ? 'Good morning' : h < 17 ? 'Hi there' : 'Good evening';
    var left = plan.items.filter(function (i) { return !i.done; });
    var dueSupp = left.filter(function (i) { return i.kind === 'supp' && i.due; });
    var w = plan.items.filter(function (i) { return i.kind === 'workout' || i.kind === 'move'; })[0];
    var streak = U.weeksStreak(), line;
    if (!plan.items.length) line = 'Let’s set up your day – add your supplements and I’ll remind you when to take them.';
    else if (!left.length) line = pick(['Everything done today. That’s how habits are built. 🌿', 'Full house today – proud of you. Rest well.', 'All boxes ticked. Tomorrow-you says thanks.'], seed);
    else if (w && !w.done && w.kind === 'workout' && h >= 17) line = pick(['Still time for today’s workout – even 20 minutes counts.', 'Evening session? Start, and the rest follows.'], seed);
    else if (dueSupp.length) line = 'Don’t forget your ' + dueSupp.map(function (i) { return P(i.title); }).slice(0, 2).join(' and ') + ' – ' + P(dueSupp[0].when.toLowerCase()) + ' is the time.';
    else if (w && w.kind === 'workout' && !w.done) line = pick(['Today is a training day: ' + P(w.title) + '. You’ve got this.', P(w.title) + ' is up today – about ' + w.sub.split(' ·')[0].replace('~', '') + '.', 'Training day! Warm up well and enjoy it.'], seed);
    else if (w && w.kind === 'move' && !w.done) line = pick(['Rest day – a 20-minute walk helps you recover faster.', 'Recovery day. Easy movement, good food, early night.'], seed);
    else line = left.length + (left.length === 1 ? ' thing' : ' things') + ' left today – nice progress.';
    var badge = streak >= 2 ? '🔥 ' + streak + '-week streak' : s.log.length + (s.activities || []).length ? '' : 'Day one – welcome!';
    return { hello: hello, line: line, badge: badge };
  }

  // ---------------------------------------------------------------- Today screen
  App.SCREENS.home = function () {
    var s = st(), plan = dayPlan(s), b = buddy(s, plan), n = plan.items.length;
    var pct = n ? plan.done / n : 0, C = 2 * Math.PI * 26;
    var rec = window.Sport && Sport.recording();
    var lastA = (s.activities || [])[0], lastW = s.log[s.log.length - 1];
    var row = function (it) {
      return '<div class="t-item' + (it.done ? ' done' : '') + (it.due && !it.done ? ' due' : '') + ' k-' + it.kind + '">' +
        (it.kind === 'supp' ? '<button class="t-check focusable" data-take="' + it.id + '" aria-label="' + (it.done ? 'Mark as not taken' : 'Mark as taken') + '">' + (it.done ? '✓' : '') + '</button>'
          : '<span class="t-check' + (it.done ? '' : ' plain') + '">' + (it.done ? '✓' : it.ico) + '</span>') +
        '<div class="t-body"><div class="t-when">' + (it.kind === 'supp' ? it.ico + ' ' : '') + esc(it.when) + (it.due && !it.done ? ' · now' : '') + '</div><b>' + esc(it.title) + '</b><span>' + esc(it.sub) + '</span></div>' +
        (it.done ? '' : it.go ? '<button class="btn sm primary focusable" data-go="' + it.go + '" data-p=\'' + JSON.stringify(it.p) + '\'>' + it.cta + '</button>'
          : it.sheet ? '<button class="btn sm focusable" data-sheet="' + it.sheet + '">' + it.cta + '</button>' : '') + '</div>';
    };
    // this week: training days hit, from workouts + activities
    var now = new Date(), monday = new Date(now); monday.setHours(0, 0, 0, 0); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    var days = '', active = 0;
    for (var i = 0; i < 7; i++) {
      var d = new Date(monday); d.setDate(monday.getDate() + i);
      var ds = ymd(d), w = workedOut(s, ds), m = moved(s, ds);
      if (w || m) active++;
      days += '<div class="tw-day' + (ds === ymd() ? ' today' : '') + (w ? ' gym' : m ? ' trail' : '') + (plannedDay(s, d) ? ' planned' : '') + '"><span>' + U.DAYN[d.getDay()].slice(0, 1) + '</span><i></i></div>';
    }
    var html = '<div class="screen today-screen">' +
      '<div class="topbar">' + U.brandMark() + '<div class="spacer"></div>' + U.navBar() +
      '<button class="btn sm ghost focusable who" data-go="profiles" title="Switch person" aria-label="Switch person">' + U.avatar(s) + '<span class="who-name" translate="no">' + esc(s.name) + '</span></button></div>' +
      '<div class="buddy"><div class="buddy-face">' + BUDDY + '</div><div class="buddy-talk"><div class="buddy-hello">' + b.hello + '</div><div class="buddy-line">' + b.line + '</div>' +
      (b.badge ? '<span class="buddy-badge">' + esc(b.badge) + '</span>' : '') + '</div>' +
      '<div class="day-ring" title="' + plan.done + ' of ' + n + ' done"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" class="dr-bg"/><circle cx="32" cy="32" r="26" class="dr-fg" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - pct)).toFixed(1) + '"/></svg><b>' + plan.done + '/' + n + '</b><span>tasks</span></div></div>' +
      (window.Scan && Scan.hero ? Scan.hero(s, 'home') : '') +
      (rec ? '<div class="t-banner focusable" tabindex="0" data-go="record">● Your ' + esc(T.TYPES[rec.type].name.toLowerCase()) + ' is paused at ' + T.km(rec.d) + ' km – tap to resume</div>' : '') +
      (window.Health && Health.todayCard ? Health.todayCard(s) : '') + (window.FinestQR && FinestQR.homeCard ? FinestQR.homeCard(s) : '') +
      '<div class="section-title"><h2>Today’s plan</h2><span><span>' + (plan.training ? 'Training day' : 'Rest day') + '</span> · <span translate="no">' + new Date().toLocaleDateString((window.I18N && I18N.locale || 'en-GB'), { weekday: 'long', day: 'numeric', month: 'long' }) + '</span></span></div>' +
      '<div class="t-list">' + plan.items.map(row).join('') +
      (routine(s).length ? '<button class="t-edit btn sm ghost focusable" data-go="routine">✎ Edit my supplement routine</button>'
        : '<div class="t-item k-setup"><span class="t-check plain">💊</span><div class="t-body"><div class="t-when">Health</div><b>Add your supplements</b><span>pick from Nature’s Finest or add your own – I’ll remind you when to take them</span></div><button class="btn sm primary focusable" data-go="routine">Set up</button></div>') +
      '</div>' +
      '<div class="t-week"><div class="tw-head"><b>This week</b><span>' + active + ' active ' + (active === 1 ? 'day' : 'days') + ' · goal ' + s.settings.days + '</span>' +
      (App.share && active ? '<button class="btn sm ghost focusable" data-share-week>↗ Share</button>' : '') + '</div><div class="tw-days">' + days + '</div>' +
      '<div class="tw-legend"><span><i class="gym"></i>Workout</span><span><i class="trail"></i>Walk, run or ride</span><span><i class="planned"></i>Planned</span></div></div>' +
      ((lastA || lastW) ? '<div class="section-title"><h2>Recently</h2></div><div class="row t-recent">' +
        (lastA ? '<div class="session-card focusable last-act" tabindex="0" data-go="activity" data-p=\'{"id":"' + lastA.id + '"}\'><div class="tag">TRAIL · ' + esc(Sport.dateTxt(lastA.start).split(' · ')[0].toUpperCase()) + '</div><h3>' + esc(lastA.title) + '</h3><p>' +
          (lastA.dist ? T.km(lastA.dist) + ' km · ' : '') + T.clock(lastA.moving || lastA.elapsed) + '</p>' + (lastA.pts && lastA.pts.length > 1 ? Sport.routeSvg(lastA.pts, 'card') : '') + '</div>' : '') +
        (lastW ? '<div class="session-card focusable" tabindex="0" data-go="history"><div class="tag">GYM · ' + new Date(lastW.date).toLocaleDateString((window.I18N && I18N.locale || 'en-GB'), { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase() + '</div><h3>' + esc(lastW.name || 'Workout') + '</h3><p>' + lastW.min + ' min · ' + lastW.sets.length + ' sets</p></div>' : '') +
        '</div>' : '') +
      U.homeProducts() +
      '</div>';
    App.$('#app').innerHTML = html;
    setTimeout(columns, 0);   // after the other modules have added their cards
    $$('[data-take]').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-take'), s2 = st(), ds = ymd();
        s2.settings.intake = s2.settings.intake || {};
        var day = s2.settings.intake[ds] = s2.settings.intake[ds] || {};
        if (day[id]) delete day[id]; else day[id] = new Date().toISOString();
        prune(s2); App.save();
        if (window.Health && Health.afterTick) Health.afterTick();
        var p2 = dayPlan(s2);
        if (day[id] && p2.done === p2.items.length) App.toast('All done for today 🎉');
        App.refresh();
      };
    });
  };
  function prune(s) {
    var cut = ymd(new Date(Date.now() - 60 * 864e5));
    Object.keys(s.settings.intake || {}).forEach(function (k) { if (k < cut) delete s.settings.intake[k]; });
  }

  // Wide screens (desktop, TV): two columns – today's tasks on the left; the week, the program card,
  // the shelf and adding a product on the right. Phones keep one column in the same order.
  function columns() {
    var sc = document.querySelector('.today-screen');
    if (!sc || sc.querySelector('.td-cols') || !window.matchMedia('(min-width: 1100px)').matches) return;
    var buddy = sc.querySelector('.buddy'); if (!buddy) return;
    var hasRoutine = routine(st()).length > 0;
    var cols = document.createElement('div'); cols.className = 'td-cols';
    var main = document.createElement('div'); main.className = 'td-main';
    var side = document.createElement('div'); side.className = 'td-side';
    var sideSel = '.t-week, .hp-card, .hp-check, .shelf-strip, .rem-card, .qr-home' + (hasRoutine ? ', .scan-hero' : '');
    var rest = []; for (var n = buddy.nextElementSibling; n; n = n.nextElementSibling) rest.push(n);
    rest.forEach(function (el) { (el.matches(sideSel) ? side : main).appendChild(el); });
    cols.appendChild(main); cols.appendChild(side); buddy.insertAdjacentElement('afterend', cols);
  }

  // ---------------------------------------------------------------- ＋ Start: Trail · Gym · Health
  var SHEETS = {
    start: function () {
      return '<h3>What are we doing?</h3>' + (window.Scan && Scan.hero ? Scan.hero(st(), 'sheet') : '') + '<div class="sh-worlds">' +
        world('trail', '🌲', 'Trail', 'run · walk · hike · ride · any sport') +
        world('gym', '🏋️', 'Gym', 'today’s workout · pick one · build your own') +
        world('health', '🌿', 'Health', 'supplements · body weight') + '</div>';
      function world(k, ico, name, sub) { return '<button class="sh-world focusable w-' + k + '" data-sheet="' + k + '"><span class="ico">' + ico + '</span><b>' + name + '</b><small>' + sub + '</small></button>'; }
    },
    trail: function () {
      return head('🌲 Trail', 'Record with GPS – live map, pace, splits') + '<div class="sh-grid">' +
        T.GPS_TYPES.map(function (k) { return opt('record', { type: k }, T.TYPES[k].ico, T.TYPES[k].name); }).join('') + '</div>' +
        '<div class="sh-list">' + line('logSport', {}, '✍️', 'Log another sport', 'football, tennis, padel, swim, yoga…') +
        line('devices', {}, '⌚', 'Watch & heart rate', 'import workout files · live heart rate (Bluetooth strap)') + line('activities', {}, '🗺️', 'My activities', 'maps, splits, records') + '</div>';
    },
    gym: function () {
      var s = st(), key = Program.nextSessionKey(s), sess = Program.build(s, key);
      return head('🏋️ Gym', 'Guided workouts on your equipment') + '<div class="sh-list">' +
        line('player', { key: key }, '▶', 'Today’s workout', sess.name + ' · ~' + Program.estimateMin(sess) + ' min', true) +
        line('train', {}, '📋', 'Choose a workout', 'program, quick workouts, hybrid race') +
        line('builder', {}, '＋', 'Build your own', 'focus · type · duration') + line('library', {}, '📚', 'Exercise library', 'technique, muscles, train one exercise') + '</div>';
    },
    health: function () {
      var s = st(), plan = dayPlan(s), left = plan.items.filter(function (i) { return i.kind === 'supp' && !i.done; });
      return head('🌿 Health', 'Your daily routine and body') + '<div class="sh-list">' +
        (left.length ? '<button class="sh-line focusable primary" data-take-all><span class="ico">💊</span><span><b>Take ' + (left.length === 1 ? left[0].title : 'my supplements now') + '</b><small>' + esc(left.map(function (i) { return i.title; }).join(', ')) + '</small></span></button>' : '') +
        (routine(s).length ? line('shelf', {}, '📦', 'My shelf', 'what’s left in each pack · reorder') : '') +
        (routine(s).length ? line('program', {}, '🏅', 'My program', window.Health ? Health.count(s) + ' check-ins · rewards · supply · weekly progress' : '') : '') +
        line('routine', {}, '🗓️', 'My supplement routine', routine(s).length ? routine(s).length + ' in your routine · times and reminders' : 'set up – pick from Nature’s Finest or add your own') +
        '<button class="sh-line focusable" data-sheet="weight"><span class="ico">⚖️</span><span><b>Log body weight</b><small>' + (s.settings.weight ? 'last: ' + s.settings.weight + ' kg' : 'track your trend toward your goal') + '</small></span></button>' +
        line('history', {}, '📈', 'Body & progress', 'weight trend, records, weekly volume') + '</div>';
    },
    weight: function () {
      var s = st(), v = s.settings.weight || 75;
      return head('⚖️ Body weight', 'Morning, before breakfast – same scale each time') +
        '<div class="sh-weight"><button class="focusable" data-wd="-0.1">−</button><input class="num-in focusable" id="shW" type="text" inputmode="decimal" value="' + v + '"><span>kg</span><button class="focusable" data-wd="0.1">+</button></div>' +
        '<button class="btn primary focusable sh-save" id="shWSave">Save</button>';
    }
  };
  function head(t, sub) { return '<button class="sh-back focusable" data-sheet="start" aria-label="Go back">←</button><h3>' + t + '</h3><p class="sh-sub">' + sub + '</p>'; }
  function opt(go, p, ico, name) { return '<button class="sh-opt focusable" data-sgo="' + go + '" data-p=\'' + JSON.stringify(p) + '\'><span class="ico">' + ico + '</span>' + esc(name) + '</button>'; }
  function line(go, p, ico, name, sub, primary) {
    return '<button class="sh-line focusable' + (primary ? ' primary' : '') + '" data-sgo="' + go + '" data-p=\'' + JSON.stringify(p) + '\'><span class="ico">' + ico + '</span><span><b>' + esc(name) + '</b><small>' + esc(sub) + '</small></span></button>';
  }
  function closeSheet() { var x = document.querySelector('.sheet-wrap'); if (x) x.remove(); }
  function openSheet(k) {
    var w = document.querySelector('.sheet-wrap');
    if (!w) {
      w = document.createElement('div'); w.className = 'sheet-wrap';
      w.innerHTML = '<div class="sheet" role="dialog" aria-modal="true"></div>';
      w.addEventListener('click', function (e) { if (e.target === w) closeSheet(); });
      document.body.appendChild(w);
    }
    var sh = w.querySelector('.sheet');
    sh.innerHTML = '<div class="sh-grab"></div>' + SHEETS[k]();
    sh.setAttribute('data-k', k);
    var f = sh.querySelector('.focusable:not(.sh-back)') || sh.querySelector('.focusable'); if (f && !App.TOUCH) f.focus();
    if (k === 'weight') {
      var inp = sh.querySelector('#shW');
      $$('[data-wd]', sh).forEach(function (b) {
        b.onclick = function () { var v = parseFloat(String(inp.value).replace(',', '.')) || 75; inp.value = Math.round((v + parseFloat(b.getAttribute('data-wd'))) * 10) / 10; };
      });
      sh.querySelector('#shWSave').onclick = function () {
        var v = parseFloat(String(inp.value).replace(',', '.'));
        if (!(v >= 30 && v <= 250)) { App.toast('Enter your weight in kg'); return; }
        App.logWeight(v); closeSheet(); App.toast('Logged ' + v + ' kg'); App.refresh();
      };
    }
    var all = sh.querySelector('[data-take-all]');
    if (all) all.onclick = function () {
      var s = st(), ds = ymd(), plan = dayPlan(s);
      s.settings.intake = s.settings.intake || {};
      var day = s.settings.intake[ds] = s.settings.intake[ds] || {};
      plan.items.forEach(function (i) { if (i.kind === 'supp' && !i.done) day[i.id] = new Date().toISOString(); });
      prune(s); App.save(); closeSheet(); App.toast('Logged – nice consistency 🌿'); App.refresh();
    };
  }
  App.openSheet = openSheet; App.closeSheet = closeSheet;

  // "my week" share card – gym + trail together
  function shareWeek() {
    var s = st(), now = new Date(), mon = new Date(now); mon.setHours(0, 0, 0, 0); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    var w = s.log.filter(function (l) { return new Date(l.date) >= mon; }), a = (s.activities || []).filter(function (x) { return new Date(x.start) >= mon; });
    var km = a.reduce(function (x, y) { return x + (y.dist || 0); }, 0) / 1000;
    var sec = w.reduce(function (x, l) { return x + (l.sec || l.min * 60 || 0); }, 0) + a.reduce(function (x, y) { return x + (y.moving || y.elapsed || 0); }, 0);
    var streak = U.weeksStreak();
    App.share({ kind: 'week', eyebrow: 'My week · ' + mon.toLocaleDateString((window.I18N && I18N.locale || 'en-GB'), { day: 'numeric', month: 'short' }), title: (w.length + a.length) + ((w.length + a.length) === 1 ? ' session' : ' sessions'),
      subtitle: (w.length ? w.length + ' gym' : '') + (w.length && a.length ? ' · ' : '') + (a.length ? a.length + ' trail' : ''),
      stats: [[Math.floor(sec / 3600) + 'h ' + Math.round(sec % 3600 / 60) + 'm', 'active time'], [km ? km.toFixed(1) + ' km' : '–', 'distance'], [streak >= 2 ? streak : w.length + a.length, streak >= 2 ? 'week streak' : 'this week']],
      badge: streak >= 2 ? '🔥 ' + streak + '-week streak' : '',
      caption: 'My week: ' + (w.length + a.length) + ((w.length + a.length) === 1 ? ' session' : ' sessions') + (km ? ', ' + km.toFixed(1) + ' km' : '') + ' 🔥', tags: ['#FinestMe', '#NaturesFinest', '#consistency'] });
  }
  document.addEventListener('click', function (e) { if (e.target.closest('[data-share-week]')) shareWeek(); });
  document.addEventListener('click', function (e) {
    var sb = e.target.closest('[data-sheet]');
    if (sb) { e.preventDefault(); openSheet(sb.getAttribute('data-sheet')); return; }
    var g = e.target.closest('[data-sgo]');
    if (g) { closeSheet(); App.go(g.getAttribute('data-sgo'), JSON.parse(g.getAttribute('data-p') || '{}')); }
  });
  document.addEventListener('keydown', function (e) {
    if (document.querySelector('.sheet-wrap') && App.isKey(e.keyCode, 'BACK') && !/INPUT/.test((document.activeElement || {}).tagName)) { e.stopPropagation(); e.preventDefault(); closeSheet(); }
  }, true);

  // ---------------------------------------------------------------- routine editor
  App.SCREENS.routine = function (p) {
    var s = st(), list = routine(s);
    var slotChips = function (r) {
      return SLOTS.map(function (x) { return '<button class="chip focusable' + (r.slot === x.k ? ' on' : '') + '" data-rs="' + r.id + '" data-slot="' + x.k + '" data-fid="rs-' + r.id + '-' + x.k + '">' + x.ico + ' ' + x.name + '</button>'; }).join('');
    };
    var html = '<div class="screen"><div class="topbar"><h1>My supplement routine</h1></div>' +
      '<div class="hint">When and what you take – Today shows each one at the right time and on the right days.</div>' +
      '<div class="r-list">' + (list.map(function (r) {
        var c = r.pid && catalog(r.pid);
        return '<div class="panel r-item"><div class="r-head">' + (c && c.img ? '<img src="' + esc(c.img) + '" alt="">' : '<span class="r-ico">💊</span>') +
          '<div><h3>' + esc(r.name) + '</h3><input class="field focusable r-dose" data-rdose="' + r.id + '" data-fid="rd-' + r.id + '" value="' + esc(r.dose || '') + '" placeholder="dose, e.g. 1 capsule"></div>' +
          '<button class="btn sm ghost focusable" data-rdel="' + r.id + '" aria-label="Remove">✕</button></div>' +
          (c && c.use && c.use.tip ? '<div class="hint">💡 ' + esc(c.use.tip) + '</div>' : '') +
          (window.Health ? (function () { var sup = Health.supply(s, r); return '<div class="opt-row r-pack"><span class="hint">📦 ' + (sup ? sup.left + ' of ' + sup.servings + ' servings left · until ' + new Date(sup.runOut).toLocaleDateString((window.I18N && I18N.locale || 'en-GB'), { day: 'numeric', month: 'short' }) : 'Add your pack – I’ll remind you before it runs out') + '</span><button class="btn sm ghost focusable" data-rpack="' + r.id + '">' + (sup ? 'New pack' : 'Add pack') + '</button></div>'; })() : '') +
          '<div class="opt-row r-slots">' + slotChips(r) + '</div>' +
          '<div class="opt-row"><button class="chip focusable' + (r.days !== 'training' ? ' on' : '') + '" data-rdays="' + r.id + '" data-val="daily" data-fid="rdy-' + r.id + '">Every day</button>' +
          '<button class="chip focusable' + (r.days === 'training' ? ' on' : '') + '" data-rdays="' + r.id + '" data-val="training" data-fid="rdt-' + r.id + '">Training days only</button></div></div>';
      }).join('') || '<div class="empty-state"><div class="big">💊</div><h3>No supplements yet</h3><p>Add what you take – I’ll put each one into your day and remind you.</p></div>') + '</div>' +
      '<div class="section-title"><h2>Add</h2><span>Nature’s Finest products come with the timing from the label</span></div>' +
      '<div class="r-cat">' + (P ? P.ITEMS.filter(function (c) { return !list.some(function (r) { return r.pid === c.id; }); }).map(function (c) {
        return '<button class="r-add focusable" data-radd="' + c.id + '"><img src="' + esc(c.img) + '" alt=""><span><b>' + esc(c.name) + '</b><small>' + esc(c.use ? c.use.dose : '') + '</small></span><i>＋</i></button>';
      }).join('') : '') +
      '<div class="r-custom panel"><b>Something else</b><div class="opt-row"><input class="field focusable" id="rcName" maxlength="40" placeholder="Name, e.g. Omega-3"><input class="field focusable" id="rcDose" maxlength="40" placeholder="Dose, e.g. 2 capsules"><button class="btn focusable" id="rcAdd">Add</button></div></div></div>' +
      '<div class="hint">Food supplements are not a substitute for a varied, balanced diet and a healthy lifestyle. Do not exceed the recommended daily dose on the label.</div></div>';
    App.$('#app').innerHTML = html;
    function find(id) { return routine(st()).filter(function (r) { return r.id === id; })[0]; }
    function add(r) { var s2 = st(); s2.settings.routine = routine(s2).concat([r]); App.save(); App.refresh(); }
    $$('[data-radd]').forEach(function (b) {
      b.onclick = function () {
        var c = catalog(b.getAttribute('data-radd'));
        add({ id: 'r' + Date.now().toString(36), pid: c.id, name: c.name, dose: c.use ? c.use.dose : '', slot: c.use ? c.use.slot : 'morning', days: c.use ? c.use.days : 'daily', pack: c.pack && c.pack.servings ? { start: ymd(), servings: c.pack.servings } : undefined, perDay: 1 });
        App.toast(c.name + ' added to your day');
      };
    });
    $('#rcAdd').onclick = function () {
      var n = $('#rcName').value.trim(); if (!n) { App.toast('Enter a name'); return; }
      add({ id: 'r' + Date.now().toString(36), pid: null, name: n, dose: $('#rcDose').value.trim(), slot: 'morning', days: 'daily' });
    };
    $$('[data-rs]').forEach(function (b) { b.onclick = function () { find(b.getAttribute('data-rs')).slot = b.getAttribute('data-slot'); App.save(); App.refresh(); }; });
    $$('[data-rdays]').forEach(function (b) { b.onclick = function () { find(b.getAttribute('data-rdays')).days = b.getAttribute('data-val'); App.save(); App.refresh(); }; });
    $$('[data-rdose]').forEach(function (inp) { inp.onchange = function () { find(inp.getAttribute('data-rdose')).dose = inp.value.trim(); App.save(); }; });
    $$('[data-rpack]').forEach(function (b) { b.onclick = function () { if (window.Health) Health.openPack(b.getAttribute('data-rpack')); }; });
    $$('[data-rdel]').forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-rdel'), s2 = st();
        s2.settings.routine = routine(s2).filter(function (r) { return r.id !== id; }); App.save(); App.refresh();
      };
    });
  };

  window.Today = { dayPlan: dayPlan, buddy: buddy, ymd: ymd };
});
