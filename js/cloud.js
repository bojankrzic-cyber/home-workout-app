/*
 * Cloud account + sync (Supabase, EU). Local-first: the app keeps working from localStorage;
 * when signed in, changes are pushed a few seconds after each save and pulled on start/focus.
 *
 * Login is passwordless with the webshop e-mail: the e-mail carries a magic link AND a 6-digit
 * code. The code matters: on iPhone a link opens Safari, not the home-screen app, and a TV has no
 * mail app – typing the code signs in exactly where you are.
 *
 * Sync model (per item, last writer wins):
 *   items  = members (profile without history), workouts (log entries), activities
 *   map    = { key: hash of the content last synced } – an item is "dirty" when its hash differs
 *   push   = upsert dirty items, tombstone items that disappeared locally
 *   pull   = rows changed since the last pull; apply a remote row unless the local copy has
 *            unsynced edits (then local wins and is pushed)
 * The pure core (Cloud.core) has no network or DOM and is unit-tested in Node (tools/cloud.cjs).
 */
(function (global) {
  'use strict';
  var CFG = global.FS_CONFIG || {};
  var LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';

  // ---------------------------------------------------------------- pure core
  function hash(o) {
    var s = JSON.stringify(o), h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36) + s.length.toString(36);
  }
  function wid(e) { return e.date + '|' + e.session; }
  function memberContent(p) { return { name: p.name, color: p.color, pin: p.pin || null, settings: p.settings, ex: p.ex, customs: p.customs, saved: p.saved }; }

  // every syncable item in the local db, by key
  function items(db) {
    var out = {};
    (db.order || []).forEach(function (pid) {
      var p = db.profiles[pid]; if (!p) return;
      out['m|' + pid] = { t: 'members', pid: pid, lid: pid, c: memberContent(p) };
      (p.log || []).forEach(function (e) { out['w|' + pid + '|' + wid(e)] = { t: 'workouts', pid: pid, lid: wid(e), c: e }; });
      (p.activities || []).forEach(function (a) { out['a|' + pid + '|' + a.id] = { t: 'activities', pid: pid, lid: a.id, c: a }; });
    });
    return out;
  }
  function toRow(it, deleted) {
    if (it.t === 'members') {
      var c = it.c || {};
      return { local_id: it.lid, name: c.name || 'Me', color: c.color || null, pin: c.pin || null, settings: c.settings || {}, ex: c.ex || {}, customs: c.customs || {}, saved: c.saved || [], deleted: !!deleted };
    }
    var r = { member_id: it.pid, local_id: it.lid, data: deleted ? {} : it.c, deleted: !!deleted };
    if (it.t === 'workouts') r.done_at = it.c && it.c.date || null;
    if (it.t === 'activities' && it.c) { r.type = it.c.type; r.started_at = it.c.start; r.dist_m = it.c.dist || 0; r.moving_s = it.c.moving || it.c.elapsed || 0; }
    return r;
  }
  function keyOf(table, row) {
    return table === 'members' ? 'm|' + row.local_id : (table === 'workouts' ? 'w|' : 'a|') + row.member_id + '|' + row.local_id;
  }
  function contentOf(table, row) {
    return table === 'members' ? { name: row.name, color: row.color, pin: row.pin || null, settings: row.settings, ex: row.ex, customs: row.customs, saved: row.saved } : row.data;
  }
  function splitKey(k) { var p = k.split('|'); return { kind: p[0], pid: p[1], lid: p.slice(2).join('|') }; }

  // what to send: { members: [rows], workouts: [...], activities: [...] } + the map after success
  function diff(db, map) {
    var cur = items(db), out = { members: [], workouts: [], activities: [] }, next = {};
    Object.keys(cur).forEach(function (k) {
      var h = hash(cur[k].c); next[k] = h;
      if (map[k] !== h) out[cur[k].t].push(toRow(cur[k]));
    });
    Object.keys(map).forEach(function (k) {
      if (k.charAt(0) === '_' || cur[k]) return;
      var s = splitKey(k), t = s.kind === 'm' ? 'members' : s.kind === 'w' ? 'workouts' : 'activities';
      out[t].push(toRow({ t: t, pid: s.pid, lid: s.kind === 'm' ? s.pid : s.lid }, true));
    });
    Object.keys(map).forEach(function (k) { if (k.charAt(0) === '_') next[k] = map[k]; });
    return { rows: out, map: next, count: out.members.length + out.workouts.length + out.activities.length };
  }

  // apply remote rows to the local db; returns { changed, map }
  function merge(db, map, remote, newProfile) {
    var cur = items(db), changed = 0;
    map = Object.assign({}, map);
    function dirty(k) { return cur[k] && hash(cur[k].c) !== map[k]; }
    (remote.members || []).forEach(function (r) {
      var k = keyOf('members', r), c = contentOf('members', r), h = hash(c);
      if (r.deleted) {
        if (cur[k] && !dirty(k)) { delete db.profiles[r.local_id]; db.order = db.order.filter(function (x) { return x !== r.local_id; }); if (db.active === r.local_id) db.active = null; changed++; }
        if (!dirty(k)) delete map[k];
        return;
      }
      if (cur[k] && (hash(cur[k].c) === h || dirty(k))) { if (!dirty(k)) map[k] = h; return; }
      if (!cur[k] && map[k] === h) return;              // deleted here since the last sync – the push sends the tombstone
      var p = db.profiles[r.local_id];
      if (!p) { p = newProfile(); p.id = r.local_id; p.log = []; p.activities = []; db.profiles[p.id] = p; db.order.push(p.id); }
      p.name = c.name; p.color = c.color; p.pin = c.pin; p.settings = Object.assign(p.settings || {}, c.settings || {});
      p.ex = c.ex || {}; p.customs = c.customs || {}; p.saved = c.saved || [];
      map[k] = hash(memberContent(p)); changed++;
    });
    ['workouts', 'activities'].forEach(function (t) {
      var field = t === 'workouts' ? 'log' : 'activities', idOf = t === 'workouts' ? wid : function (a) { return a.id; };
      (remote[t] || []).forEach(function (r) {
        var k = keyOf(t, r), p = db.profiles[r.member_id];
        if (!p) return;                                   // member deleted locally – its rows go with it
        p[field] = p[field] || [];
        var idx = -1;
        p[field].forEach(function (x, i) { if (idOf(x) === r.local_id) idx = i; });
        if (r.deleted) {
          if (idx >= 0 && !dirty(k)) { p[field].splice(idx, 1); changed++; }
          if (!dirty(k)) delete map[k];
          return;
        }
        var h = hash(r.data);
        if (idx >= 0 && (hash(p[field][idx]) === h || dirty(k))) { if (!dirty(k)) map[k] = h; return; }
        if (idx < 0 && map[k] === h) return;              // deleted here, not changed elsewhere – keep it deleted
        if (idx >= 0) p[field][idx] = r.data; else p[field].push(r.data);
        map[k] = h; changed++;
      });
    });
    db.order.forEach(function (pid) {
      var p = db.profiles[pid];
      p.log.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      (p.activities || []).sort(function (a, b) { return a.start < b.start ? 1 : -1; });
    });
    // first sign-in on a new device: drop the empty starter profile made during onboarding
    var remoteIds = (remote.members || []).filter(function (r) { return !r.deleted; }).map(function (r) { return r.local_id; });
    if (remoteIds.length) db.order.slice().forEach(function (pid) {
      var p = db.profiles[pid];
      if (remoteIds.indexOf(pid) < 0 && !map['m|' + pid] && !p.log.length && !(p.activities || []).length && !Object.keys(p.ex || {}).length) {
        delete db.profiles[pid]; db.order = db.order.filter(function (x) { return x !== pid; });
        if (db.active === pid) db.active = remoteIds[0];
        changed++;
      }
    });
    return { changed: changed, map: map };
  }

  // ---------------------------------------------------------------- client (Supabase)
  var sb = null, user = null, status = 'off', lastSync = null, timer = null, busy = false, again = false, listeners = [];
  function emit() { listeners.forEach(function (f) { try { f(); } catch (e) {} }); }
  function setStatus(s) { status = s; emit(); }
  function mapKey() { return 'formshaper.sync.' + (user ? user.id : 'x'); }
  function loadMap() { try { return JSON.parse(localStorage.getItem(mapKey()) || '{}'); } catch (e) { return {}; } }
  function saveMap(m) { try { localStorage.setItem(mapKey(), JSON.stringify(m)); } catch (e) {} }
  function configured() { return !!(CFG.supabaseUrl && CFG.supabaseAnonKey) || !!global.__cloudClient; }

  function loadLib() {
    if (global.__cloudClient) return Promise.resolve(global.__cloudClient);   // tests inject a fake client
    if (global.supabase && global.supabase.createClient) return Promise.resolve(make());
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = LIB;
      s.onload = function () { res(make()); }; s.onerror = function () { rej(new Error('offline')); };
      document.head.appendChild(s);
    });
    function make() {
      return global.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit', storageKey: 'formshaper.auth' }
      });
    }
  }

  var PK = { members: 'user_id,local_id', workouts: 'user_id,member_id,local_id', activities: 'user_id,member_id,local_id' };
  function pull(since) {
    return Promise.all(['members', 'workouts', 'activities'].map(function (t) {
      var all = [];
      function page(from) {
        var q = sb.from(t).select('*').order('updated_at', { ascending: true }).range(from, from + 499);
        if (since) q = q.gte('updated_at', since);
        return q.then(function (r) {
          if (r.error) throw r.error;
          all = all.concat(r.data || []);
          return (r.data || []).length === 500 ? page(from + 500) : all;
        });
      }
      return page(0);
    })).then(function (res) { return { members: res[0], workouts: res[1], activities: res[2] }; });
  }
  function push(rows) {
    var jobs = [];
    ['members', 'workouts', 'activities'].forEach(function (t) {
      for (var i = 0; i < rows[t].length; i += t === 'activities' ? 10 : 200) {
        var chunk = rows[t].slice(i, i + (t === 'activities' ? 10 : 200)).map(function (r) { return Object.assign({ user_id: user.id }, r); });
        jobs.push(sb.from(t).upsert(chunk, { onConflict: PK[t] }).then(function (r) { if (r.error) throw r.error; }));
      }
    });
    return Promise.all(jobs);
  }

  // server timestamp of the newest row received – the next pull asks for rows from there on
  function newest(remote) {
    var max = null;
    ['members', 'workouts', 'activities'].forEach(function (t) { (remote[t] || []).forEach(function (r) { if (r.updated_at && (!max || r.updated_at > max)) max = r.updated_at; }); });
    return max;
  }
  function sync() {
    if (!sb || !user) return Promise.resolve();
    if (busy) { again = true; return Promise.resolve(); }
    busy = true; setStatus('syncing');
    var db = Store.raw(), map = loadMap(), since = map._pulled || null;
    return pull(since).then(function (remote) {
      var m = merge(db, map, remote, Store.newProfile);
      map = m.map; map._pulled = newest(remote) || since;
      saveMap(map);
      if (m.changed) { Store.normalizeAll(); Store.save(true); if (Cloud.onRemoteChange) Cloud.onRemoteChange(m.changed); }
      var d = diff(db, map);
      return (d.count ? push(d.rows) : Promise.resolve()).then(function () { saveMap(d.map); });
    }).then(function () {
      busy = false; lastSync = new Date(); setStatus('ok');
      if (again) { again = false; sync(); }
    }).catch(function (e) {
      busy = false; setStatus(navigator.onLine === false ? 'offline' : 'error');
      Cloud.lastError = e && e.message || String(e);
    });
  }
  function schedule() {
    if (!user) return;
    clearTimeout(timer); timer = setTimeout(sync, 2500);
  }

  // consents chosen before the account existed are stored here and sent after the first sign-in
  var PENDING = 'formshaper.pendingConsents';
  function flushConsents() {
    var pend; try { pend = JSON.parse(localStorage.getItem(PENDING) || 'null'); } catch (e) { pend = null; }
    if (!pend || !user) return Promise.resolve();
    var rows = Object.keys(pend.kinds).map(function (k) { return { user_id: user.id, kind: k, granted: pend.kinds[k], version: pend.version }; });
    return sb.from('consents').insert(rows).then(function (r) { if (!r.error) localStorage.removeItem(PENDING); });
  }

  var Cloud = {
    core: { hash: hash, items: items, diff: diff, merge: merge },
    CONSENT_VERSION: 'v1-2026-10',
    configured: configured,
    user: function () { return user; },
    status: function () { return status; },
    lastSync: function () { return lastSync; },
    on: function (f) { listeners.push(f); },
    onRemoteChange: null,
    init: function () {
      if (!configured()) return Promise.resolve();
      return loadLib().then(function (client) {
        sb = client;
        sb.auth.onAuthStateChange(function (ev, session) {
          var u = session && session.user ? { id: session.user.id, email: session.user.email } : null;
          var was = user && user.id;
          user = u;
          if (u && u.id !== was) { setStatus('idle'); flushConsents().then(sync); }
          if (!u) setStatus('signedout');
        });
        return sb.auth.getSession().then(function (r) {
          var s = r.data && r.data.session;
          if (s && !user) { user = { id: s.user.id, email: s.user.email }; flushConsents().then(sync); }
          else if (!s) setStatus('signedout');
        });
      }).catch(function () { setStatus('offline'); });
    },
    // send the sign-in e-mail (magic link + 6-digit code); creates the account on first use
    signIn: function (email, consents) {
      try { localStorage.setItem(PENDING, JSON.stringify({ version: Cloud.CONSENT_VERSION, kinds: consents })); } catch (e) {}
      var back = location.href.split('#')[0].split('?')[0];
      return sb.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true, emailRedirectTo: back } }).then(function (r) { if (r.error) throw r.error; });
    },
    // Google / Apple: same pending-consent flow as the e-mail link; the provider redirects back here
    signInOAuth: function (provider, consents) {
      try { localStorage.setItem(PENDING, JSON.stringify({ version: Cloud.CONSENT_VERSION, kinds: consents })); } catch (e) {}
      var back = location.href.split('#')[0].split('?')[0];
      return sb.auth.signInWithOAuth({ provider: provider, options: { redirectTo: back, queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined } })
        .then(function (r) { if (r.error) throw r.error; });
    },
    // Health program events → app_events (Klaviyo reminders server-side, consent-gated)
    event: function (name, props, memberId) {
      if (!sb || !user) return Promise.resolve();
      return sb.from('app_events').insert({ user_id: user.id, member_id: memberId || null, name: name, props: props || {} }).then(function () {}, function () {});
    },
    // QR scan from a pack or flyer (allowed before sign-in)
    scan: function (sku, src, batch) {
      if (!configured()) return Promise.resolve();
      if (!sb) { var self = this; return loadLib().then(function (c) { sb = c; return self.scan(sku, src, batch); }).catch(function () {}); }
      return sb.from('product_scans').insert({ sku: String(sku), src: src || 'qr', batch: batch || null, user_id: user ? user.id : null }).then(function () {}, function () {});
    },
    providers: function () { return (CFG.authProviders || ['google']).slice(); },
    verifyCode: function (email, code) {
      return sb.auth.verifyOtp({ email: email, token: code, type: 'email' }).then(function (r) { if (r.error) throw r.error; });
    },
    signOut: function () { return sb.auth.signOut().then(function () { user = null; setStatus('signedout'); }); },
    sync: sync,
    schedule: schedule,
    setConsent: function (kind, granted) {
      return sb.from('consents').insert({ user_id: user.id, kind: kind, granted: granted, version: Cloud.CONSENT_VERSION }).then(function (r) { if (r.error) throw r.error; });
    },
    consents: function () {
      return sb.from('current_consents').select('kind,granted,version,created_at').then(function (r) {
        var o = {}; (r.data || []).forEach(function (x) { o[x.kind] = x.granted; }); return o;
      });
    },
    orders: function () {
      return sb.from('orders').select('order_id,ordered_at,items,total,currency,status').order('ordered_at', { ascending: false }).limit(20).then(function (r) { return r.data || []; });
    },
    // GDPR erasure: deletes the account and all cloud data; this device keeps its local copy
    deleteAccount: function () {
      return sb.rpc('delete_my_account').then(function (r) {
        if (r.error) throw r.error;
        try { localStorage.removeItem(mapKey()); } catch (e) {}
        return sb.auth.signOut();
      }).then(function () { user = null; setStatus('signedout'); });
    }
  };
  global.Cloud = Cloud;
})(typeof window !== 'undefined' ? window : global);
