/*
 * Reminders outside the app – the client half.
 *
 * The server (supabase/functions/reminders, every 15 min) decides what to send from one small row per
 * routine: public.reminder_state. This module keeps that row current, asks for permission at the right
 * moment, and registers the phone for web push. The full rule set is in docs/reminders.md:
 *   - at most one push a day, never between 21:30 and 07:00 local time, nothing while paused
 *   - the daily nudge comes at the customer's own moment (coffee / breakfast / lunch / evening, or the
 *     time they actually check in, learned from the last check-ins) and only if today is still open
 *   - e-mail only for what matters: running low, three quiet days, a fresh start after two weeks
 * Push needs an account to address it: if the customer has none yet, a reminders-only (anonymous)
 * account is created with their explicit consent; adding an e-mail later keeps everything.
 */
(function (global) {
  'use strict';
  // the reminder texts the server sends (translated with the app: tools/i18n → supabase/functions/_shared)
  var TEXT = {
    checkin_coffee: ['☕ Coffee time', 'Your {product} goes with it – one tap and today is ticked.'],
    checkin_breakfast: ['🍳 Breakfast time', 'Your {product} goes with it – one tap and today is ticked.'],
    checkin_lunch: ['🥗 Lunch time', 'Your {product} goes with it – one tap and today is ticked.'],
    checkin_evening: ['🌙 Evening routine', 'Your {product} goes with it – one tap and today is ticked.'],
    streak: ['🔥 {n} days in a row', 'Today is still open – one tap keeps it going.'],
    missed: ['Life gets busy 💚', 'Pick up where you left off – your {n} check-ins are safe. A different time or fewer reminders?'],
    winback: ['A fresh week, a fresh start 🌱', 'Your routine is waiting. Start again today – your rewards are still yours.'],
    supply: ['📦 {product}: 5 days left', 'Reorder now so your routine doesn’t break – your reward is applied.'],
    runout: ['Last serving today?', '{product} runs out today. Reorder in one tap and keep going.'],
    weekly: ['📊 Your week in 20 seconds', '3 quick taps – see how this week compares.'],
    done: ['✅ Done', '']
  };
  var ANCHOR_MIN = { coffee: 7 * 60 + 30, breakfast: 8 * 60, lunch: 12 * 60 + 30, evening: 20 * 60 };

  function pad(n) { return ('0' + n).slice(-2); }
  function hhmm(min) { return pad(Math.floor(min / 60)) + ':' + pad(min % 60); }
  function toMin(s) { var m = /^(\d{1,2}):(\d{2})$/.exec(s || ''); return m ? Math.min(23 * 60 + 59, +m[1] * 60 + +m[2]) : null; }
  // when does this person actually check in? median of the last 7 check-in times (local), if ≥4 known
  function learned(s) {
    var days = (s.settings.intake || {}), mins = [];
    Object.keys(days).sort().slice(-7).forEach(function (d) {
      var first = Object.keys(days[d]).map(function (k) { return days[d][k]; }).sort()[0];
      if (first) { var t = new Date(first); mins.push(t.getHours() * 60 + t.getMinutes()); }
    });
    if (mins.length < 4) return null;
    mins.sort(function (a, b) { return a - b; });
    return mins[Math.floor(mins.length / 2)];
  }
  // reminder_state row for a profile (pure – unit-tested in tools/health.cjs)
  function stateRow(s, now) {
    var H = global.Health; now = now || new Date();
    var p = H.prog(s), items = H.items(s), r = p.remind || {};
    var low = items.map(function (it) { return { it: it, sup: H.supply(s, it, now) }; }).filter(function (x) { return x.sup; })
      .sort(function (a, b) { return a.sup.runOut < b.sup.runOut ? -1 : 1; })[0];
    var done = Object.keys(p.days).filter(function (k) { return p.days[k] === 'done'; }).sort();
    var tz = 'UTC'; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) {}
    return {
      member_id: s.id, tz: tz, lang: (global.I18N && I18N.lang) || 'en',
      anchor: p.checkinTime || 'breakfast',
      remind_min: r.at != null ? r.at : ANCHOR_MIN[p.checkinTime] || ANCHOR_MIN.breakfast,
      learned_min: r.at != null ? null : learned(s),
      freq: p.reminders || 'daily', paused_until: p.pause ? (p.pause.to || '9999-12-31') : null,
      start_date: p.start || null, last_checkin: done[done.length - 1] || null, checkins: H.count(s), streak: H.streak(s, now),
      product: items[0] ? items[0].name : null, runout: low ? low.sup.runOut : null, runout_product: low ? low.it.name : null,
      runout_url: low ? H.reorderUrl(low.it, H.bestCode(s), 'supply_low') : null,
      weekly_last: Object.keys(p.weekly).sort().pop() || null,
      push: !!r.push, email: !!r.email
    };
  }
  global.Reminders = { TEXT: TEXT, ANCHOR_MIN: ANCHOR_MIN, stateRow: stateRow, learned: learned, hhmm: hhmm, toMin: toMin };
  if (!global.FS_MODULES) return;

  global.FS_MODULES.push(function (App) {
    var $ = App.$, $$ = App.$$, esc = App.esc, H = global.Health, CFG = global.FS_CONFIG || {};
    var C = function () { return global.Cloud && Cloud.configured && Cloud.configured() ? Cloud : null; };
    function st() { return App.state(); }
    function prog() { return H.prog(st()); }
    function rem() { var p = prog(); return (p.remind = p.remind || {}); }
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
    function standalone() { return (global.Native && Native.is) || (global.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
    function pushPossible() { return 'serviceWorker' in navigator && 'PushManager' in global && 'Notification' in global && !!CFG.vapidPublicKey && (!ios || standalone()); }
    function b64(s) { var p = '='.repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')), a = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) a[i] = r.charCodeAt(i); return a; }

    // keep the server's copy of the schedule fresh (after every change, debounced)
    var timer = null;
    function push() {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var s = st(), c = C();
        if (!s || !c || !c.user() || !H.active(s)) return;
        var r = rem(); if (!r.push && !r.email) return;
        c.remindState(stateRow(s)).catch(function () {});
      }, 2500);
    }
    if (global.Store && Store.onSave) Store.onSave(push);

    function subscribe() {
      return navigator.serviceWorker.ready.then(function (reg) {
        return reg.pushManager.getSubscription().then(function (old) {
          return old || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(CFG.vapidPublicKey) });
        });
      }).then(function (sub) { return C().pushSave(sub, (global.I18N && I18N.lang) || 'en'); });
    }
    function ensureUser(consented) {
      var c = C();
      if (c.user()) return Promise.resolve(c.user());
      if (!consented) return Promise.reject(new Error('consent'));
      return c.signInAnon({ health_data: true, reminders: true });
    }

    // the one ask: a sheet with the real benefit, the rules, and (without an account) the consent
    function offer(where) {
      var c = C(), s = st(), p = prog(), when = rem().at != null ? hhmm(rem().at) : ({ coffee: '☕ coffee time', breakfast: '🍳 breakfast', lunch: '🥗 lunch', evening: '🌙 evening' })[p.checkinTime] || 'your moment';
      if (!c) { App.toast('Reminders switch on at launch – your routine works on this phone meanwhile.'); return; }
      var needUser = !c.user(), w = document.createElement('div'); w.className = 'sheet-wrap';
      w.innerHTML = '<div class="sheet rem-sheet"><div class="sh-grab"></div><h3>🔔 A nudge at ' + esc(when) + '?</h3>' +
        '<ul class="acct-why"><li>Only if today isn’t ticked yet</li><li>One a day at most – never at night</li><li>5 days before your pack runs out</li><li>Off with one tap, any time</li></ul>' +
        (needUser ? '<label class="check"><input type="checkbox" id="rmOk" class="focusable"><span>I agree that Nature’s Finest stores my routine check-ins (health-related data) in the EU to send me these reminders. No e-mail needed; I can switch it off and delete it any time.</span></label>' : '') +
        (pushPossible() ? '<button class="btn primary focusable" id="rmPush">🔔 Yes, remind me on this phone</button>'
          : ios && !standalone() ? '<p class="hint">On iPhone, reminders work once Rutina is on your home screen: tap Share ⬆︎ → “Add to Home Screen”, then open it from there.</p>' : '') +
        '<button class="btn focusable" id="rmMail">✉️ Remind me by e-mail instead</button><button class="btn ghost focusable" id="rmNo">Not now</button></div>';
      document.body.appendChild(w);
      var close = function () { w.remove(); };
      w.addEventListener('click', function (e) { if (e.target === w) close(); });
      $('#rmNo', w).onclick = function () { rem().askedAt = Date.now(); App.save(); close(); };
      $('#rmMail', w).onclick = function () { close(); rem().email = true; App.save(); App.go('account'); };
      if ($('#rmPush', w)) $('#rmPush', w).onclick = function () {
        var btn = this;
        if (needUser && !$('#rmOk', w).checked) { App.toast('Please tick the consent first – reminders can’t work without it'); return; }
        btn.disabled = true;
        // ask the browser inside the tap (iOS requires a user gesture)
        Notification.requestPermission().then(function (perm) {
          if (perm !== 'granted') throw new Error('denied');
          return ensureUser(true);
        }).then(subscribe).then(function () {
          rem().push = true; rem().askedAt = Date.now(); App.save(); push(); close();
          App.toast('Done – see you at ' + when + ' 🌿');
          try { Cloud.event('reminders_on', { channel: 'push', where: where || '' }, s.id); } catch (e) {}
          App.refresh();
        }).catch(function (e) {
          btn.disabled = false;
          App.toast(e && e.message === 'denied' ? 'Notifications are blocked – allow them in the browser settings, or use e-mail.' : 'Couldn’t switch on reminders – try again in a moment.');
        });
      };
    }
    global.Reminders.offer = offer;

    // Today: after the 1st check-in (the value is felt), one card – until answered or dismissed
    var home = App.SCREENS.home;
    App.SCREENS.home = function (p) {
      home(p);
      var s = st(); if (!s || !C() || !H || !H.active(s)) return;
      var r = rem();
      if (r.push || r.email || (r.askedAt && Date.now() - r.askedAt < 7 * 864e5) || H.count(s) < 1) return;
      var box = document.querySelector('.hp-card, .hp-check'); if (!box || document.querySelector('.rem-card')) return;
      var card = document.createElement('div'); card.className = 'hp-card rem-card';
      card.innerHTML = '<div><b>🔔 Want a nudge if you forget?</b><span>Only on days you haven’t ticked yet – never at night.</span></div><button class="btn sm primary focusable" id="remYes">Yes</button><button class="btn sm ghost focusable" id="remNo">Not now</button>';
      box.parentNode.insertBefore(card, box.nextSibling);
      $('#remYes').onclick = function () { offer('today'); };
      $('#remNo').onclick = function () { r.askedAt = Date.now(); App.save(); card.remove(); };
    };

    // Program screen: the controls (time, channels) under the existing reminder rhythm chips
    var program = App.SCREENS.program;
    App.SCREENS.program = function (p) {
      program(p);
      var s = st(); if (!s || !H.active(s)) return;
      var r = rem(), def = r.at != null ? r.at : ANCHOR_MIN[prog().checkinTime] || ANCHOR_MIN.breakfast, lm = learned(s);
      var el = document.createElement('div'); el.className = 'panel rem-panel';
      el.innerHTML = '<h3>🔔 Reminders outside the app</h3>' +
        '<div class="opt-row"><div class="k">Time</div><input type="time" id="rmAt" class="focusable" value="' + hhmm(def) + '">' +
        (r.at == null && lm != null ? '<span class="hint">You usually check in around ' + hhmm(lm) + ' – I’ll nudge you just before.</span>' : '') + '</div>' +
        '<div class="opt-row"><div class="k">Channels</div><button class="chip focusable' + (r.push ? ' on' : '') + '" id="rmP">🔔 This phone</button><button class="chip focusable' + (r.email ? ' on' : '') + '" id="rmE">✉️ E-mail</button></div>' +
        '<div class="hint">One a day at most, never 21:30–07:00, nothing while paused. E-mail only for: running low, three quiet days and a fresh start.</div>';
      var anchor = document.querySelector('.screen'); if (!anchor) return;
      anchor.appendChild(el);
      $('#rmAt').onchange = function () { var m = toMin(this.value); if (m != null) { r.at = m; App.save(); App.toast('Reminder at ' + hhmm(m)); } };
      $('#rmP').onclick = function () {
        if (r.push) { r.push = false; App.save(); push(); navigator.serviceWorker && navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) { if (sub) { C() && C().pushDelete(sub.endpoint); sub.unsubscribe(); } }).catch(function () {}); App.refresh(p); }
        else offer('program');
      };
      $('#rmE').onclick = function () {
        var c = C();
        if (!r.email && (!c || !c.user() || c.user().anon)) { r.email = true; App.save(); App.go('account'); return; }
        r.email = !r.email; App.save(); push();
        if (c && c.user() && !c.user().anon) c.setConsent('reminders', r.email).catch(function () {});
        App.refresh(p);
      };
    };

    // a notification tap lands here: ?a=checkin (✅ Done on the notification) or ?go=<screen>
    try {
      var q = new URLSearchParams(location.search), a = q.get('a'), g = q.get('go');
      if (a || g) {
        history.replaceState(history.state, '', location.pathname);
        setTimeout(function () {
          var s = st(); if (!s) return;
          if (a === 'checkin' && H.active(s)) { var got = H.checkin(s, 'done'); App.save(); App.toast('✅ Checked in – ' + H.count(s) + ' so far'); App.refresh(); if (got && H.celebrate) H.celebrate(got); }
          else if (g && App.SCREENS[g]) App.go(g, {});
        }, 300);
      }
    } catch (e) {}
  });
})(typeof window !== 'undefined' ? window : global);
