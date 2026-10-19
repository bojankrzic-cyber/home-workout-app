/*
 * Account module – Nature's Finest account (passwordless, webshop e-mail), consents, sync status,
 * linked webshop orders, sign-out and erasure. Hidden entirely until js/config.js holds the
 * Supabase project (the app then stays local-only, exactly as before).
 */
(window.FS_MODULES = window.FS_MODULES || []).push(function (App) {
  'use strict';
  var C = window.Cloud, CFG = window.FS_CONFIG || {}, $ = App.$, $$ = App.$$, esc = App.esc;
  if (!C || !C.configured()) return;

  Store.onSave(function () { C.schedule(); });
  C.on(function () { var el = $('#acctStatus'); if (el) el.innerHTML = statusTxt(); });
  C.onRemoteChange = function () {
    if (document.querySelector('.player')) return;          // never redraw under a running workout / recording
    App.reload();
  };
  C.init();
  // pick up edits made on another device when the app comes back to the foreground
  document.addEventListener('visibilitychange', function () { if (!document.hidden && C.user()) C.sync(); });
  window.addEventListener('online', function () { if (C.user()) C.sync(); });

  function ago(d) {
    if (!d) return '';
    var s = Math.round((Date.now() - d) / 1000);
    return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : Math.round(s / 3600) + ' h ago';
  }
  function statusTxt() {
    var st = C.status();
    return st === 'syncing' ? '<i class="sy busy"></i>Syncing…' : st === 'ok' ? '<i class="sy ok"></i>Synced ' + ago(C.lastSync()) :
      st === 'offline' ? '<i class="sy off"></i>Offline – changes sync when you’re back online' : st === 'error' ? '<i class="sy err"></i>Sync problem – retrying on next change' : '<i class="sy"></i>Connecting…';
  }
  var PRIVACY = CFG.privacyUrl || 'https://www.naturesfinest.si';

  // Settings: compact account card at the top
  App.hooks.settings.push(function () {
    var u = C.user();
    if (!u) return '<div class="panel acct-cta"><div><h3>Save your progress to your Nature’s Finest account</h3>' +
      '<div class="hint">Use the e-mail you shop with. Your workouts, activities and progress on every device – phone, TV and tablet. No password.</div></div>' +
      '<button class="btn primary focusable" data-go="account">Sign in or create account</button></div>';
    return '<div class="panel acct-cta on"><div><h3>Nature’s Finest account</h3><div class="hint"><b>' + esc(u.email) + '</b> · <span id="acctStatus">' + statusTxt() + '</span></div></div>' +
      '<button class="btn focusable" data-go="account">Account →</button></div>';
  });

  App.SCREENS.account = function (p) {
    var u = C.user(), html;
    if (!u) {
      var step = p.sent ? 2 : 1;
      html = '<div class="screen"><div class="topbar"><h1>Your account</h1></div>' +
        '<div class="hero acct-hero"><div class="panel">' +
        (step === 1 ?
          '<h3>Sign in with the e-mail you shop with</h3>' +
          '<ul class="acct-why"><li>Your workouts, runs and progress on every device</li><li>Your Nature’s Finest orders linked automatically – product guides and routines next</li><li>No password – Google, or a link and 6-digit code by e-mail</li></ul>' +
          '<div class="acct-oauth">' + C.providers().map(function (pv) {
            return pv === 'google' ? '<button class="btn oauth focusable" data-oauth="google"><svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.7l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>Continue with Google</button>'
              : pv === 'apple' ? '<button class="btn oauth apple focusable" data-oauth="apple"> Continue with Apple</button>' : '';
          }).join('') + '</div><div class="acct-or">or with e-mail</div>' +
          '<input class="field focusable wide" id="acEmail" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" value="' + esc(p.email || '') + '">' +
          '<label class="check"><input type="checkbox" id="acHealth" class="focusable"' + (p.health ? ' checked' : '') + '><span><b>Required:</b> I agree that Nature’s Finest stores my training, activity and body data (this includes health data) in my account so the app works across my devices. I can withdraw at any time by deleting my account. <a href="' + esc(PRIVACY) + '" target="_blank" rel="noopener">Privacy policy</a></span></label>' +
          '<label class="check"><input type="checkbox" id="acMkt" class="focusable"' + (p.mkt ? ' checked' : '') + '><span>Optional: send me training tips and offers from Nature’s Finest by e-mail.</span></label>' +
          '<button class="btn primary focusable" id="acSend">Send sign-in e-mail</button>'
          :
          '<h3>Check your inbox</h3><p class="hint">We sent an e-mail to <b>' + esc(p.email) + '</b>. Open the link on this device – or type the 6-digit code from the e-mail here (works on TV and in the home-screen app too).</p>' +
          '<input class="field focusable code-in" id="acCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••">' +
          '<div class="act-foot"><button class="btn primary focusable" id="acVerify">Sign in</button><button class="btn ghost focusable" id="acBack">Use another e-mail</button><button class="btn ghost focusable" id="acResend">Resend</button></div>') +
        '</div><div class="panel acct-note"><h3>Your data, your call</h3><div class="hint">Stored in the EU (Frankfurt). Only you can read it. You can export it, and deleting your account erases it from our servers. Your data on this device stays until you clear it.</div></div></div></div>';
      App.$('#app').innerHTML = html;
      if (step === 1) {
        $$('[data-oauth]').forEach(function (b) {
          b.onclick = function () {
            if (!$('#acHealth').checked) { App.toast('Please accept data storage first – the account can’t work without it'); $('#acHealth').focus(); return; }
            b.disabled = true;
            C.signInOAuth(b.getAttribute('data-oauth'), { health_data: true, marketing_email: $('#acMkt').checked })
              .catch(function (e) { b.disabled = false; App.toast('Couldn’t open sign-in: ' + (e.message || 'try again')); });
          };
        });
        $('#acSend').onclick = function () {
          var email = $('#acEmail').value.trim(), health = $('#acHealth').checked, mkt = $('#acMkt').checked;
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { App.toast('Enter a valid e-mail'); return; }
          if (!health) { App.toast('Please accept data storage – the account can’t work without it'); return; }
          this.disabled = true; this.textContent = 'Sending…';
          C.signIn(email, { health_data: true, marketing_email: mkt }).then(function () {
            App.go('account', { sent: true, email: email }, true);
          }).catch(function (e) { App.toast('Couldn’t send: ' + (e.message || 'try again')); App.refresh({ email: email, health: health, mkt: mkt }); });
        };
      } else {
        $('#acVerify').onclick = function () {
          var code = $('#acCode').value.replace(/\D/g, '');
          if (code.length !== 6) { App.toast('Enter the 6-digit code'); return; }
          C.verifyCode(p.email, code).then(function () { App.toast('Signed in – syncing'); App.go('account', {}, true); })
            .catch(function () { App.toast('That code didn’t work – check it or resend'); });
        };
        $('#acBack').onclick = function () { App.go('account', { email: p.email }, true); };
        $('#acResend').onclick = function () {
          var b = this; b.disabled = true;
          C.signIn(p.email, JSON.parse(localStorage.getItem('formshaper.pendingConsents') || '{"kinds":{"health_data":true}}').kinds)
            .then(function () { App.toast('Sent again'); }).catch(function () { App.toast('Please wait a minute before resending'); });
          setTimeout(function () { b.disabled = false; }, 60000);
        };
      }
      return;
    }

    var db = Store.raw(), nW = 0, nA = 0;
    db.order.forEach(function (id) { nW += db.profiles[id].log.length; nA += (db.profiles[id].activities || []).length; });
    html = '<div class="screen"><div class="topbar"><h1>Your account</h1></div>' +
      '<div class="hero"><div class="panel"><h3>' + esc(u.email) + '</h3><div class="hint" id="acctStatus">' + statusTxt() + '</div>' +
      '<div class="act-tot"><div><b>' + db.order.length + '</b><span>' + (db.order.length === 1 ? 'person' : 'people') + '</span></div><div><b>' + nW + '</b><span>workouts</span></div><div><b>' + nA + '</b><span>activities</span></div></div>' +
      '<div class="act-foot"><button class="btn focusable" id="acSync">Sync now</button><button class="btn ghost focusable" id="acOut">Sign out</button></div></div>' +
      '<div class="panel"><h3>Your Nature’s Finest orders</h3><div id="acOrders" class="hint">Loading…</div></div></div>' +
      '<div class="panel"><h3>Privacy & consent</h3>' +
      '<label class="check"><input type="checkbox" id="acMkt2" class="focusable"><span>Send me training tips and offers by e-mail</span></label>' +
      '<div class="hint">Health & training data is stored because you agreed when you created the account. To withdraw that, delete the account – it erases your cloud data. <a href="' + esc(PRIVACY) + '" target="_blank" rel="noopener">Privacy policy</a></div>' +
      '<div class="act-foot"><button class="btn ghost focusable danger" id="acDel">Delete account & cloud data</button></div></div></div>';
    App.$('#app').innerHTML = html;
    $('#acSync').onclick = function () { C.sync(); };
    $('#acOut').onclick = function () {
      App.ask('Sign out? Your data stays on this device; sign in again to keep syncing.', 'Sign out', function () { C.signOut().then(function () { App.refresh({}); }); });
    };
    $('#acDel').onclick = function () {
      App.ask('Delete your account and all cloud data (workouts, activities, profile)? This can’t be undone. This device keeps its local copy.', 'Delete forever', function () {
        C.deleteAccount().then(function () { App.toast('Account deleted'); App.refresh({}); }).catch(function (e) { App.toast('Couldn’t delete: ' + e.message); });
      });
    };
    C.consents().then(function (c) {
      var box = $('#acMkt2'); if (!box) return;
      box.checked = !!c.marketing_email;
      box.onchange = function () {
        C.setConsent('marketing_email', box.checked).then(function () { App.toast(box.checked ? 'Subscribed to tips & offers' : 'Unsubscribed'); });
      };
    });
    C.orders().then(function (o) {
      var el = $('#acOrders'); if (!el) return;
      el.innerHTML = o.length ? '<div class="hist">' + o.map(function (x) {
        return '<div class="hist-item"><div class="d">' + (x.ordered_at ? new Date(x.ordered_at).toLocaleDateString('en-GB') : '') + '</div><div style="flex:1">' +
          esc((x.items || []).map(function (i) { return (i.qty > 1 ? i.qty + '× ' : '') + i.name; }).join(', ')) + '</div><div>' + (x.total != null ? x.total + ' ' + esc(x.currency || '€') : '') + '</div></div>';
      }).join('') + '</div>' : 'No orders linked yet. Orders placed with ' + esc(u.email) + ' on naturesfinest.si appear here automatically.';
    });
  };
});
