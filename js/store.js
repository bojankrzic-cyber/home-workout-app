/*
 * Local persistence (localStorage) with multiple profiles + JSON backup.
 *
 * db = { profiles: { id: profile }, order: [id], active: id|null }
 * profile = { id, name, color, pin (hash|null), settings, log, ex, customs, saved }
 *
 * The PIN is a privacy lock for a shared TV (keeps family members out of each other's
 * logs), not security: data lives unencrypted in this browser.
 */
(function (global) {
  'use strict';
  var KEY = 'homeworkout.v2';
  var KEY_V1 = 'homeworkout.v1';
  var COLORS = ['#3ec46d', '#5ad1b8', '#fcb900', '#b6c99b', '#f08a5d', '#a99be8'];
  var db = null;

  function defaultSettings() {
    return {
      days: 4, level: 'mid', voice: true, beeps: true, previewSec: 15, startDate: new Date().toISOString().slice(0, 10),
      equipment: (global.Exercises ? Exercises.HOME_GYM : ['bike', 'rower', 'kb', 'db', 'tria', 'bench', 'kinesis', 'wall']).slice()
    };
  }

  function newProfile(name, color) {
    return {
      id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name || 'Jaz', color: color || COLORS[0], pin: null,
      settings: defaultSettings(),
      log: [],      // [{ date, session, name, min, sets: [{ id, reps, load }] }]
      ex: {},       // per-exercise progression: { load, reps: [..], fails, date }
      customs: {},  // custom sessions by key (built in the session builder)
      saved: []     // keys of customs the user saved as favourites
    };
  }

  function normalize(p) {
    var d = newProfile();
    p.settings = Object.assign(d.settings, p.settings || {});
    p.log = p.log || []; p.ex = p.ex || {}; p.customs = p.customs || {}; p.saved = p.saved || [];
    p.color = p.color || COLORS[0]; p.name = p.name || 'Jaz';
    return p;
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        db = JSON.parse(raw);
        db.profiles = db.profiles || {}; db.order = (db.order || []).filter(function (id) { return db.profiles[id]; });
        db.order.forEach(function (id) { normalize(db.profiles[id]); });
        return db;
      }
      db = { profiles: {}, order: [], active: null };
      var v1 = localStorage.getItem(KEY_V1);
      if (v1) {
        // migrate the single-user v1 state into a first profile
        var old = JSON.parse(v1), p = newProfile('Jaz');
        p.settings = Object.assign(p.settings, old.settings || {});
        delete p.settings.name;
        p.log = old.log || []; p.ex = old.ex || {};
        addProfile(p);
        db.active = p.id;
        save();
      }
    } catch (e) { db = { profiles: {}, order: [], active: null }; }
    return db;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* storage full / private mode */ }
  }

  function addProfile(p) { db.profiles[p.id] = normalize(p); db.order.push(p.id); return p; }
  function removeProfile(id) {
    delete db.profiles[id];
    db.order = db.order.filter(function (x) { return x !== id; });
    if (db.active === id) db.active = null;
    save();
  }
  function list() { return db.order.map(function (id) { return db.profiles[id]; }); }
  function active() { return db.active ? db.profiles[db.active] || null : null; }
  function setActive(id) { db.active = id; save(); return db.profiles[id]; }

  function hashPin(pin) {
    var h = 5381, s = 'hg:' + pin;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }
  function setPin(p, pin) { p.pin = pin ? hashPin(pin) : null; save(); }
  function checkPin(p, pin) { return !p.pin || p.pin === hashPin(pin); }

  // Record a finished session and update progression memory
  function recordSession(p, entry) {
    p.log.push(entry);
    var byEx = {};
    entry.sets.forEach(function (s) { (byEx[s.id] = byEx[s.id] || []).push(s); });
    Object.keys(byEx).forEach(function (id) {
      var sets = byEx[id], item = entry.items[id];
      if (!item || !item.reps) return;
      var reps = sets.map(function (s) { return s.reps; });
      var prev = p.ex[id] || {};
      var anyLow = reps.some(function (r) { return r < item.reps[0]; });
      p.ex[id] = {
        load: sets[sets.length - 1].load,
        reps: reps,
        fails: anyLow ? (prev.fails || 0) + 1 : 0,
        date: entry.date
      };
    });
    delete entry.items;
    pruneCustoms(p);
    save();
  }

  // keep saved favourites + custom sessions referenced by the last 30 log entries
  function pruneCustoms(p) {
    var keep = {};
    p.saved.forEach(function (k) { keep[k] = 1; });
    p.log.slice(-30).forEach(function (l) { keep[l.session] = 1; });
    var keys = Object.keys(p.customs).sort();
    keys.forEach(function (k, i) { if (!keep[k] && i < keys.length - 10) delete p.customs[k]; });
  }

  function exportJSON() {
    var blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'trening-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
  }

  // Accepts a v2 backup (merges profiles) or a v1 single-user backup (adds as new profile)
  function importJSON(text) {
    var s = JSON.parse(text);
    if (s.profiles && s.order) {
      s.order.forEach(function (id) {
        if (!s.profiles[id]) return;
        if (!db.profiles[id]) db.order.push(id);
        db.profiles[id] = normalize(s.profiles[id]);
      });
    } else if (s.settings && Array.isArray(s.log)) {
      var p = newProfile('Uvoženo');
      p.settings = Object.assign(p.settings, s.settings); delete p.settings.name;
      p.log = s.log; p.ex = s.ex || {};
      addProfile(p);
    } else throw new Error('Neveljavna datoteka');
    save();
  }

  function resetProgress(p) { p.log = []; p.ex = {}; p.customs = {}; p.saved = []; save(); }

  global.Store = {
    COLORS: COLORS, load: load, save: save, newProfile: newProfile, addProfile: addProfile, removeProfile: removeProfile,
    list: list, active: active, setActive: setActive, setPin: setPin, checkPin: checkPin,
    recordSession: recordSession, exportJSON: exportJSON, importJSON: importJSON, resetProgress: resetProgress
  };
})(window);
