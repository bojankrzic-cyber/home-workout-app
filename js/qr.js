/*
 * QR on the pack → FinestMe. The first minute decides whether a customer ever comes back, so:
 *   1. value before account – the scan opens the instructions for exactly this product, in the customer's
 *      language, from the approved label text (data/labels/<sku>.json), with no sign-up and no profile form
 *   2. one tap to start – "Start my 25-day routine": today already counts as day 1 (endowed progress)
 *   3. one question – when do you take it? tied to something done every day anyway (habit stacking)
 *   4. then the asks, in this order: save it to an account (reminders, rewards on every device) and put the
 *      app on the home screen. Both can be skipped; the routine works on this phone either way.
 * Catalog: js/catalog.js (generated from the label PDFs behind the QR codes, tools/catalog/).
 * QR target: https://app.naturesfinest.eu/?p=<sku>&src=qr  (the codes are dynamic – retarget in QRCode Studio)
 */
(function (global) {
  'use strict';
    // English source – every language comes from the dictionaries (js/i18n.js, lang/<code>.js)
  var T = {
    en: { kicker: 'Your Nature’s Finest product', how: 'How to use', amount: 'Daily amount', when: 'When', often: 'How often', daily: 'Every day', perWeek: '%n× a week', lasts: 'One pack ≈ %n days', label: 'From the label', fullLabel: 'Full label text', warn: 'Read before use', pdf: 'Full label (PDF)', start: 'Start my %n-day routine', start0: 'Start my routine', startSub: 'Today counts as day 1 ✓ · takes 10 seconds', anchorQ: 'When will you take it?', anchorSub: 'Tie it to something you already do every day – that is what makes it stick.', a_coffee: '☕ With my morning coffee', a_breakfast: '🍳 With breakfast', a_lunch: '🥗 With lunch', a_evening: '🌙 In the evening', d1: 'Day 1 ✓ You’ve started', d1Sub: '%n days to go in this pack. I count with you and remind you 5 days before it runs out.', d1Sub0: 'I count with you – one tap a day.', reward7: '🎁 7 check-ins = member badge + free shipping on your next order', saveT: 'Save your routine', saveS: 'Free account with the e-mail you shop with: reminders, your rewards and progress on every device. No password.', google: 'Continue with Google', email: 'Continue with e-mail', later: 'Not now', instT: 'Put FinestMe on your home screen', instS: 'One tap to check in – like an app, no store needed.', instIos: 'Tap Share ⬆︎ and then “Add to Home Screen”.', instBtn: 'Install', open: 'Open my routine', have: 'Already in your routine', newPack: '📦 I opened a new pack', noLabel: 'The instructions for this product are being updated. Until then, please follow the label on the pack.', s_morning: 'Morning', s_evening: 'Evening', s_pre: 'Before training', s_post: 'After training', s_meal: 'With a meal', u_capsule: 'capsule', u_tablet: 'tablet', u_teabag: 'tea bag', u_sachet: 'sachet', soon: 'Accounts open at launch – your routine is saved on this phone.' }
  };
  // webshop per language/region – reorder goes to the customer's own market (product ids differ per market)
  var SHOPS = {
    sl: 'https://www.naturesfinest.si', hr: 'https://www.naturesfinest.hr', it: 'https://www.naturesfinest.it', de: 'https://www.naturesfinestfoods.de',
    'de-at': 'https://www.natures-finest.at', 'de-ch': 'https://www.naturesfinest.ch', hu: 'https://www.naturesfinest.hu', sk: 'https://www.naturesfinest.sk',
    pl: 'https://www.naturesfinest.pl', cs: 'https://www.naturesfinest.cz', fr: 'https://www.naturesfinest.fr', 'fr-be': 'https://www.natures-finest.be',
    'fr-ch': 'https://fr.naturesfinest.ch', es: 'https://www.naturesfinest.es', pt: 'https://www.naturesfinest.pt', nl: 'https://www.naturesfinestfoods.nl',
    'nl-be': 'https://www.naturesfinestfoods.be', ro: 'https://www.naturesfinest.ro', el: 'https://www.naturesfinest.gr', sv: 'https://www.natures-finest.se',
    da: 'https://www.naturesfinestfoods.dk', en: 'https://www.nutrisslim.uk', 'en-ie': 'https://www.naturesfinest.ie',
    bg: 'https://www.naturesfinest.bg', et: 'https://www.naturesfinest.ee', lt: 'https://www.naturesfinest.lt', lv: 'https://www.naturesfinest.lv'
  };

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function locales() {
    var l = [];
    try { l = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en']).map(function (x) { return String(x).toLowerCase(); }); } catch (e) {}
    return l;
  }
  function lang() { return (global.I18N && global.I18N.lang) || 'en'; }
  function shop() {
    var l = locales(), lg = lang();
    for (var i = 0; i < l.length; i++) if (SHOPS[l[i]] && l[i].split('-')[0] === lg) return SHOPS[l[i]];
    return SHOPS[lg] || SHOPS.en;
  }
  // English source text; the DOM layer translates it on screen (I18N.t for anything not in the DOM)
  function t(key, n) { var s = T.en[key]; return n != null ? String(s).replace('%n', n) : s; }
  function entry(sku) { var c = global.FS_CATALOG; return c && c[String(sku)] || null; }
  function amountText(e) {
    if (!e || !e.d || !e.pk) return '';
    var amt = e.d[0] * (e.d[1] || 1), u = e.pk[1];
    if (u === 'g' || u === 'ml') return (Math.round(amt * 10) / 10) + ' ' + u;
    var w = t('u_' + (u === 'softgel' ? 'capsule' : u === 'stick' ? 'sachet' : u));
    return amt + ' × ' + (w || u);
  }

  global.FinestQR = { T: T, lang: lang, t: t, shop: shop, entry: entry, amountText: amountText };
  global.FS_MARKET = { get shop() { return shop(); } };
  if (!global.FS_MODULES) return;     // Node tests stop here

  global.FS_MODULES.push(function (App) {
    var $ = App.$, $$ = App.$$, esc = App.esc, H = global.Health;
    var labels = {}, deferred = null, ios = /iphone|ipad|ipod/i.test(navigator.userAgent || '') && !global.MSStream;
    var standalone = function () { return (global.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; };
    global.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; });
    function st() { return App.state(); }
    function emit(name, props) { try { if (global.Cloud && Cloud.user && Cloud.user() && Cloud.event) Cloud.event(name, props || {}, st().id); } catch (e) {} }

    function loadLabel(sku, cb) {
      if (labels[sku]) return cb(labels[sku]);
      fetch('data/labels/' + encodeURIComponent(sku) + '.json').then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .then(function (j) { labels[sku] = j; cb(j); }, function () { cb(null); });
    }
    function pickLang(obj) { var l = lang(), v = obj && (obj[l] || obj.en) || ''; return v.charAt(0).toUpperCase() + v.slice(1); }
    function langSelect() { return global.I18N ? I18N.select('qrLang', 'qr-lang') : ''; }
    var ICON = { supplement: '🌿', drink: '☕', food: '🥣', beauty: '✨', gear: '🧰' };
    var SLOTS = { evening: 'evening', morning: 'morning', pre: 'pre', post: 'post', meal: 'midday' };

    // ---------------------------------------------------------------- product guide (catalog products)
    var legacy = App.SCREENS.product;
    App.SCREENS.product = function (p) {
      var e = entry(p.id);
      if (!e) return legacy(p);                                 // the 6 starter products keep their guide
      var sku = String(p.id), s = st(), have = s && H && H.items(s).filter(function (x) { return String(x.pid) === sku; })[0];
      var often = e.d && e.d[2] ? t('perWeek', e.d[2]) : t('daily');
      App.$('#app').innerHTML = '<div class="screen qr-screen"><div class="topbar"><h1 translate="no">' + esc(e.n) + '</h1>' + langSelect() + '</div>' +
        '<div class="qr-hero"><div class="qr-ico">' + (ICON[e.k] || '🌿') + '</div><div><div class="kicker">' + esc(t('kicker')) + '</div><h2>' + esc(t('how')) + '</h2>' +
        '<dl class="how">' + (amountText(e) ? '<dt>' + esc(t('amount')) + '</dt><dd>' + esc(amountText(e)) + '</dd>' : '') +
        (e.s ? '<dt>' + esc(t('when')) + '</dt><dd>' + esc(t('s_' + e.s)) + '</dd>' : '') +
        (e.k !== 'beauty' && e.k !== 'gear' ? '<dt>' + esc(t('often')) + '</dt><dd>' + esc(often) + '</dd>' : '') +
        (e.days ? '<dt>📦</dt><dd>' + esc(t('lasts', e.days)) + '</dd>' : '') + '</dl></div></div>' +
        '<div class="panel qr-label" id="qrLabel"><div class="hint">…</div></div>' +
        '<div class="act-foot qr-cta">' + (have
          ? '<button class="btn primary focusable" data-go="program">' + esc(t('open')) + ' →</button><button class="btn focusable" id="qrNew">' + esc(t('newPack')) + '</button><div class="hint">✓ ' + esc(t('have')) + '</div>'
          : '<button class="btn primary focusable" id="qrStart">＋ ' + esc(e.days ? t('start', e.days) : t('start0')) + '</button><div class="hint">' + esc(t('startSub')) + '</div>') + '</div>' +
        '<div class="panel qr-warn" id="qrWarn" hidden></div>' +
        '<a class="btn ghost focusable qr-pdf" href="' + esc(e.pdf) + '" target="_blank" rel="noopener">📄 ' + esc(t('pdf')) + '</a></div>';
      // changing the language reloads the app – come back to this product
      var lp = $('#qrLang'); if (lp) lp.addEventListener('change', function () { try { sessionStorage.setItem('fs.product', JSON.stringify({ id: sku, src: p.src || '' })); } catch (x) {} }, true);
      emit('guide_viewed', { product_id: sku, product: e.n, src: p.src || '', lang: lang() });
      loadLabel(sku, function (j) {
        var box = $('#qrLabel'); if (!box) return;
        var use = j && pickLang(j.use), full = j && pickLang(j.full), warn = j && pickLang(j.warn);
        box.innerHTML = use ? '<div class="k">' + esc(t('label')) + '</div><p class="qr-use notranslate">' + esc(use) + '</p>' +
            (full ? '<details><summary>' + esc(t('fullLabel')) + '</summary><p class="hint notranslate">' + esc(full) + '</p></details>' : '')
          : full ? '<details open><summary>' + esc(t('label')) + '</summary><p class="hint notranslate">' + esc(full) + '</p></details>' : '<p class="hint">' + esc(t('noLabel')) + '</p>';
        var w = $('#qrWarn');
        if (w && warn) { w.hidden = false; w.innerHTML = '<details><summary>⚠︎ ' + esc(t('warn')) + '</summary><p class="hint notranslate">' + esc(warn) + '</p></details>'; }
      });
      if ($('#qrStart')) $('#qrStart').onclick = function () { anchorSheet(sku, e, p.src); };
      if ($('#qrNew')) $('#qrNew').onclick = function () { H.openPack(have.id); };
    };

    // one question, then day 1 is already ticked (endowed progress)
    function anchorSheet(sku, e, src) {
      var w = document.createElement('div'); w.className = 'sheet-wrap';
      w.innerHTML = '<div class="sheet"><div class="sh-grab"></div><h3>' + esc(t('anchorQ')) + '</h3><p class="sh-sub">' + esc(t('anchorSub')) + '</p>' +
        ['coffee', 'breakfast', 'lunch', 'evening'].map(function (k) { return '<button class="btn focusable qr-anchor" data-anchor="' + k + '">' + esc(t('a_' + k)) + '</button>'; }).join('') + '</div>';
      document.body.appendChild(w);
      w.addEventListener('click', function (ev) { if (ev.target === w) w.remove(); });
      $$('[data-anchor]', w).forEach(function (b) { b.onclick = function () { w.remove(); start(sku, e, src, b.getAttribute('data-anchor')); }; });
    }
    function start(sku, e, src, anchor) {
      var s = st(), first = !H.items(s).length, p = H.prog(s);
      var it = { id: 'r' + Date.now().toString(36), pid: sku, name: e.n, dose: amountText(e), slot: e.s ? SLOTS[e.s] || 'morning' : anchor === 'evening' ? 'evening' : 'morning', days: 'daily',
        pack: { start: H.ymd(), servings: e.days || 30 }, perDay: 1 };
      s.settings.routine = H.items(s).concat([it]);
      if (first) { p.checkinTime = anchor; p.start = p.start || H.ymd(); }
      p.src = p.src || src || 'qr';
      H.checkin(s, 'done');                                     // the scan + start is day 1
      App.save();
      emit('routine_started', { product: e.n, product_id: sku, checkin_time: anchor, src: src || '', lang: lang(), days_per_pack: e.days || null });
      App.go('qrWelcome', { sku: sku }, true);
    }

    // ---------------------------------------------------------------- welcome: day 1 done, then the asks
    App.SCREENS.qrWelcome = function (p) {
      var s = st(), e = entry(p.sku) || { n: '' }, it = H.items(s).filter(function (x) { return String(x.pid) === String(p.sku); })[0];
      var sup = it && H.supply(s, it), left = sup ? sup.left : null;
      var cloudOn = global.Cloud && Cloud.configured && Cloud.configured(), signed = cloudOn && Cloud.user && Cloud.user() && !Cloud.user().anon;
      var ring = e.days ? Math.max(4, 100 / e.days) : 14;
      App.$('#app').innerHTML = '<div class="screen qr-screen"><div class="qr-done"><div class="qr-ring" style="--p:' + ring + '"><span>1</span></div>' +
        '<h2>' + esc(t('d1')) + '</h2><p>' + esc(left ? t('d1Sub', left) : t('d1Sub0')) + '</p><p class="qr-reward">' + esc(t('reward7')) + '</p></div>' +
        (signed ? '' : '<div class="panel qr-save"><h3>💾 ' + esc(t('saveT')) + '</h3><p class="hint">' + esc(t('saveS')) + '</p><div class="act-foot">' +
          '<button class="btn primary focusable" id="qrGoogle">' + esc(t('google')) + '</button><button class="btn focusable" id="qrMail">' + esc(t('email')) + '</button></div></div>') +
        (standalone() ? '' : '<div class="panel qr-inst"><h3>📲 ' + esc(t('instT')) + '</h3><p class="hint">' + esc(ios ? t('instIos') : t('instS')) + '</p>' +
          (!ios && deferred ? '<button class="btn focusable" id="qrInstall">' + esc(t('instBtn')) + '</button>' : '') + '</div>') +
        '<div class="act-foot"><button class="btn primary focusable" id="qrHome">' + esc(t('open')) + ' →</button></div></div>';
      emit('account_prompt_shown', { where: 'welcome', signed: !!signed });
      function acct(provider) {
        store('fs.qrAsk', String(Date.now()));
        if (!cloudOn) { App.toast(t('soon')); return; }
        if (provider === 'google' && Cloud.signInOAuth) { Cloud.signInOAuth('google'); return; }
        App.go('account');
      }
      if ($('#qrGoogle')) $('#qrGoogle').onclick = function () { acct('google'); };
      if ($('#qrMail')) $('#qrMail').onclick = function () { acct('email'); };
      if ($('#qrInstall')) $('#qrInstall').onclick = function () { var d = deferred; deferred = null; d.prompt(); d.userChoice.then(function (r) { emit('install_prompt', { outcome: r && r.outcome }); App.refresh(); }, function () {}); };
      $('#qrHome').onclick = function () { App.resetTo('home'); };
    };

    // Today: one gentle ask at a time – account first (from day 2), install after that; each dismissable for 7 days
    FinestQR.homeCard = function (s) {
      if (!s || !H) return '';
      // no routine yet: the way in is the pack in their hand
      if (!H.active(s) || !H.prog(s).src) return '';   // no routine yet: the scan hero under the greeting is the way in
      var dayN = H.count(s), now = Date.now(), snooze = +(store('fs.qrSnooze') || 0);
      if (now < snooze || dayN < 2) return '';
      var cloudOn = global.Cloud && Cloud.configured && Cloud.configured();
      if (cloudOn && !(Cloud.user && Cloud.user() && !Cloud.user().anon)) return '<div class="hp-card qr-ask"><div><b>💾 ' + esc(t('saveT')) + '</b><span>' + esc(t('saveS')) + '</span></div><button class="btn sm primary focusable" data-go="account">' + esc(t('email')) + '</button><button class="btn sm ghost focusable" data-qr-later>' + esc(t('later')) + '</button></div>';
      if (!standalone() && (deferred || ios)) return '<div class="hp-card qr-ask"><div><b>📲 ' + esc(t('instT')) + '</b><span>' + esc(ios ? t('instIos') : t('instS')) + '</span></div>' + (deferred ? '<button class="btn sm primary focusable" data-qr-install>' + esc(t('instBtn')) + '</button>' : '') + '<button class="btn sm ghost focusable" data-qr-later>' + esc(t('later')) + '</button></div>';
      return '';
    };
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-qr-later],[data-qr-install]'); if (!b) return;
      if (b.hasAttribute('data-qr-later')) { store('fs.qrSnooze', String(Date.now() + 7 * 864e5)); App.refresh(); }
      else if (deferred) { var d = deferred; deferred = null; d.prompt(); d.userChoice.then(function (r) { emit('install_prompt', { outcome: r && r.outcome, where: 'today' }); App.refresh(); }, function () {}); }
    });
  });
})(typeof window !== 'undefined' ? window : global);
