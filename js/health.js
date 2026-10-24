/*
 * Health program – from purchase to reorder.
 *
 * Every product a customer takes becomes a routine with a daily one-tap check-in. Check-ins add up
 * (a missed day never erases progress) toward a visible reward ladder; supply is tracked per pack so the
 * app can say "5 days left – protect your routine" with a one-tap reorder; a 20-second weekly check-in
 * shows proof of progress; a complementary product appears only after day 21, at most once a month,
 * first as the 30-check-in gift. No guilt: "not today" is an answer, three silent days offer a different
 * time, fewer reminders or a pause, and a pause freezes everything.
 *
 * State (profile settings → syncs with the account):
 *   settings.program = { start, days: { 'YYYY-MM-DD': 'done'|'skip' }, rewards: { 7: {at, code} … },
 *     weekly: { 'YYYY-Www': { energy, sleep, goal, at } }, pause: { from, to } | null,
 *     checkinTime: 'coffee'|'breakfast'|'lunch'|'evening', reminders: 'daily'|'3x'|'off',
 *     snooze: ms, supplySnooze: { itemId: 'YYYY-MM-DD' }, cross: { last, dismissed: [] } }
 *   routine items gain { pack: { start, servings }, perDay }
 * The engine (Health.*) has no DOM and is unit-tested in Node (tools/health.cjs).
 */
(function (global) {
  'use strict';
  var DAY = 864e5;
  function ymd(d) { d = d || new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function parse(ds) { var p = ds.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function P() { return global.Products; }
  // starter products (js/products.js) first, then the full label catalog behind the QR codes (js/catalog.js)
  function catalog(pid) {
    var c = P() && P().ITEMS.filter(function (x) { return x.id === pid; })[0], e = !c && pid != null && global.FS_CATALOG && global.FS_CATALOG[pid];
    return c || (e ? { id: String(pid), sku: String(pid), name: e.n, kind: e.k, img: e.img || null, pack: e.days ? { servings: e.days } : null } : null);
  }

  // reward ladder: the first reward inside one week, then proof, then habit
  var LADDER = [
    { n: 7, ico: '🎁', title: 'First reward', key: 'r7' },
    { n: 30, ico: '🏅', title: 'Consistency reward + gift', key: 'r30' },
    { n: 60, ico: '🚚', title: 'Free shipping', key: 'r60' },
    { n: 90, ico: '🏆', title: 'Locked price + your 90-day story', key: 'r90' }
  ];
  function rewardText(n) { var r = P() && P().CONFIG.rewards && P().CONFIG.rewards[n]; return r ? r.text : ''; }
  function rewardCode(n) { var r = P() && P().CONFIG.rewards && P().CONFIG.rewards[n]; return r ? r.code : ''; }

  function prog(s) {
    var p = s.settings.program = s.settings.program || {};
    p.days = p.days || {}; p.rewards = p.rewards || {}; p.weekly = p.weekly || {};
    p.cross = p.cross || { last: null, dismissed: [] }; p.supplySnooze = p.supplySnooze || {};
    p.checkinTime = p.checkinTime || 'breakfast'; p.reminders = p.reminders || 'daily';
    return p;
  }
  function items(s) { return s.settings.routine || []; }
  function active(s) { return items(s).length > 0; }
  function plannedDay(s, d) {
    if (!global.Program || !Program.plan) return true;
    var p = Program.plan(s);   // gym and Trail days are both training days
    return p.days.indexOf(d.getDay()) >= 0 || p.trail.indexOf(d.getDay()) >= 0;
  }
  function trainedOn(s, ds) { return (s.log || []).some(function (l) { return ymd(new Date(l.date)) === ds; }); }
  function due(s, it, d) { return it.days !== 'training' || plannedDay(s, d) || trainedOn(s, ymd(d)); }
  function dueItems(s, d) { return items(s).filter(function (it) { return due(s, it, d); }); }
  function paused(s, ds) { var p = prog(s).pause; return !!(p && ds >= p.from && (!p.to || ds <= p.to)); }

  function count(s) { var d = prog(s).days; return Object.keys(d).filter(function (k) { return d[k] === 'done'; }).length; }
  function next(s) {
    var c = count(s);
    for (var i = 0; i < LADDER.length; i++) if (c < LADDER[i].n) return { step: LADDER[i], left: LADDER[i].n - c, from: i ? LADDER[i - 1].n : 0 };
    return null;
  }
  // consecutive done days ending today (or yesterday while today is still open); paused days are skipped.
  // Streak freezes (Duolingo-style): one per 7 check-ins, max 2 – a missed day inside the run is bridged.
  function freezes(s) { return Math.min(2, Math.floor(count(s) / 7)); }
  function streak(s, now) {
    var p = prog(s), d = new Date(now || new Date()), n = 0, fz = freezes(s), start = p.start || ymd(d);
    if (p.days[ymd(d)] !== 'done') d = addDays(d, -1);
    for (var i = 0; i < 400; i++) {
      var ds = ymd(d);
      if (ds < start) break;
      if (p.days[ds] === 'done') n++;
      else if (!paused(s, ds)) { if (fz > 0 && p.days[ymd(addDays(d, -1))] === 'done') fz--; else break; }
      d = addDays(d, -1);
    }
    return n;
  }
  // days before today with something due and no answer at all ("not today" is an answer)
  function missedRun(s, now) {
    var p = prog(s), d = addDays(now || new Date(), -1), n = 0, start = p.start || ymd(now);
    for (var i = 0; i < 30; i++) {
      var ds = ymd(d);
      if (ds < start || p.days[ds] || paused(s, ds) || !dueItems(s, d).length) break;
      n++; d = addDays(d, -1);
    }
    return n;
  }

  // check-in: 'done' marks every due item as taken; 'skip' = not today (no guilt, nothing lost)
  function checkin(s, action, now) {
    now = now || new Date();
    var p = prog(s), ds = ymd(now);
    if (!p.start) p.start = ds;
    if (action === 'done') {
      s.settings.intake = s.settings.intake || {};
      var day = s.settings.intake[ds] = s.settings.intake[ds] || {};
      dueItems(s, now).forEach(function (it) { if (!day[it.id]) day[it.id] = now.toISOString(); });
      p.days[ds] = 'done';
    } else if (action === 'skip') { if (p.days[ds] !== 'done') p.days[ds] = 'skip'; }
    else if (action === 'undo') delete p.days[ds];
    return unlock(s, now);
  }
  // per-item ticks: the day counts once everything due today is taken
  function syncDay(s, now) {
    now = now || new Date();
    var p = prog(s), ds = ymd(now), taken = (s.settings.intake || {})[ds] || {}, list = dueItems(s, now);
    if (!p.start && list.length) p.start = ds;
    var all = list.length && list.every(function (it) { return taken[it.id]; });
    if (all) p.days[ds] = 'done';
    else if (p.days[ds] === 'done') delete p.days[ds];
    return all ? unlock(s, now) : null;
  }
  function unlock(s, now) {
    var p = prog(s), c = count(s), got = null;
    LADDER.forEach(function (st) {
      if (c >= st.n && !p.rewards[st.n]) { p.rewards[st.n] = { at: (now || new Date()).toISOString(), code: rewardCode(st.n) }; got = st; }
    });
    // after the first reward the rhythm relaxes: reminders 3× a week ("it runs by itself now")
    if (got && got.n === 7 && p.reminders === 'daily') p.reminders = '3x';
    return got;
  }

  // supply: servings in the current pack minus servings used on due days since it started (skips don't use)
  function supply(s, it, now) {
    now = now || new Date();
    var c = it.pid && catalog(it.pid), servings = it.pack && it.pack.servings || (c && c.pack && c.pack.servings) || null;
    if (!it.pack || !it.pack.start || !servings) return null;
    var p = prog(s), per = it.perDay || 1, used = 0, d = parse(it.pack.start), today = ymd(now);
    for (var i = 0; i < 400 && ymd(d) <= today; i++) {
      var ds = ymd(d), mark = p.days[ds], took = ((s.settings.intake || {})[ds] || {})[it.id];
      if (took || (mark !== 'skip' && !paused(s, ds) && ds < today && due(s, it, d))) used += per;
      d = addDays(d, 1);
    }
    var left = Math.max(0, servings - used);
    // calendar days the pack still covers, today included until today's dose is confirmed
    // (85 servings, nothing taken yet → 85 days; training-days-only items last longer)
    var takenToday = !!((s.settings.intake || {})[today] || {})[it.id];
    var daysLeft = 0, x = takenToday ? addDays(now, 1) : new Date(now), rest = left;
    while (rest > 0 && daysLeft < 400) { if (due(s, it, x)) rest -= per; daysLeft++; x = addDays(x, 1); }
    return { servings: servings, used: used, left: left, daysLeft: Math.max(0, daysLeft), runOut: ymd(addDays(x, -1)) };
  }
  function lowSupply(s, now) {
    var p = prog(s), today = ymd(now || new Date());
    return items(s).map(function (it) { return { it: it, sup: supply(s, it, now) }; })
      .filter(function (x) { return x.sup && x.sup.daysLeft <= 5 && !(p.supplySnooze[x.it.id] && p.supplySnooze[x.it.id] > today); });
  }
  var GENERIC = /^(capsules?|caps|tablets?|softgels?|sachets?|sticks?|gummies|powder|drops|liquid|shots?|vegan)$/i;
  function searchTerm(name) {
    var w = String(name || '').replace(/[®™©]/g, '').replace(/\(.*?\)/g, ' ').split(/\s+/).filter(function (x) { return x && !GENERIC.test(x); });
    return w.slice(0, 2).join(' ') || String(name || '');
  }
  function reorderUrl(it, code, campaign) {
    var c = it.pid && catalog(it.pid), cfg = P() && P().CONFIG;
    if (!c || !cfg) return null;
    // catalog products: ids differ per market, so reorder searches the customer's own shop (until cartIds are mapped)
    var shop = c.url || c.cartId ? cfg.shop : (global.FS_MARKET && global.FS_MARKET.shop) || cfg.shop;
    // shop search: the store's own search needs dgwt_wcas=1, and finds products by their core name in every language
    // ("KSM-66 Ashwagandha® capsules" → "KSM-66 Ashwagandha", "Magnesium capsules" → "Magnesium")
    var u = shop + (c.cartId ? '/?add-to-cart=' + c.cartId + '&quantity=1' : c.url ? c.url + '?' : '/?s=' + encodeURIComponent(searchTerm(c.name)) + '&post_type=product&dgwt_wcas=1');
    var q = ['utm_source=nf-app', 'utm_medium=app', 'utm_campaign=' + (campaign || 'reorder'), 'utm_content=' + c.id];
    if (code) q.push('coupon=' + encodeURIComponent(code));
    return u + (u.slice(-1) === '?' ? '' : '&') + q.join('&');
  }
  function bestCode(s) {
    var r = prog(s).rewards, best = null;
    [30, 7].forEach(function (n) { if (!best && r[n] && r[n].code && !r[n].used) best = r[n].code; });
    return best;
  }

  // weekly: 20 seconds on Sunday (or any day ≥7 days after the last one); questions follow the goal
  function weekKey(d) {
    d = new Date(d || new Date()); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    var w1 = new Date(d.getFullYear(), 0, 4);
    return d.getFullYear() + '-W' + ('0' + (1 + Math.round(((d - w1) / DAY - 3 + ((w1.getDay() + 6) % 7)) / 7))).slice(-2);
  }
  function weeklyDue(s, now) {
    now = now || new Date();
    var p = prog(s);
    if (!p.start || (now - parse(p.start)) / DAY < 5 || p.weekly[weekKey(now)]) return false;
    return now.getDay() === 0 || now.getDay() === 1 || Object.keys(p.weekly).length === 0 && (now - parse(p.start)) / DAY >= 7;
  }
  function goalQuestion(s) {
    var g = s.settings.goal;
    return g === 'fatloss' ? { k: 'goal', q: 'Cravings under control?' } : g === 'muscle' || g === 'strength' || g === 'endurance' || g === 'hyrox' ? { k: 'goal', q: 'How recovered do you feel?' } : { k: 'goal', q: 'Overall mood?' };
  }
  function adherence(s, weekStart, now) {
    var done = 0, dueN = 0, p = prog(s), today = ymd(now || new Date());
    for (var i = 0; i < 7; i++) {
      var d = addDays(weekStart, i), ds = ymd(d);
      if (paused(s, ds) || (p.start && ds < p.start) || ds > today) continue;
      if (dueItems(s, d).length) { dueN++; if (p.days[ds] === 'done') done++; }
    }
    return { done: done, due: dueN };
  }
  function mondayOf(d) { d = new Date(d || new Date()); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }
  function review(s, now) {
    var p = prog(s), wk = Object.keys(p.weekly).sort(), last = wk[wk.length - 1], prev = wk[wk.length - 2];
    if (!last) return null;
    var thisMon = mondayOf(now), lastMon = addDays(thisMon, -7);
    return { week: wk.length, cur: p.weekly[last], prev: prev ? p.weekly[prev] : null, adh: adherence(s, now && now.getDay() === 1 ? lastMon : thisMon, now), adhPrev: adherence(s, now && now.getDay() === 1 ? addDays(lastMon, -7) : lastMon, now) };
  }
  // what to expect: habit framing only – no product effect claims (EU 1924/2006)
  function expectation(s, now) {
    var p = prog(s), d = p.start ? Math.floor(((now || new Date()) - parse(p.start)) / DAY) : 0;
    return d < 7 ? 'This week the win is the habit itself: same moment, every day. Small and steady beats perfect.'
      : d < 21 ? 'Changes from a routine are gradual. Consistency over weeks matters more than any single day – keep collecting.'
      : d < 60 ? 'You have built a real routine. This is where it becomes automatic – the hardest part is behind you.'
      : 'This is who you are now: someone who looks after themselves every day.';
  }
  // one complementary product: after day 21, max once a month, never one already in the routine
  function crossPick(s, now) {
    now = now || new Date();
    var p = prog(s);
    if (!p.start || (now - parse(p.start)) / DAY < 21) return null;
    if (p.cross.last && (now - new Date(p.cross.last)) / DAY < 30) return null;
    var have = items(s).map(function (x) { return x.pid; }), compl = global.HEALTH_COMPLEMENTS || {};
    var cand = [];
    have.forEach(function (pid) {
      ((compl[pid] || {}).complements || []).forEach(function (c) { cand.push(c.id); });
      var e = global.FS_CATALOG && global.FS_CATALOG[pid]; if (e && e.x) e.x.forEach(function (x) { cand.push(x); });   // catalog products: from order data
    });
    if (P() && !cand.length) cand = cand.concat(P().ITEMS.slice().sort(function (a, b) { return ((b.goals || {})[s.settings.goal] || 0) - ((a.goals || {})[s.settings.goal] || 0); }).map(function (c) { return c.id; }));
    var pick = cand.filter(function (id, i) { return cand.indexOf(id) === i && have.indexOf(id) < 0 && p.cross.dismissed.indexOf(id) < 0 && catalog(id); })[0];
    return pick ? catalog(pick) : null;
  }

  global.Health = {
    LADDER: LADDER, rewardText: rewardText, prog: prog, items: items, active: active, dueItems: dueItems, paused: paused,
    count: count, next: next, streak: streak, freezes: freezes, missedRun: missedRun, checkin: checkin, syncDay: syncDay, supply: supply, lowSupply: lowSupply,
    reorderUrl: reorderUrl, bestCode: bestCode, weekKey: weekKey, weeklyDue: weeklyDue, goalQuestion: goalQuestion, adherence: adherence,
    review: review, expectation: expectation, crossPick: crossPick, ymd: ymd, catalog: catalog
  };

  if (!global.FS_MODULES) return;   // Node tests stop here

  // ================================================================ UI
  global.FS_MODULES.push(function (App) {
    var H = global.Health, $ = App.$, $$ = App.$$, esc = App.esc;
    function st() { return App.state(); }
    var TIMES = { coffee: '☕ With morning coffee', breakfast: '🍳 With breakfast', lunch: '🥗 With lunch', evening: '🌙 In the evening' };
    function emit(name, props) { try { if (global.Cloud && Cloud.user && Cloud.user() && Cloud.event) Cloud.event(name, props || {}, st().id); } catch (e) {} }
    function save() { App.save(); }

    function celebrate(step) {
      if (!step) return;
      var code = rewardCode(step.n);
      emit('reward_unlocked', { reward: step.title, code: code, checkins: step.n });
      var w = document.createElement('div'); w.className = 'dlg unlock';
      w.innerHTML = '<div class="dlg-box"><div class="u-burst">' + step.ico + '</div><h2>' + step.n + ' check-ins!</h2><p><b>' + esc(step.title) + '</b><br>' + esc(rewardText(step.n)) + '</p>' +
        (code ? '<div class="u-code"><code>' + esc(code) + '</code><button class="btn sm focusable" id="uCopy">Copy</button></div><div class="hint">Applied automatically when you reorder from the app.</div>' : '') +
        (step.n === 7 ? '<div class="hint">From now on I’ll remind you a little less – it’s becoming yours.</div>' : '') +
        (step.n === 90 && App.share ? '<button class="btn focusable" id="uShare">↗ Share my 90 days</button>' : '') +
        '<div class="dlg-row"><button class="btn primary focusable" id="uOk">Keep going</button></div></div>';
      document.body.appendChild(w);
      $('#uOk', w).onclick = function () { w.remove(); };
      if ($('#uCopy', w)) $('#uCopy', w).onclick = function () { if (navigator.clipboard) navigator.clipboard.writeText(code).then(function () { App.toast('Code copied'); }, function () {}); };
      if ($('#uShare', w)) $('#uShare', w).onclick = function () { w.remove(); shareStory(); };
    }
    H.celebrate = celebrate;

    // ---------------------------------------------------------------- Today card
    H.todayCard = function (s) {
      if (!active(s)) return '';
      var p = prog(s), now = new Date(), ds = ymd(now), mark = p.days[ds], nx = next(s), c = count(s), stk = streak(s, now);
      var pct = nx ? (c - nx.from) / (nx.step.n - nx.from) : 1;
      var dayN = p.start ? Math.floor((now - parse(p.start)) / DAY) + 1 : 1;
      var html = '';
      if (p.pause && paused(s, ds)) {
        return '<div class="hp-card paused"><div><b>⏸ Your program is paused</b><span>Until ' + esc(p.pause.to || '…') + ' · your ' + c + ' check-ins and rewards are safe</span></div><button class="btn sm focusable" data-hp="resume">Resume</button></div>';
      }
      var low = lowSupply(s, now)[0];
      if (low) {
        var code = bestCode(s);
        // product name as a placeholder, so one translation fits every product
        html += '<div class="hp-card supply"><div><b><span translate="no">' + esc(low.it.name) + '</span>: ' + (low.sup.daysLeft ? low.sup.daysLeft + (low.sup.daysLeft === 1 ? ' day' : ' days') + ' left' : 'running out today') + '</b>' +
          '<span>Reorder now so your routine (' + c + ' check-ins) doesn’t pause' + (code ? ' – your reward code is applied' : '') + '.</span></div>' +
          '<div class="hp-btns"><a class="btn sm primary focusable" data-reorder="' + low.it.id + '" href="' + esc(H.reorderUrl(low.it, code, 'supply_low') || '#') + '" target="_blank" rel="noopener">🛒 Reorder</a>' +
          '<button class="btn sm ghost focusable" data-supply-snooze="' + low.it.id + '">In 3 days</button></div></div>';
      }
      var miss = missedRun(s, now);
      if (miss >= 3 && !mark) {
        html += '<div class="hp-card gentle"><div><b>Life gets busy – that’s okay 🌿</b><span>Your ' + c + ' check-ins are safe. Want to make it easier?</span></div>' +
          '<div class="hp-btns"><button class="btn sm focusable" data-hp="time">Change time</button><button class="btn sm focusable" data-hp="fewer">Fewer reminders</button><button class="btn sm ghost focusable" data-hp="pause">Pause 1 week</button></div></div>';
      }
      if (weeklyDue(s, now)) html += '<div class="hp-card weekly" data-hp="weekly" tabindex="0"><div><b>📊 Your weekly check-in · 20 seconds</b><span>Three taps – see your progress week by week</span></div><button class="btn sm primary focusable" data-hp="weekly">Start</button></div>';
      // one name for the whole-day confirmation: per-product ticks live in Today's plan below
      var doneLbl = items(s).length > 1 ? '✅ All taken' : '✅ Taken';
      html += '<div class="hp-check' + (mark === 'done' ? ' done' : '') + '">' +
        '<div class="hp-top"><span class="hp-day">' + (TIMES[p.checkinTime] || '').split(' ')[0] + ' Day ' + dayN + '</span>' + (stk > 1 ? '<span class="hp-streak">🔥 ' + stk + ' in a row</span>' : '') + '</div>' +
        '<b class="hp-q">' + (mark === 'done' ? '✓ Checked in today – nice!' : mark === 'skip' ? 'No problem – tomorrow is a fresh start.' : 'Took your supplements today?') + '</b>' +
        (nx ? '<div class="hp-bar"><i style="width:' + Math.round(pct * 100) + '%"></i></div><div class="hp-next">' + c + ' check-ins · <b>' + nx.left + ' more</b> to ' + nx.step.ico + ' ' + esc(nx.step.title.toLowerCase()) + '</div>'
          : '<div class="hp-next">' + c + ' check-ins · every reward unlocked 🏆</div>') +
        (mark ? (mark === 'done' ? '' : '<div class="hp-btns"><button class="btn sm focusable" data-hp="done">Actually, I did ✅</button></div>')
          : (p.snooze > Date.now() ? '<div class="hp-btns"><button class="btn sm primary focusable" data-hp="done">' + doneLbl + '</button><span class="hint">I’ll ask again later</span></div>'
            : '<div class="hp-btns"><button class="btn primary focusable" data-hp="done">' + doneLbl + '</button><button class="btn sm focusable" data-hp="later">⏰ Later</button><button class="btn sm ghost focusable" data-hp="skip">Not today</button></div>')) +
        '<button class="hp-link focusable" data-go="program">My program →</button></div>';
      return html;
    };

    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-hp]'), s = st();
      if (b && s) {
        var a = b.getAttribute('data-hp'), p = prog(s);
        if (a === 'done') { var got = checkin(s, 'done'); save(); App.toast(nextToast(s)); emit('checkin_streak', { checkins: count(s), streak: streak(s) }); App.refresh(); celebrate(got); }
        else if (a === 'skip') { checkin(s, 'skip'); save(); App.toast('Nothing lost – see you tomorrow 🌿'); App.refresh(); }
        else if (a === 'later') { p.snooze = Date.now() + 3 * 3600e3; save(); App.toast('Okay – I’ll ask again in a few hours'); App.refresh(); }
        else if (a === 'resume') { p.pause = null; save(); App.toast('Welcome back! 🌿'); App.refresh(); }
        else if (a === 'pause') { var t = new Date(); p.pause = { from: ymd(t), to: ymd(addDays(t, 6)) }; save(); emit('program_paused', { until: p.pause.to }); App.toast('Paused for a week – nothing is lost'); App.refresh(); }
        else if (a === 'fewer') { p.reminders = '3x'; save(); App.toast('Reminders 3× a week from now on'); App.refresh(); }
        else if (a === 'time') App.go('program', { edit: 'time' });
        else if (a === 'weekly') openWeekly();
        e.preventDefault(); return;
      }
      var r = e.target.closest('[data-reorder]');
      if (r && s) { emit('reorder_clicked', { product: r.getAttribute('data-reorder'), checkins: count(s) }); var c = bestCode(s); if (c) [30, 7].forEach(function (n) { var x = prog(s).rewards[n]; if (x && x.code === c) x.used = new Date().toISOString(); }); save(); return; }
      var z = e.target.closest('[data-supply-snooze]');
      if (z && s) { prog(s).supplySnooze[z.getAttribute('data-supply-snooze')] = ymd(addDays(new Date(), 3)); save(); App.toast('I’ll remind you in 3 days'); App.refresh(); }
    });
    function nextToast(s) {
      var nx = next(s), c = count(s);
      return nx ? '✅ ' + c + (c === 1 ? ' check-in' : ' check-ins') + ' – ' + nx.left + ' more to your ' + nx.step.title.toLowerCase() : '✅ ' + c + ' check-ins – legend';
    }
    // keep the day in step with per-item ticks on Today
    H.afterTick = function () { var s = st(); if (!s || !active(s)) return; var got = syncDay(s); save(); if (got) celebrate(got); };

    // ---------------------------------------------------------------- weekly check-in (3 taps)
    var FACES = ['😩', '😕', '😐', '🙂', '🤩'];
    function openWeekly() {
      var s = st(), gq = goalQuestion(s), ans = {};
      var qs = [{ k: 'energy', q: 'Energy this week?' }, { k: 'sleep', q: 'How did you sleep?' }, gq];
      var w = document.createElement('div'); w.className = 'sheet-wrap';
      w.innerHTML = '<div class="sheet"><div class="sh-grab"></div><h3>Your week in 3 taps</h3><p class="sh-sub">Only you see this – it turns into your progress chart.</p>' +
        qs.map(function (q) { return '<div class="wq"><b>' + esc(q.q) + '</b><div class="wq-faces">' + FACES.map(function (f, i) { return '<button class="focusable" data-wq="' + q.k + '" data-v="' + (i + 1) + '">' + f + '</button>'; }).join('') + '</div></div>'; }).join('') +
        '<button class="btn primary focusable sh-save" id="wqSave" disabled>Save</button></div>';
      document.body.appendChild(w);
      w.addEventListener('click', function (e) { if (e.target === w) w.remove(); });
      $$('[data-wq]', w).forEach(function (b) {
        b.onclick = function () {
          var k = b.getAttribute('data-wq'); ans[k] = +b.getAttribute('data-v');
          $$('[data-wq="' + k + '"]', w).forEach(function (x) { x.classList.toggle('on', x === b); });
          $('#wqSave', w).disabled = Object.keys(ans).length < 3;
        };
      });
      $('#wqSave', w).onclick = function () {
        var s2 = st(), p = prog(s2), key = weekKey(new Date());
        p.weekly[key] = { energy: ans.energy, sleep: ans.sleep, goal: ans.goal, at: new Date().toISOString() };
        save(); w.remove();
        var rv = review(s2, new Date());
        emit('weekly_review', { week: key, adherence: rv ? rv.adh.done + '/' + rv.adh.due : '', energy: ans.energy, sleep: ans.sleep });
        App.toast('Saved – see your week in My program'); App.go('program', {});
      };
    }
    H.openWeekly = openWeekly;

    // ---------------------------------------------------------------- My program
    function shareStory() {
      var s = st();
      if (!App.share) return;
      var c = count(s), p = prog(s), wk = Object.keys(p.weekly).sort(), first = p.weekly[wk[0]], last = p.weekly[wk[wk.length - 1]];
      App.share({ kind: 'routine', eyebrow: 'My routine · since ' + new Date(p.start).toLocaleDateString((window.I18N && I18N.locale || 'en-GB'), { day: 'numeric', month: 'short' }), title: c + ' check-ins',
        subtitle: items(s).map(function (x) { return x.name; }).slice(0, 3).join(' · '),
        stats: [[streak(s) + ' days', 'in a row'], [Object.keys(p.rewards).length, 'rewards'], first && last ? [(last.energy - first.energy >= 0 ? '+' : '') + (last.energy - first.energy), 'energy trend'] : [wk.length, 'weekly reviews']],
        badge: c >= 90 ? '🏆 90 days of looking after myself' : c >= 30 ? '🏅 30 check-ins' : '',
        caption: c + ' days of my daily routine ✅ Small steps, every day.', tags: ['#Rutina', '#NaturesFinest', '#dailyroutine'] });
    }
    App.SCREENS.program = function (p) {
      var s = st(), pr = prog(s), now = new Date(), c = count(s), nx = next(s), stk = streak(s, now), list = items(s);
      if (!list.length) { App.go('routine', {}, true); return; }
      var cal = '', mon = mondayOf(addDays(now, -28));
      for (var i = 0; i < 35; i++) {
        var d = addDays(mon, i), ds = ymd(d), m = pr.days[ds];
        cal += '<i class="' + (m === 'done' ? 'd' : m === 'skip' ? 's' : paused(s, ds) ? 'p' : '') + (ds === ymd(now) ? ' t' : '') + (ds > ymd(now) ? ' f' : '') + '" title="' + ds + '"></i>';
      }
      var ladder = LADDER.map(function (st2) {
        var got = pr.rewards[st2.n];
        return '<div class="lad' + (got ? ' got' : nx && nx.step.n === st2.n ? ' next' : '') + '"><span class="lad-ico">' + st2.ico + '</span><div><b>' + st2.n + ' · ' + esc(st2.title) + '</b><small>' + esc(rewardText(st2.n)) + '</small>' +
          (got && got.code ? '<div class="u-code sm"><code>' + esc(got.code) + '</code>' + (got.used ? '<em>used</em>' : '') + '</div>' : !got && nx && nx.step.n === st2.n ? '<small class="lad-left">' + nx.left + ' to go</small>' : '') + '</div></div>';
      }).join('');
      var supplies = list.map(function (it) {
        var sup = supply(s, it, now), c2 = it.pid && catalog(it.pid);
        return '<div class="sup-row"><div><b>' + esc(it.name) + '</b><small>' + (sup ? sup.left + ' of ' + sup.servings + ' servings · lasts until <span translate="no">' + new Date(sup.runOut).toLocaleDateString((window.I18N && I18N.locale || 'en-GB'), { day: 'numeric', month: 'short' }) + '</span>' : 'Add your pack to get a run-out reminder') + '</small>' +
          (sup ? '<div class="sbar"><i style="width:' + Math.round(sup.left / sup.servings * 100) + '%"' + (sup.daysLeft <= 5 ? ' class="low"' : '') + '></i></div>' : '') + '</div>' +
          '<div class="hp-btns">' + (sup && c2 ? '<a class="btn sm' + (sup.daysLeft <= 5 ? ' primary' : '') + ' focusable" data-reorder="' + it.id + '" href="' + esc(H.reorderUrl(it, bestCode(s), 'program') || '#') + '" target="_blank" rel="noopener">🛒 ' + (sup.daysLeft <= 5 ? 'Reorder' : 'Order') + '</a>' : '') +
          '<button class="btn sm ghost focusable" data-pack="' + it.id + '">' + (sup ? 'New pack' : 'Add pack') + '</button></div></div>';
      }).join('');
      var rv = review(s, now), wk = Object.keys(pr.weekly).sort().slice(-8);
      function spark(k) {
        if (wk.length < 2) return '';
        return '<svg class="pchart wk" viewBox="0 0 100 40" preserveAspectRatio="none"><polyline class="c-' + k + '" points="' + wk.map(function (w, i) { return (i / (wk.length - 1) * 100).toFixed(1) + ',' + (38 - (pr.weekly[w][k] - 1) / 4 * 34).toFixed(1); }).join(' ') + '"/></svg>';
      }
      function delta(k) { return rv && rv.prev ? (rv.cur[k] > rv.prev[k] ? ' ↑' : rv.cur[k] < rv.prev[k] ? ' ↓' : ' →') : ''; }
      var cross = crossPick(s, now);
      var html = '<div class="screen"><div class="topbar"><h1>My program</h1><div class="spacer"></div>' + (App.share ? '<button class="btn sm ghost focusable" id="pgShare">↗ Share</button>' : '') + '</div>' +
        '<div class="pg-hero"><div class="pg-ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" class="dr-bg"/><circle cx="60" cy="60" r="52" class="dr-fg" stroke-dasharray="326.7" stroke-dashoffset="' + (326.7 * (1 - (nx ? (c - nx.from) / (nx.step.n - nx.from) : 1))).toFixed(1) + '"/></svg><b>' + c + '</b><span>check-ins</span></div>' +
        '<div class="pg-hero-txt"><h2>' + (nx ? nx.left + ' more to ' + nx.step.ico + ' ' + esc(nx.step.title.toLowerCase()) : 'Every reward unlocked 🏆') + '</h2><p>' + esc(H.expectation(s, now)) + '</p>' +
        '<div class="pg-chips"><span>🔥 ' + stk + ' in a row</span>' + (H.freezes(s) ? '<span>❄️ ' + H.freezes(s) + (H.freezes(s) === 1 ? ' streak freeze' : ' streak freezes') + '</span>' : '') + '<span>' + (TIMES[pr.checkinTime] || '') + '</span><span>🔔 ' + (pr.reminders === 'off' ? 'no reminders' : pr.reminders === '3x' ? 'reminders 3× a week' : 'daily reminder') + '</span></div></div></div>' +
        '<div class="panel"><h3>Rewards for consistency</h3><div class="ladder">' + ladder + '</div><div class="hint">Check-ins add up – a missed day never takes anything away.</div></div>' +
        '<div class="panel"><h3>Your last 5 weeks</h3><div class="cal">' + [1, 2, 3, 4, 5, 6, 0].map(function (i) { var x = new Date(2023, 0, 1 + i).toLocaleDateString((global.I18N && I18N.locale) || 'en-GB', { weekday: 'narrow' }); return '<span translate="no">' + x + '</span>'; }).join('') + cal + '</div><div class="tw-legend"><span><i class="gym"></i>checked in</span><span><i class="skipd"></i>not today</span></div></div>' +
        '<div class="panel"><h3>Supply</h3>' + supplies + '<div class="hint">I’ll tell you 5 days before you run out – reorder in one tap, your reward code included.</div></div>' +
        '<div class="panel"><h3>Weekly progress</h3>' + (rv ? '<div class="act-tot"><div><b>' + rv.adh.done + '/' + rv.adh.due + '</b><span>this week' + (rv.adhPrev.due ? ' (was ' + rv.adhPrev.done + '/' + rv.adhPrev.due + ')' : '') + '</span></div>' +
          '<div><b>' + rv.cur.energy + delta('energy') + '</b><span>⚡ energy</span></div><div><b>' + rv.cur.sleep + delta('sleep') + '</b><span>😴 sleep</span></div></div>' + spark('energy') + spark('sleep') : '<div class="hint">Your first weekly check-in comes after a few days – three taps, then your trend appears here.</div>') +
        (weeklyDue(s, now) ? '<button class="btn primary focusable" data-hp="weekly">📊 Do this week’s check-in</button>' : '') + '</div>' +
        (cross ? '<div class="panel pg-cross"><h3>Recommended for your goal</h3><div class="r-add"><img src="' + esc(cross.img) + '" alt=""><span><b>' + esc(cross.name) + '</b><small>Many people with your goal have it in their routine. ' + esc(cross.use ? cross.use.tip : '') + '</small></span></div>' +
          '<div class="hp-btns"><a class="btn sm primary focusable" id="pgCross" href="' + esc(H.reorderUrl({ pid: cross.id }, null, 'complement') || '#') + '" target="_blank" rel="noopener">Add to my next package</a><button class="btn sm ghost focusable" id="pgCrossNo">No, thanks</button></div></div>' : '') +
        '<div class="panel"><h3>Settings</h3><div class="opt-row"><div class="k">My check-in moment</div>' + Object.keys(TIMES).map(function (k) { return '<button class="chip focusable' + (pr.checkinTime === k ? ' on' : '') + '" data-ct="' + k + '" data-fid="ct-' + k + '">' + TIMES[k] + '</button>'; }).join('') + '</div>' +
        '<div class="opt-row"><div class="k">Reminders</div>' + [['daily', 'Every day'], ['3x', '3× a week'], ['off', 'Off']].map(function (x) { return '<button class="chip focusable' + (pr.reminders === x[0] ? ' on' : '') + '" data-rem="' + x[0] + '" data-fid="rem-' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
        '<div class="opt-row"><div class="k">Pause</div>' + (pr.pause ? '<button class="btn sm focusable" data-hp="resume">Resume now</button><span class="hint">paused until ' + esc(pr.pause.to) + '</span>' : '<button class="btn sm ghost focusable" data-hp="pause">Pause 1 week</button><span class="hint">holidays, illness – progress and rewards stay frozen</span>') + '</div>' +
        '<div class="opt-row"><button class="btn sm ghost focusable" data-go="routine">✎ Edit supplements & times</button></div></div></div>';
      App.$('#app').innerHTML = html;
      if (cross) emit('complement_suggested', { product: cross.name, product_id: cross.id });
      $$('[data-ct]').forEach(function (b) { b.onclick = function () { pr.checkinTime = b.getAttribute('data-ct'); save(); App.refresh(); }; });
      $$('[data-rem]').forEach(function (b) { b.onclick = function () { pr.reminders = b.getAttribute('data-rem'); save(); App.refresh(); }; });
      if ($('#pgShare')) $('#pgShare').onclick = shareStory;
      if ($('#pgCross')) $('#pgCross').onclick = function () { pr.cross.last = new Date().toISOString(); save(); };
      if ($('#pgCrossNo')) $('#pgCrossNo').onclick = function () { pr.cross.last = new Date().toISOString(); pr.cross.dismissed.push(cross.id); save(); App.toast('Got it – no more suggestions for a while'); App.refresh(); };
      $$('[data-pack]').forEach(function (b) { b.onclick = function () { openPack(b.getAttribute('data-pack')); }; });
      if (p.edit === 'time') { var el = $('[data-fid="ct-' + pr.checkinTime + '"]'); if (el) el.scrollIntoView({ block: 'center' }); }
    };

    // new pack: start today, servings from the label (or quick choices)
    function openPack(id) {
      var s = st(), it = items(s).filter(function (x) { return x.id === id; })[0]; if (!it) return;
      var c = it.pid && catalog(it.pid), def = (it.pack && it.pack.servings) || (c && c.pack && c.pack.servings) || 30;
      var w = document.createElement('div'); w.className = 'sheet-wrap';
      w.innerHTML = '<div class="sheet"><div class="sh-grab"></div><h3>📦 New pack: ' + esc(it.name) + '</h3><p class="sh-sub">Servings in the pack – it’s on the label</p>' +
        '<div class="sh-row">' + [30, 60, 90, 120].concat(def % 30 ? [def] : []).sort(function (a, b) { return a - b; }).map(function (n) { return '<button class="chip focusable' + (n === def ? ' on' : '') + '" data-sv="' + n + '">' + n + '</button>'; }).join('') + '</div>' +
        '<div class="opt-row"><div class="k">Servings per day</div>' + [1, 2, 3].map(function (n) { return '<button class="chip focusable' + ((it.perDay || 1) === n ? ' on' : '') + '" data-pd="' + n + '">' + n + '</button>'; }).join('') + '</div>' +
        '<button class="btn primary focusable sh-save" id="pkSave">Started today</button></div>';
      document.body.appendChild(w);
      var sv = def, pd = it.perDay || 1;
      w.addEventListener('click', function (e) { if (e.target === w) w.remove(); });
      $$('[data-sv]', w).forEach(function (b) { b.onclick = function () { sv = +b.getAttribute('data-sv'); $$('[data-sv]', w).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
      $$('[data-pd]', w).forEach(function (b) { b.onclick = function () { pd = +b.getAttribute('data-pd'); $$('[data-pd]', w).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
      $('#pkSave', w).onclick = function () {
        it.pack = { start: ymd(), servings: sv }; it.perDay = pd; delete prog(s).supplySnooze[it.id]; save(); w.remove();
        App.toast('Got it – I’ll remind you before it runs out'); App.refresh();
      };
    }
    H.openPack = openPack;

    // ---------------------------------------------------------------- product guide (QR on the pack lands here)
    App.SCREENS.product = function (p) {
      var c = catalog(p.id) || (P() && P().ITEMS.filter(function (x) { return String(x.sku) === String(p.id); })[0]);
      if (!c) { App.toast('Product not found'); App.resetTo('home'); return; }
      var s = st(), have = items(s).filter(function (x) { return x.pid === c.id; })[0];
      var u = c.use || {};
      App.$('#app').innerHTML = '<div class="screen"><div class="topbar"><h1>' + esc(c.name) + '</h1></div>' +
        '<div class="prod-hero"><img src="' + esc(c.img) + '" alt=""><div><div class="kicker">Your Nature’s Finest product</div><h2>How to take it</h2>' +
        '<dl class="how"><dt>Dose</dt><dd>' + esc(u.dose || 'As on the label') + '</dd><dt>When</dt><dd>' + esc(({ morning: 'Morning', midday: 'Midday', pre: 'Before training', post: 'After training', evening: 'Evening', bed: 'Before bed' })[u.slot] || 'Daily') + '</dd><dt>How often</dt><dd>' + (u.days === 'training' ? 'Training days' : 'Every day') + '</dd></dl>' +
        (u.tip ? '<p>💡 ' + esc(u.tip) + '</p>' : '') + '<p class="hint">' + esc(c.claim) + '</p></div></div>' +
        '<div class="panel"><h3>What to expect</h3><p>The routine is what makes the difference: same moment, every day, for weeks – not days. I’ll remind you, count your check-ins and reward your consistency.</p>' +
        '<ul class="acct-why"><li>🎁 First reward after 7 check-ins</li><li>📦 A reminder 5 days before your pack runs out</li><li>📊 A 20-second weekly check-in to see your progress</li></ul></div>' +
        '<div class="act-foot">' + (have ? '<button class="btn primary focusable" data-go="program">Open my program →</button><button class="btn focusable" id="prNew">📦 I opened a new pack</button>'
          : '<button class="btn primary focusable" id="prAdd">＋ Start my routine – pack opened today</button>') + '</div>' +
        '<div class="hint">' + esc((P().CONFIG.disclaimer) || '') + ' Do not exceed the recommended daily dose.</div></div>';
      if ($('#prAdd')) $('#prAdd').onclick = function () {
        var s2 = st(), it = { id: 'r' + Date.now().toString(36), pid: c.id, name: c.name, dose: u.dose || '', slot: u.slot || 'morning', days: u.days || 'daily', pack: { start: ymd(), servings: (c.pack && c.pack.servings) || 30 }, perDay: 1 };
        var first = !items(s2).length;
        s2.settings.routine = items(s2).concat([it]);
        if (first) prog(s2).start = prog(s2).start || ymd();
        save(); emit('routine_started', { product: c.name, product_id: c.id, checkin_time: prog(s2).checkinTime, src: p.src || '' });
        if (first) App.go('program', { edit: 'time' }, true); else App.go('program', {}, true);
        App.toast(first ? 'Your routine starts today 🌿 Pick your check-in moment' : c.name + ' added – one check-in for everything');
      };
      if ($('#prNew')) $('#prNew').onclick = function () { openPack(have.id); };
    };

    // QR deep link: ?p=<id|sku>&src=pack – survives onboarding (new users create a profile first)
    try {
      var q = new URLSearchParams(location.search), pid = q.get('p');
      if (pid) {
        sessionStorage.setItem('fs.product', JSON.stringify({ id: pid, src: q.get('src') || 'qr' }));
        try { if (global.Cloud && Cloud.scan) Cloud.scan(pid, q.get('src') || 'qr', q.get('b')); } catch (e) {}
        history.replaceState(history.state, '', location.pathname);
      }
    } catch (e) {}
    // once-per-occasion server events that drive e-mail / WhatsApp reminders (Klaviyo flows)
    function daily() {
      var s = st(); if (!s || !active(s)) return;
      var p = prog(s), sent = p.sent = p.sent || {}, now = new Date(), changed = false;
      lowSupply(s, now).forEach(function (x) {
        var k = 'supply:' + x.it.id + ':' + x.it.pack.start;
        if (!sent[k]) { sent[k] = ymd(now); changed = true; emit('supply_low', { product: x.it.name, product_id: x.it.pid || '', days_left: x.sup.daysLeft, reorder_url: H.reorderUrl(x.it, bestCode(s), 'supply_low') || '', checkins: count(s) }); }
      });
      var miss = missedRun(s, now);
      if (miss >= 3) { var mk = 'missed:' + ymd(addDays(now, -miss)); if (!sent[mk]) { sent[mk] = ymd(now); changed = true; emit('checkins_missed', { missed: miss, checkins: count(s), checkin_time: p.checkinTime }); } }
      if (changed) save();
    }
    var home = App.SCREENS.home;
    App.SCREENS.home = function (p) {
      home(p);
      try { daily(); } catch (e) {}
      var pend; try { pend = JSON.parse(sessionStorage.getItem('fs.product') || 'null'); } catch (e) {}
      if (pend && st()) { sessionStorage.removeItem('fs.product'); setTimeout(function () { App.go('product', pend); }, 0); }
    };
  });
})(typeof window !== 'undefined' ? window : global);
